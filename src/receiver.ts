import {EventEmitter} from "events";
import {ApplicationPlatform, WebhookReceiverConfig} from "@/receivers/webhook";

export class Receiver<T extends object=object> extends EventEmitter{
    constructor(public handler:T) {
        super();
    }
}
export namespace Receiver{
    export const receivers:Map<string,Receiver>=new Map<string, Receiver>()
    export function register<T extends object>(mode:string,receiver:Receiver<T>){
        if(receivers.has(mode)) throw new Error(`mode of ${mode} has exist receiver`)
        receivers.set(mode,receiver)
    }
    export function get(mode:string){
        return receivers.get(mode)
    }
    export type ReceiveMode='websocket'|'webhook'|'middleware'
    export type Config<T extends ReceiveMode,M extends ApplicationPlatform>=ReceiveModeConfig<M>[T]
    export interface ReceiveModeConfig<M extends ApplicationPlatform>{
        websocket:{}
        middleware:{
            application:M
        }
        webhook:WebhookReceiverConfig
    }
}

