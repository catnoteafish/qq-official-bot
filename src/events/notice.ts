import {AuditType, Bot, Dict, Emoji, ReactionTargetType} from "@";
import {EventParser} from "@/events/index";

export class NoticeEvent {
    notice_type: NoticeEvent.Type
    sub_type: string
    guild_id?: string
    channel_id?: string
    group_id?: string
    operator_id?: string

    constructor(public bot: Bot, payload: Dict) {
    }

}

export namespace NoticeEvent {
    export type Type = 'friend' | 'group' | 'direct' | 'channel' | 'forum' | 'guild'
}

export class ActionNoticeEvent extends NoticeEvent {
    event_id: string
    notice_id: string
    data: ActionNoticeEvent.ActionData
    private replied: boolean = false

    constructor(bot: Bot, payload: Dict) {
        super(bot, payload);
        this.sub_type = 'action'
        this.event_id = payload.event_id
        this.notice_id = payload.id
        this.data = payload.data
    }

    /**
     * 回应操作
     * @param code {0|1|2|3|4|5} 结果编码，释义见官网，默认0
     */
    async reply(code: ActionNoticeEvent.ReplyCode = 0) {
        if (this.replied) return true
        this.replied = true
        return this.bot.replyAction(this.notice_id, code)
    }
}

export class FriendActionNoticeEvent extends ActionNoticeEvent {
    operator_id: string
    notice_type: 'friend' = 'friend'

    constructor(bot: Bot, payload: Dict) {
        super(bot, payload)
        this.operator_id = payload.user_openid
        bot.emit(`notice.${this.notice_type}`, this)
        bot.emit(`notice.${this.notice_type}.action`, this)
        bot.logger.info(`好友${this.operator_id} 点击了消息按钮：${this.data.resolved.button_id}`)
    }
}
export class GroupActionNoticeEvent extends ActionNoticeEvent {
    group_id: string
    operator_id: string
    notice_type: 'group' = 'group'

    constructor(bot: Bot, payload: Dict) {
        super(bot, payload)
        this.group_id = payload.group_openid
        this.operator_id = payload.group_member_openid
        bot.emit(`notice.${this.notice_type}`, this)
        bot.emit(`notice.${this.notice_type}.action`, this)
        bot.logger.info(`群(${this.group_id})成员${this.operator_id} 点击了消息按钮：${this.data.resolved.button_id}`)
    }
}

export class GuildActionNoticeEvent extends ActionNoticeEvent {
    guild_id: string
    channel_id: string
    operator_id: string
    notice_type: 'guild' = 'guild'

    constructor(bot: Bot, payload: Dict) {
        super(bot, payload)
        this.guild_id = payload.guild_id
        this.channel_id = payload.channel_id
        this.operator_id = payload.data.resoloved.user_id
        bot.emit(`notice.${this.notice_type}`, this)
        bot.emit(`notice.${this.notice_type}.action`, this)
        bot.logger.info(`频道(${this.guild_id})成员${this.operator_id}在子频道(${this.channel_id})点击了消息按钮：${this.data.resolved.button_id}`)
    }
}

export namespace ActionNoticeEvent {
    export type ReplyCode = 0 | 1 | 2 | 3 | 4 | 5
    export type ActionData = {
        type:number
        resolved:{
            button_data?: string
            button_id: string
            user_id?: string
            feature_id?: string
            message_id?: string
        }
    }
    export const parse: EventParser = function (this: Bot, event: string, payload) {
        switch (payload.scene) {
            case "c2c":
                return new FriendActionNoticeEvent(this, payload)
            case "group":
                return new GroupActionNoticeEvent(this, payload)
            case "guild":
                return new GuildActionNoticeEvent(this, payload)
        }
    }
}
export class FriendReceiveNoticeEvent extends NoticeEvent{
    user_id: string
    time: number
    get actionText(){
        return this.sub_type===`receive_open`?'开启':'关闭'
    }
    constructor(bot: Bot, sub_type: 'receive_open' | 'receive_close', payload: Dict) {
        super(bot, payload);
        this.notice_type = 'friend'
        this.sub_type = sub_type
        this.user_id = payload.openid
        this.time = Math.floor(payload.timestamp / 1000)
        bot.logger.info(`好友${this.actionText}主动消息接收：${this.user_id}`)
    }
}
export namespace FriendReceiveNoticeEvent {
    export const parse: EventParser = function (this: Bot, event: string, payload) {
        switch (event) {
            case "notice.friend.receive_open":
                return new FriendReceiveNoticeEvent(this, 'receive_open', payload)
            case "notice.friend.receive_close":
                return new FriendReceiveNoticeEvent(this, 'receive_close', payload)
        }
    }
}
export class FriendChangeNoticeEvent extends NoticeEvent {
    user_id: string
    time: number
    get actionText(){
        return this.sub_type===`increase`?'新增':'减少'
    }
    constructor(bot: Bot, sub_type: 'increase' | 'decrease', payload: Dict) {
        super(bot, payload);
        this.notice_type = 'friend'
        this.sub_type = sub_type
        this.user_id = payload.openid
        this.time = Math.floor(payload.timestamp / 1000)
        bot.logger.info(`好友${this.actionText}：${this.user_id}`)
    }
}

export namespace FriendChangeNoticeEvent {
    export const parse: EventParser = function (this: Bot, event: string, payload) {
        switch (event) {
            case "notice.friend.increase":
                return new FriendChangeNoticeEvent(this, 'increase', payload)
            case "notice.friend.decrease":
                return new FriendChangeNoticeEvent(this, 'decrease', payload)
        }
    }
}
export class GroupReceiveNoticeEvent extends NoticeEvent {
    group_id: string
    operator_id: string
    time: number
    get actionText(){
        return this.sub_type===`receive_open`?'开启':'关闭'
    }
    constructor(bot: Bot, sub_type: 'receive_open' | 'receive_close', payload: Dict) {
        super(bot, payload);
        this.notice_type = 'group'
        this.sub_type = sub_type
        this.group_id = payload.group_openid
        this.operator_id = payload.op_member_openid
        this.time = Math.floor(payload.timestamp / 1000)
        bot.logger.info(`群${this.actionText}主动消息接收：${this.group_id}. 操作人：${this.operator_id}`)
    }
}
export namespace GroupReceiveNoticeEvent {
    export const parse: EventParser = function (this: Bot, event: string, payload) {
        switch (event) {
            case "notice.group.receive_open":
                return new GroupReceiveNoticeEvent(this, 'receive_open', payload)
            case "notice.group.receive_close":
                return new GroupReceiveNoticeEvent(this, 'receive_close', payload)
        }
    }
}
export class GroupChangeNoticeEvent extends NoticeEvent {
    group_id: string
    operator_id: string
    time: number
    get actionText(){
        return this.sub_type===`increase`?'新增':'减少'
    }
    constructor(bot: Bot, sub_type: 'increase' | 'decrease', payload: Dict) {
        super(bot, payload);
        this.notice_type = 'group'
        this.sub_type = sub_type
        this.group_id = payload.group_openid
        this.operator_id = payload.op_member_openid
        this.time = Math.floor(payload.timestamp / 1000)
        bot.logger.info(`群${this.actionText}：${this.group_id}. 操作人：${this.operator_id}`)
    }
}

export namespace GroupChangeNoticeEvent {
    export const parse: EventParser = function (this: Bot, event, payload) {
        switch (event) {
            case "notice.group.increase":
                return new GroupChangeNoticeEvent(this, 'increase', payload)
            case "notice.group.decrease":
                return new GroupChangeNoticeEvent(this, 'decrease', payload)
        }
    }
}

export class GuildChangeNoticeEvent extends NoticeEvent {
    guild_id: string
    guild_name: string
    operator_id: string
    time: number
    sub_type: 'increase' | 'update' | 'decrease'
    get actionText(){
        return this.sub_type===`increase`?'新增':this.sub_type===`update`?'更新':'减少'
    }
    constructor(bot: Bot, sub_type: 'increase' | 'decrease' | 'update', payload: Dict) {
        super(bot, payload);
        this.notice_type = 'guild'
        this.sub_type = sub_type
        this.guild_id = payload.id
        this.guild_name = payload.name
        this.operator_id = payload.op_user_id
        this.time = Math.floor(new Date(payload.joined_at).getTime() / 1000)
        bot.logger.info(`频道${this.actionText}：${this.guild_id}. 操作人：${this.operator_id}`)
    }
}

export namespace GuildChangeNoticeEvent {
    export const parse: EventParser = function (this: Bot, event, payload) {
        switch (event) {
            case "notice.guild.increase":
                return new GuildChangeNoticeEvent(this, 'increase', payload)
            case "notice.guild.update":
                return new GuildChangeNoticeEvent(this, 'update', payload)
            case "notice.guild.decrease":
                return new GuildChangeNoticeEvent(this, 'decrease', payload)
        }
    }
}

export class ChannelChangeNoticeEvent extends NoticeEvent {
    guild_id: string
    channel_id: string
    channel_name: string
    channel_type: number // 0 普通频道 2 语音频道 5 直播频道
    operator_id: string
    time: number
    sub_type: ChannelChangeNoticeEvent.SubType

    get actionText(){
        switch (this.sub_type){
            case 'increase':
                return '新增'
            case 'update':
                return '更新'
            case 'decrease':
                return '减少'
            case "enter":
                return '进入'
            case "exit":
                return '离开'
        }
    }
    constructor(bot: Bot, sub_type: ChannelChangeNoticeEvent.SubType, payload: Dict) {
        super(bot, payload);
        this.notice_type = 'channel'
        this.sub_type = sub_type
        this.guild_id = payload.guild_id
        this.channel_id = payload.channel_id || payload.id
        this.channel_type = payload.channel_type || 0
        this.channel_name = payload.channel_name || payload.name
        this.operator_id = payload.op_user_id || payload.user_id
        this.time = Math.floor(new Date(payload.joined_at).getTime() / 1000)
        bot.logger.info(`${this.actionText}：${this.guild_id}. 操作人：`)
        if(['enter','exit'].includes(this.sub_type)){
            bot.logger.info(`用户${this.actionText}子频道：${this.channel_id}`)
        }else{
            bot.logger.info(`子频道${this.actionText}：${this.channel_id}. 操作人：${this.operator_id}`)
        }
    }
}

export namespace ChannelChangeNoticeEvent {
    export type SubType = 'increase' | 'update' | 'decrease' | 'enter' | 'exit'
    export const parse: EventParser = function (this: Bot, event, payload) {
        switch (event) {
            case "notice.channel.increase":
                return new ChannelChangeNoticeEvent(this, 'increase', payload)
            case "notice.channel.update":
                return new ChannelChangeNoticeEvent(this, 'update', payload)
            case "notice.channel.decrease":
                return new ChannelChangeNoticeEvent(this, 'decrease', payload)
            case "notice.channel.enter":
                return new ChannelChangeNoticeEvent(this, 'enter', payload)
            case "notice.channel.exit":
                return new ChannelChangeNoticeEvent(this, 'exit', payload)
        }
    }
}

export class GuildMemberChangeNoticeEvent extends NoticeEvent {
    guild_id: string
    operator_id: string
    user_id: string
    user_name: string
    is_bot: boolean
    time: number
    sub_type: 'member.increase' | 'member.update' | 'member.decrease'
    get actionText(){
        return this.sub_type===`member.increase`?'加入':this.sub_type==='member.update'?'变更':'退出'
    }
    constructor(bot: Bot, sub_type: 'member.increase' | 'member.decrease' | 'member.update', payload: Dict) {
        super(bot, payload);
        this.notice_type = 'guild'
        this.sub_type = sub_type
        this.guild_id = payload.guild_id
        this.operator_id = payload.op_user_id
        this.time = Math.floor(new Date(payload.joined_at).getTime() / 1000)
        this.user_id = payload.user.id
        this.user_name = payload.user.nickname
        this.is_bot = payload.user.bot
        bot.logger.info(`频道(${this.guild_id})成员(${this.user_id})${this.actionText}. 操作人：${this.operator_id}`)
    }
}

export namespace GuildMemberChangeNoticeEvent {
    export const parse: EventParser = function (this: Bot, event, payload) {
        switch (event) {
            case "notice.guild.member.increase":
                return new GuildMemberChangeNoticeEvent(this, 'member.increase', payload)
            case "notice.guild.member.update":
                return new GuildMemberChangeNoticeEvent(this, 'member.update', payload)
            case "notice.guild.member.decrease":
                return new GuildMemberChangeNoticeEvent(this, 'member.decrease', payload)
        }
    }
}

export class ForumNoticeEvent extends NoticeEvent {
    guild_id: string
    channel_id: string
    author_id: string
    sub_type: ForumNoticeEvent.SubType

    constructor(bot: Bot, payload: Dict) {
        super(bot, payload);
        this.notice_type = 'forum'
        this.guild_id = payload.guild_id
        this.channel_id = payload.channel_id
        this.author_id = payload.author_id
    }
}

export namespace ForumNoticeEvent {
    export type SubType =
        'thread.create'
        | 'thread.delete'
        | 'thread.update'
        | 'post.create'
        | 'post.delete'
        | 'reply.create'
        | 'reply.delete'
        | 'audit'
    export const parse: EventParser = function (this: Bot, event, payload) {
        switch (event) {
            case "notice.forum":
                const noticeEvent=new ForumNoticeEvent(this, payload)
                this.logger.info(`用户:${noticeEvent.author_id}操作了论坛内容`)
                return noticeEvent
            case "notice.forum.thread.create":
                return new ThreadChangeNoticeEvent(this, 'create', payload)
            case "notice.forum.thread.update":
                return new ThreadChangeNoticeEvent(this, 'update', payload)
            case "notice.forum.thread.delete":
                return new ThreadChangeNoticeEvent(this, 'delete', payload)
            case "notice.forum.post.create":
                return new PostChangeNoticeEvent(this, 'create', payload)
            case "notice.forum.post.delete":
                return new ThreadChangeNoticeEvent(this, 'delete', payload)
            case "notice.forum.reply.create":
                return new ReplyChangeNoticeEvent(this, 'create', payload)
            case "notice.forum.reply.delete":
                return new ReplyChangeNoticeEvent(this, 'create', payload)
            case "notice.forum.audit":
                return new FormAuditNoticeEvent(this, payload)
        }
    }
}

export class ThreadChangeNoticeEvent extends ForumNoticeEvent {
    thread_id: string
    title: string
    content: string
    time: number
    get actionText(){
        return this.sub_type==='thread.create'?'创建':this.sub_type==='thread.update'?'更新':'删除'
    }
    constructor(bot: Bot, sub_type: 'create' | 'update' | 'delete', payload: Dict) {
        super(bot, payload);
        this.sub_type = `thread.${sub_type}`
        this.thread_id = payload.thread_info.thread_id
        this.title = payload.thread_info.title
        this.content = payload.thread_info.content
        this.time = Math.floor(new Date(payload.thread_info.date_time).getTime() / 1000)
        bot.logger.info(`用户${this.author_id}${this.actionText}了主题(${this.thread_id})`)
    }
}

export class PostChangeNoticeEvent extends ForumNoticeEvent {
    thread_id: string
    post_id: string
    content: string
    time: number
    get actionText(){
        return this.sub_type==='post.create'?'发布':'删除'
    }
    constructor(bot: Bot, sub_type: 'create' | 'delete', payload: Dict) {
        super(bot, payload);
        this.sub_type = `post.${sub_type}`
        this.thread_id = payload.post_info.thread_id
        this.post_id = payload.post_info.post_id
        this.content = payload.post_info.content
        this.time = Math.floor(new Date(payload.post_info.date_time).getTime() / 1000)
        bot.logger.info(`用户${this.author_id}${this.actionText}了帖子(${this.post_id})`)
    }
}

export class ReplyChangeNoticeEvent extends ForumNoticeEvent {
    thread_id: string
    post_id: string
    reply_id: string
    content: string
    time: number
    get actionText(){
        return this.sub_type==='reply.create'?'创建':'删除'
    }
    constructor(bot: Bot, sub_type: 'create' | 'delete', payload: Dict) {
        super(bot, payload);
        this.sub_type = `reply.${sub_type}`
        this.thread_id = payload.reply_info.thread_id
        this.post_id = payload.reply_info.post_id
        this.reply_id = payload.reply_info.reply_id
        this.content = payload.reply_info.content
        this.time = Math.floor(new Date(payload.reply_info.date_time).getTime() / 1000)
        bot.logger.info(`用户${this.author_id})${this.actionText}了回复(${this.reply_id})`)
    }
}

export class FormAuditNoticeEvent extends ForumNoticeEvent {
    thread_id: string
    post_id: string
    reply_id: string
    type: AuditType
    /** 审核结果： 0 成功 1 失败 */
    result: 0 | 1
    message?: string
    get typeText(){
        if(this.type===AuditType.Thread) return '主题'
        if(this.type===AuditType.Post) return '帖子'
        if(this.type===AuditType.Reply) return '回复'
    }
    constructor(bot: Bot, payload: Dict) {
        super(bot, payload)
        this.sub_type = 'audit'
        this.thread_id = payload.thread_id
        this.post_id = payload.post_id
        this.reply_id = payload.reply_id
        this.type = payload.type
        this.result = payload.result
        this.message = payload.err_msg
        bot.logger.info(`${this.typeText}审核${this.result===0?'通过':'拒绝'}. ${this.message||''}`)
    }
}

export class MessageReactionNoticeEvent extends NoticeEvent{
    user_id:string
    message_id:string
    channel_id:string
    sub_type:'add'|'remove'
    guild_id:string
    emoji:Emoji
    constructor(bot:Bot,sub_type:'add'|'remove',payload:Dict) {
        super(bot,payload);
        this.notice_type='channel'
        this.sub_type = sub_type
        this.guild_id = payload.guild_id
        this.channel_id = payload.channel_id
        this.user_id = payload.user_id
        if(![ReactionTargetType.Message, ReactionTargetType.ReactionTargetType_MSG].includes(payload.target.type)) throw new Error(`unsupported reaction target type: ${payload.target.type}`)
        this.message_id = payload.target.id
        this.emoji = payload.emoji
    }
}
export namespace MessageReactionNoticeEvent{
    export const parse: EventParser = function (this: Bot, event, payload) {
        switch (event) {
            case "notice.reaction.add":
                const addEvent=new MessageReactionNoticeEvent(this,'add', payload)
                this.logger.info(`用户:${addEvent.user_id}创建了表情表态`)
                return addEvent
            case 'notice.reaction.remove':
                const removeEvent=new MessageReactionNoticeEvent(this,'remove', payload)
                this.logger.info(`用户:${removeEvent.user_id}删除了表情表态`)
                return removeEvent
            default:
                throw new Error(`can not parse event ${event}`)
        }
    }
}
