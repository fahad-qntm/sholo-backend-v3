const { DBSchemas } = require('../../db/index')
const { AccountSchema } = DBSchemas
const { ResponseMessage } = require('../../../utils')
const { Bitmex, Binance } = require('../../../exchange')
const {
    ALLOWED_EXCHANGES,
    BINANCE_EXCHANGE,
    BITMEX_EXCHANGE
} = require('../../../constants')
const ccxt = require('ccxt')

async function createNewAccount(req, res, next) {
    const {
        exchange,
        accountName,
        accountType,
        apiKey,
        apiSecret,
        testNet
    } = req.body
    try {
        const findAcc = await AccountSchema.findOne({ apiKey, apiSecret })
        if (findAcc)
            return res
                .status(500)
                .json(
                    ResponseMessage(true, 'This account has already been added')
                )
        if (!ALLOWED_EXCHANGES.includes(exchange))
            return res
                .status(500)
                .json(
                    ResponseMessage(true, 'This exchange is not supported yet!')
                )
        let exchangeClass
        switch (exchange) {
            case BITMEX_EXCHANGE:
                exchangeClass = new Bitmex({
                    apiKey,
                    secret: apiSecret,
                    enableRateLimit: true
                })
                break
            case BINANCE_EXCHANGE:
                exchangeClass = new Binance({
                    apiKey,
                    secret: apiSecret,
                    enableRateLimit: true
                })
                break
        }
        if (testNet) exchangeClass.setTestNet()

        const balance = await exchangeClass.getFetchBalance()
        const userID = res.locals.user._id
        const createRes = await new AccountSchema({
            accountName,
            accountType,
            exchange,
            apiKey,
            apiSecret,
            userID,
            balance,
            testNet
        }).save()
        const { _id } = createRes
        return createRes
            ? res.json(
                  ResponseMessage(false, 'Created Account', {
                      account: {
                          _id,
                          accountName,
                          exchange,
                          apiKey,
                          apiSecret,
                          userID,
                          testNet,
                          balance
                      }
                  })
              )
            : res.json(ResponseMessage(true, 'Error creating an account'))
    } catch (e) {
        if (e instanceof ccxt.AuthenticationError) {
            return res.json(
                ResponseMessage(
                    true,
                    'Error creating an account, API Key/Secret is invalid'
                )
            )
        }
        next(e)
    }
}

module.exports = {
    createNewAccount
}