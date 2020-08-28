const { DBSchemas } = require('../api/db')
const { BotSchema, UserSchema } = DBSchemas
const { fork } = require('child_process')
const { Logger } = require('../utils')
const parentBotLogDir = require('path').resolve(__dirname, '../../.logs/bots/')
const parentBotsDir = require('path').resolve(__dirname, '../../src/bot')
const fs = require('fs')
const SocketIOConnection = require('../../src/socketio')
const { SendEmail, BodyTemplates } = require('../email')
const HEART_BEAT = 15000 //milliseconds
const { PriceReachedEmail } = BodyTemplates
let botCoordinator = null

class BotCoordinator {
    _exitGracefully() {
        Logger.info(`Exiting gracefully`)
        const connection = SocketIOConnection.connection()
        for (let key of Object.keys(this.bots)) {
            Logger.info(`Exiting gracefully ${key}`)
            for (let id of Object.keys(connection.sockets))
                connection.sockets[id].emit(
                    `${key}`,
                    JSON.stringify({
                        type: 'update',
                        bot: { active: false, _id: key }
                    })
                )
            this.stopBot(key)
        }
    }

    _processHandlers() {
        const events = [
            `exit`,
            `SIGINT`,
            `SIGUSR1`,
            `SIGUSR2`,
            `uncaughtException`,
            `SIGTERM`
        ]
        events.forEach((eventType) => {
            process.on(eventType, (event, exitCode) => {
                Logger.info(
                    `Event type happened ${eventType} : ${event} with code ${exitCode}`
                )
                this._exitGracefully()
            })
        })
    }

    startBot(bot) {
        Logger.info(`start bot  ${bot.order}, botID : ${bot._id}`)
        const connection = SocketIOConnection.connection()
        // const out = fs.openSync(`${parentBotLogDir}\\out_${bot._id}.log`, 'a')
        // const err = fs.openSync(`${parentBotLogDir}\\err_${bot._id}.log`, 'a')
        this.bots[bot._id] = fork(
            parentBotsDir,
            [parentBotsDir, JSON.stringify(bot)],
            {
                detached: true,
                stdio: ['ignore', 'ignore', 'ignore', 'ipc']
            }
        )
        this.bots[bot._id].on('message', async ({ command, args }) => {
            const { channel, message } = args
            switch (command) {
                case 'socket':
                    for (let id of Object.keys(connection.sockets))
                        connection.sockets[id].emit(
                            channel,
                            JSON.stringify(message)
                        )
                    break
                case 'email':
                    const {
                        account,
                        bot,
                        price,
                        liquidated,
                        whatPrice
                    } = message
                    const user = await UserSchema.findById({
                        _id: account._userId
                    })
                    const { notificationEmails, notificationEnabled } = user
                    if (notificationEnabled)
                        await SendEmail(
                            'fmohajir@gmail.com',
                            notificationEmails,
                            'Sholo: Email notification',
                            PriceReachedEmail(
                                user.name,
                                whatPrice,
                                price,
                                liquidated,
                                account
                            )
                        )
                    break
            }
        })
    }

    stopBot(botId) {
        try {
            this.bots[botId].send({ command: 'stop', args: { botId } })
        } catch (e) {
            Logger.error(`Error Stopping bot with id: ${botId}`)
            Logger.error('Error ', e)
            BotSchema.findById({ _id: botId }).then((bot) => {
                if (!bot.liquidated && !bot.priceRReached) {
                    this.startBot(bot)
                }
            })
        }
    }

    async killSwitch() {
        for (let key of Object.keys(this.bots)) {
            await this.bots[key].send({ command: 'stop', args: { botId: key } })
            delete this.bots[key]
        }
    }

    restartBot(botId) {
        this.bots[botId].send({ command: 'stop', args: { botId } })
        delete this.bots[botId]
    }

    initializeBots() {
        this._processHandlers()
        setInterval(() => {
            BotSchema.find({})
                .then((bots) => {
                    // Logger.info(` bots length ${bots.length}`)
                    let enabledAndInactiveBots = bots.filter(
                        (bot) => bot.enabled && !bot.active
                    )
                    let disabledAndActiveBots = bots.filter(
                        (bot) => !bot.enabled && bot.active
                    )
                    if (enabledAndInactiveBots.length > 0) {
                        Logger.info(
                            `Enabled and inactive bots: ${enabledAndInactiveBots.length}`
                        )
                        enabledAndInactiveBots.map((bot) => {
                            try {
                                this.startBot(bot)
                            } catch (err) {
                                console.log(err)
                            }
                        })
                    }
                    if (
                        disabledAndActiveBots.length > 0 &&
                        Object.keys(this.bots).length !== 0
                    ) {
                        Logger.info(
                            `Disabled and active bots: ${disabledAndActiveBots.length}`
                        )
                        disabledAndActiveBots.map((bot) => {
                            this.stopBot(bot._id)
                        })
                    }
                })
                .catch((err) => {
                    Logger.error('Error ', err)
                    throw new Error('Error starting/stopping up active bots')
                })
        }, HEART_BEAT)
    }

    constructor() {
        this.bots = {}
        this.initializeBots()
    }

    static init() {
        if (!botCoordinator) {
            botCoordinator = new BotCoordinator()
        }
    }

    static getCoordinator() {
        if (!botCoordinator) {
            throw new Error('no active coordinator')
        }
        return botCoordinator
    }
}

module.exports = {
    initialize: BotCoordinator.init,
    coordinator: BotCoordinator.getCoordinator
}
