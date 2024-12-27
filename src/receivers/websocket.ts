import {WebSocket} from "ws";
import {Receiver} from "@/receiver";
import {SessionManager} from "@/sessionManager";
import {toObject, DataPacket} from "@";
import {OpCode, SessionEvents, WebsocketCloseReason} from "@/constans";
export type BufferLike =
| string
| Buffer
| DataView
| number
| ArrayBufferView
| Uint8Array
| ArrayBuffer
| SharedArrayBuffer
| readonly any[]
| readonly number[]
| { valueOf(): ArrayBuffer }
| { valueOf(): SharedArrayBuffer }
| { valueOf(): Uint8Array }
| { valueOf(): readonly number[] }
| { valueOf(): string }
| { [Symbol.toPrimitive](hint: string): string };
export function createWebsocketReceiver(){
    const receiver= new Receiver<{
        ws?:WebSocket
    }>({})
    let heartbeat_interval:number=45000,
        is_reconnect:boolean=false,
        retry_count:number=0,
        is_closed:boolean=true,
        timer:NodeJS.Timeout=null;
    const reconnect=async (session:SessionManager<'websocket'>)=>{
        retry_count++;
        session.bot.logger.error(`[CLIENT] 连接断开，第${retry_count}次重连...`)
        is_reconnect=true;
        try{
            await connect(session)
        }catch (e){
            session.bot.logger.error(e.message)
            await reconnect(session)
        }
    }
    const connect=async (session:SessionManager<'websocket'>)=>{
        const url=await session.getWsUrl()
        const ws=receiver.handler.ws=new WebSocket(url);
        const sendWs=(data:Record<string, any>|string)=>{
            session.bot.logger.debug('[CLIENT] 发送消息',data)
            if(typeof data==="object") data=JSON.stringify(data)
            return session.receiver.handler.ws?.send(data)
        }
        const resumeConnect=()=>{
            session.bot.logger.debug('[CLIENT] 正在恢复连接...')
            console.log(session.sessionRecord)
            return sendWs({
                op: OpCode.RESUME,
                d: {
                    // token: `Bot ${this.bot.appId}${this.token}`,
                    token: `QQBot ${session.access_token}`,
                    session_id: session.sessionRecord.sessionID,
                    seq: session.sessionRecord.seq||1
                }
            })
        }
        const auth=()=>{
            session.bot.logger.debug('[CLIENT] 正在鉴权...')
            return sendWs({
                op: OpCode.IDENTIFY, // 鉴权参数
                d: {
                    token: `QQBot ${session.access_token}`, // 根据配置转换token
                    intents: session.getValidIntends(), // todo 接受的类型
                    shard: [0, 1] // 分片信息,给一个默认值
                }
            })
        }
        const sendHeartBeat=()=>{
            if(timer) clearTimeout(timer)
            session.bot.logger.debug(`[CLIENT] 发送心跳`)
            sendWs({
                op:1,
                d:session.sessionRecord?.seq||null
            })
            if(!is_closed) timer=setTimeout(sendHeartBeat,heartbeat_interval)
        }
        const dispatchEvent=(event:string,wsRes:DataPacket)=>{
            switch (event){
                case SessionEvents.READY:
                    const {user = {},session_id} = wsRes.d;
                    session.bot.self_id = user.id;
                    session.bot.nickname = user.username;
                    session.bot.status = user.status || 0;
                    session.sessionRecord.sessionID=session_id
                    is_closed=false;
                    sendHeartBeat()
                    receiver.emit('ready',receiver)
                    session.bot.logger.info(`welcome ${user.username}`)
                    break;
                case SessionEvents.RESUMED:
                    retry_count=0;
                    is_reconnect=false
                    is_closed=false;
                    sendHeartBeat()
                    session.bot.logger.info(`[CLIENT] 重连成功`);
                    break;
                default:
                    // 更新心跳唯一值
                    const {s} = wsRes;
                    if (s) session.sessionRecord.seq =  s;
                    receiver.emit('packet',wsRes)
            }
        }
        ws.on('open',()=>{
            session.bot.logger.debug('connect open')
        })
        ws.on('message',async (data)=>{
            session.bot.logger.debug(`[CLIENT] 收到消息: ${data}`);
            // 先将消息解析
            const wsRes = toObject<DataPacket>(data);
            switch (wsRes.op){
                case  OpCode.HELLO:
                    session.bot.logger.debug('connect to gateway')
                    heartbeat_interval=wsRes.d.heartbeat_interval
                    return is_reconnect?resumeConnect():auth()
                case OpCode.DISPATCH:
                    return dispatchEvent(wsRes.t,wsRes)
                case OpCode.HEARTBEAT_ACK:
                    return session.bot.logger.debug(`[CLIENT] 收到心跳`,wsRes)
                case OpCode.RECONNECT:
                    return ws.close(4009)
                case OpCode.INVALID_SESSION:
                    session.bot.logger.error(`[CLIENT] 连接失败，无效的会话`)

            }
        })
        ws.on('error',e=>{
            session.bot.logger.mark("[CLIENT] 连接错误",e);
            ws.close(-1,e.message)
        })
        ws.on('close',(code,reason)=>{
            if(session.userClose || [4914, 4915].includes(code)) return
            const reasonInfo = WebsocketCloseReason.find((v) => v.code === code)
            if(!reasonInfo) return session.bot.logger.trace('[CLIENT] close with '+(reason.toString() || 'unknown error'))
            session.bot.logger.info(`[CLIENT] 连接关闭：${reasonInfo.reason}`)
            is_closed=true;
            if(reasonInfo.resume) reconnect(session)
        })
    }
    const disconnect=()=>{
        receiver.handler.ws?.close()
    }
    receiver.on('start',connect)
    receiver.on('stop',disconnect)
    receiver.on('restart',reconnect)
    return receiver
}
