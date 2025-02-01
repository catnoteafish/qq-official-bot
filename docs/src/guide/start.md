---
layout: doc
---
# 快速开始
由于 `qq-official-bot` 是基于 `NodeJS` 编写，要使用 "qq-official-bot"，你可以按照以下步骤进行操作：
## 1. 安装 Node.js
首先，确保你的计算机上已经安装了 Node.js。你可以在 Node.js 的官方网站上下载并安装适合你操作系统的版本。
## 2. 创建新项目
在你的项目文件夹中，打开终端或命令行界面，并运行以下命令来初始化一个新的 Node.js 项目：
```shell
npm init # 这将会引导你创建一个新的 `package.json` 文件，用于管理你的项目依赖和配置。
```
## 3. 安装 `qq-official-bot` 包
运行以下命令来安装 `qq-official-bot` 包:
```shell
npm install qq-official-bot
```
## 4. 编写代码
创建一个 JavaScript 或 TypeScript 文件（例如 bot.js），并在其中编写你的 QQ 群机器人代码。你可以使用下面的示例代码作为起点：


### 4.1 link with websocket
```js
const {Bot} = require('qq-official-bot')
// 创建机器人
const bot = new Bot({
	appid: '', // qq机器人的appID (必填)
	secret: '', // qq机器人的secret (必填)
	sandbox: true, // 是否是沙箱环境 默认 false
	removeAt: true, // 移除第一个at 默认 false
	logLevel: 'info', // 日志等级 默认 info
	maxRetry: 10, // 最大重连次数 默认 10
	intents: [
		'GROUP_AT_MESSAGE_CREATE', // 群聊@消息事件 没有群权限请注释
		'C2C_MESSAGE_CREATE', // 私聊事件 没有私聊权限请注释
		'GUILD_MESSAGES', // 私域机器人频道消息事件 公域机器人请注释
		'PUBLIC_GUILD_MESSAGES', // 公域机器人频道消息事件 私域机器人请注释
		'DIRECT_MESSAGE', // 频道私信事件
        'MESSAGE_AUDIT', // 消息审核事件
		'GUILD_MESSAGE_REACTIONS', // 频道消息表态事件
		'GUILDS', // 频道变更事件
		'GUILD_MEMBERS', // 频道成员变更事件
		'DIRECT_MESSAGE', // 频道私信事件
	], // (必填)
	mode:'websocket',
})
// 启动机器人
bot.start()
```
### 4.2 link with webhook
```js
const {Bot} = require('qq-official-bot')
// 创建机器人
const bot = new Bot({
	appid: '', // qq机器人的appID (必填)
	secret: '', // qq机器人的secret (必填)
	sandbox: true, // 是否是沙箱环境 默认 false
	removeAt: true, // 移除第一个at 默认 false
	logLevel: 'info', // 日志等级 默认 info
	maxRetry: 10, // 最大重连次数 默认 10
	intents: [
		'GROUP_AT_MESSAGE_CREATE', // 群聊@消息事件 没有群权限请注释
		'C2C_MESSAGE_CREATE', // 私聊事件 没有私聊权限请注释
		'GUILD_MESSAGES', // 私域机器人频道消息事件 公域机器人请注释
		'PUBLIC_GUILD_MESSAGES', // 公域机器人频道消息事件 私域机器人请注释
		'DIRECT_MESSAGE', // 频道私信事件
        'MESSAGE_AUDIT', // 消息审核事件
		'GUILD_MESSAGE_REACTIONS', // 频道消息表态事件
		'GUILDS', // 频道变更事件
		'GUILD_MEMBERS', // 频道成员变更事件
		'DIRECT_MESSAGE', // 频道私信事件
	], // (必填)
	mode:'webhook',
    port: 3000, // webhook监听端口
    path: '/webhook', // webhook监听路径
})
// 启动机器人
bot.start()
```
### 4.3 link with express/koa
```js
const {Bot} = require('qq-official-bot')
const express = require('express')
// 创建机器人
const bot = new Bot({
	appid: '', // qq机器人的appID (必填)
	secret: '', // qq机器人的secret (必填)
	sandbox: true, // 是否是沙箱环境 默认 false
	removeAt: true, // 移除第一个at 默认 false
	logLevel: 'info', // 日志等级 默认 info
	maxRetry: 10, // 最大重连次数 默认 10
	intents: [
		'GROUP_AT_MESSAGE_CREATE', // 群聊@消息事件 没有群权限请注释
		'C2C_MESSAGE_CREATE', // 私聊事件 没有私聊权限请注释
		'GUILD_MESSAGES', // 私域机器人频道消息事件 公域机器人请注释
		'PUBLIC_GUILD_MESSAGES', // 公域机器人频道消息事件 私域机器人请注释
		'DIRECT_MESSAGE', // 频道私信事件
        'MESSAGE_AUDIT', // 消息审核事件
		'GUILD_MESSAGE_REACTIONS', // 频道消息表态事件
		'GUILDS', // 频道变更事件
		'GUILD_MEMBERS', // 频道成员变更事件
		'DIRECT_MESSAGE', // 频道私信事件
	], // (必填)
	mode:'middleware',
    applacation:'express', // express/koa
})
// 启动机器人
bot.start()
express()
    .use(bot.middleware)
    .listen(3000)

```
- 注意：在配置中，你需要填写你的 `appid`和 `secret`。请确保妥善保管你的账号信息，并遵循相关使用条款和隐私政策。
- 示例中的配置仅为基础配置，更多配置信息请查看 [配置项](../config.md) 章节


