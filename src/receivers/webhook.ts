import {Server, createServer} from 'http'
import {Receiver} from "@/receiver";
import {IncomingMessage, ServerResponse} from "http";
import {SessionManager} from "@/sessionManager";
import {OpCode} from "@/constans";
import {DataPacket} from "@/types";
import {Ed25519} from "@/ed25519";

export type KoaContext = {
    request: IncomingMessage,
    response: ServerResponse
}
export type ApplicationPlatform = 'koa' | 'express'
export type Middleware<T extends ApplicationPlatform> = T extends 'koa' ? KoaMiddleware : ExpressMiddleware
export type KoaMiddleware = (ctx: KoaContext, next) => any
export type ExpressMiddleware = (req: IncomingMessage, res: ServerResponse) => any
type ServerConfig = {
    port: number
    path: string
}
export type WebhookReceiverConfig = ServerConfig
const createEd25519 = (secret: string) => {
    return new Ed25519(secret)
}
const resolveBodyData = async (req: IncomingMessage) => {
    return new Promise<string>(resolve => {
        const dataArr: Buffer[] = [];
        req.on('data', (data) => {
            dataArr.push(data)
        })
        req.on('end', () => {
            resolve(Buffer.concat(dataArr).toString())
        })
    })
}

async function webhookHandler(this: Receiver, req: IncomingMessage, res: ServerResponse, ed25519: Ed25519) {
    const bodyData = await resolveBodyData(req)
    if (!ed25519) return
    const signature = req.headers['x-signature-ed25519']?.toString()
    const timestamp = req.headers['x-signature-timestamp']?.toString()
    if (!signature) return res.end()
    if (!ed25519.verify(signature, timestamp + bodyData)) return res.end()
    const data: DataPacket = JSON.parse(bodyData)
    switch (data.op) {
        case OpCode.SIGN_VERIFY:
            const {plain_token, event_ts} = data.d
            const signed = ed25519.sign(event_ts + plain_token)
            return res
                .writeHead(200, {
                    'Content-Type': 'application/json'
                })
                .end(Buffer.from(JSON.stringify({
                    plain_token,
                    signature:signed
                }), 'utf8'))
        case OpCode.DISPATCH:
            return this.emit('packet', data)
    }
}

export function createWebhookReceiver(port: number, path: string): Receiver<{ server: Server }> {
    let ed25519: Ed25519
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        if (req.url !== path) return
        handler(req, res, ed25519)
    })
    const receiver = new Receiver({server})
    const handler = webhookHandler.bind(receiver)
    receiver.on('start', async (session: SessionManager<'webhook'>) => {
        ed25519 =createEd25519(session.bot.config.secret)
        if (server.listening) throw new Error('receiver has started')
        server.listen(port, () => {
            session.bot.logger.info(`server listen at port: ${port}`)
            receiver.emit('ready')
        })
    })
    receiver.on('stop', async () => {
        ed25519 = null
        return new Promise<boolean>((resolve, reject) => {
            if (!server.listening) return reject(new Error('receiver has stopped'))
            server.close(err => {
                if (err) return reject(err)
                resolve(true)
            })
        })
    })
    return receiver
}

function getMiddleware<T extends ApplicationPlatform>(platform: ApplicationPlatform): Middleware<T> {
    switch (platform) {
        case 'koa':
            return (async function (this: Receiver<{
                middleware: Middleware<'koa'>
                ed24419?: Ed25519
            }>, ctx: KoaContext, next) {
                next && await next()
                return webhookHandler.apply(this, [
                    ctx.request,
                    ctx.response,
                    this.handler.ed24419
                ])
            }) as Middleware<T>
        case 'express':
            return (async function (this: Receiver<{
                middleware: Middleware<'express'>
                ed24419?: Ed25519
            }>, req: IncomingMessage, res: ServerResponse) {
                return webhookHandler.apply(this, [
                    req,
                    res,
                    this.handler.ed24419
                ])
            }) as Middleware<T>
        default:
            throw Error('unsupported platform')
    }
}

export function createMiddlewareReceiver<T extends ApplicationPlatform>(platform: T) {
    const middleware = getMiddleware(platform)
    const receiver = new Receiver<{
        middleware: () => Middleware<T>,
        ed24419?: ReturnType<typeof createEd25519>
    }>({
        middleware: () => {
            return middleware.bind(receiver) as Middleware<T>
        }
    })
    receiver.on('start', async (session: SessionManager<'middleware'>) => {
        receiver.emit('ready')
        receiver.handler.ed24419 = await createEd25519(session.bot.config.secret)
    })
    receiver.on('stop', (session: SessionManager<'middleware'>) => {
        receiver.handler.ed24419 = null
    })
    return receiver
}
