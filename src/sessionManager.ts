import axios from "axios";
import {QQBot} from "./qqBot";
import {EventEmitter} from "events";
import {Intends, OpCode, SessionEvents, WebsocketCloseReason} from "@/constans";
import {ApplicationPlatform, createWebhookReceiver,createMiddlewareReceiver} from "@/receivers/webhook";
import {createWebsocketReceiver} from "@/receivers/websocket";
import {Receiver} from "@/receiver";
import {DataPacket} from "@/types";

export const MAX_RETRY = 10;
export type ResolveReceiver<T extends Receiver.ReceiveMode,M extends ApplicationPlatform=never>=T extends 'websocket' ?
        ReturnType<typeof createWebsocketReceiver> :
        T extends 'middleware' ?
            ReturnType<typeof createMiddlewareReceiver<M>> :
            ReturnType<typeof createWebhookReceiver>
export class SessionManager<T extends Receiver.ReceiveMode,M extends ApplicationPlatform=never> extends EventEmitter {
    public access_token: string;
    public wsUrl: string;
    retry: number = 0;
    alive?: boolean;
    heartbeatInterval: number;
    isReconnect: boolean;
    userClose: boolean
    sessionRecord = {
        sessionID: "",
        seq: 0
    };
    heartbeatParam = {
        op: OpCode.HEARTBEAT,
        d: null // 心跳唯一值
    };
    receiver:ResolveReceiver<T,M>

    #bot:QQBot<T, M>
    get bot(){
        return this.#bot
    }
    constructor(bot: QQBot<T,M>) {
        super();
        this.#bot=bot
        switch (bot.config.mode){
            case 'middleware':
                this.receiver=createMiddlewareReceiver((bot.config as QQBot.Config<'middleware'>).application) as ResolveReceiver<T,M>
                break;
            case 'webhook':
                const {port,path}=bot.config as QQBot.Config<'webhook'>
                this.receiver=createWebhookReceiver(port,path) as ResolveReceiver<T, M>
                break;
            case 'websocket':
                this.receiver=createWebsocketReceiver() as ResolveReceiver<T, M>
                break;
            default:
                throw new Error('unknown mode' + bot.config.mode)
        }
        this.receiver.on("packet",(packet:DataPacket)=>{
            this.bot.dispatchEvent(packet.t,packet)
        })
        this.on(SessionEvents.EVENT_WS,async (data) => {
            switch (data.eventType) {
                case SessionEvents.RECONNECT:
                    this.bot.logger.mark("[CLIENT] 等待断线重连中...");
                    break;
                case SessionEvents.DISCONNECT:
                    if (this.userClose || [4914, 4915].includes(data.code)) return
                    if (this.retry < (this.bot.config.maxRetry || MAX_RETRY)) {
                        this.bot.logger.mark("[CLIENT] 重新连接中，尝试次数：", this.retry + 1);
                        if (WebsocketCloseReason.find((v) => v.code === data.code)?.resume) {
                            this.sessionRecord = data.eventMsg;
                        }
                        this.isReconnect = data.code === 4009
                        this.bot.ws.close()
                        this.start();
                        this.retry += 1;
                    } else {
                        this.bot.logger.mark("[CLIENT] 超过重试次数，连接终止");
                        this.emit(SessionEvents.DEAD, {
                            eventType: SessionEvents.ERROR,
                            msg: "连接已死亡，请检查网络或重启"
                        });
                    }
                    break;
                case SessionEvents.READY:
                    this.bot.logger.mark("[CLIENT] 连接成功");
                    this.retry = 0;
                    break;
                default:
            }
        });
        this.on(SessionEvents.ERROR, (code,message) => {
            this.bot.logger.error(`[CLIENT] 发生错误：${code} ${message}`);
        })
    }

    async getAccessToken(): Promise<QQBot.Token> {
        let {secret, appid} = this.bot.config;
        const getToken = () => {
            return new Promise<QQBot.Token>((resolve, reject) => {
                axios.post("https://bots.qq.com/app/getAppAccessToken", {
                    appId: appid,
                    clientSecret: secret
                }).then(res => {
                    if (res.status === 200 && res.data && typeof res.data === "object") {
                        resolve(res.data as QQBot.Token);
                    } else {
                        reject(res);
                    }
                });
            });
        };
        const getNext = async (next_time: number) => {
            return new Promise<QQBot.Token>(resolve => {
                setTimeout(async () => {
                    const token = await getToken();
                    this.bot.logger.debug("getAccessToken", token);
                    this.access_token = token.access_token;
                    getNext(token.expires_in - 1).catch(() => getNext(0));
                    resolve(token);
                }, next_time * 1000);
            });
        };
        return getNext(0);
    }

    async getWsUrl() {
        return new Promise<string>((resolve) => {
            this.bot.request.get("/gateway/bot", {
                headers: {
                    Accept: "*/*",
                    "Accept-Encoding": "utf-8",
                    "Accept-Language": "zh-CN,zh;q=0.8",
                    Connection: "keep-alive",
                    "User-Agent": "v1",
                    Authorization: ""
                }
            }).then(res => {
                if (!res.data) throw new Error("获取ws连接信息异常");
                this.wsUrl = res.data.url;
                resolve(res.data.url);
            });
        });
    }

    getValidIntends() {
        return (this.bot.config.intents || []).reduce((result, item) => {
            const value = Intends[item];
            if (value === undefined) {
                this.bot.logger.warn(`Invalid intends(${item}),skip...`);
                return result;
            }
            return Intends[item as keyof Intends] | result;
        }, 0);
    }

    async start() {
        return new Promise<void>(async (resolve) => {
            await this.getAccessToken()
            this.receiver.emit('start',this)
            this.receiver.on('ready',resolve)
        })
    }

    async stop() {
        this.userClose = true
        this.receiver.emit('stop',this)
    }

}
