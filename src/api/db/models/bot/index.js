const mongoose = require('mongoose')
const { ALLOWED_EXCHANGES } = require('../../../../constants')
const AutoIncrement = require('mongoose-sequence')(mongoose)

const BotSchema = new mongoose.Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    _accountId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Account'
    },
    _botConfigId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'bot-config'
    },
    _botSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'bot-config-session'
    },
    side: {
        type: String,
        required: true,
        enum: ['long', 'short']
    },
    // s1 or l1
    order: {
        type: String
    },
    enabled: {
        type: Boolean,
        default: false
    },
    symbol: { type: String, required: true },
    initialBalance: { type: String },
    balance: { type: String },
    exchange: { type: String, required: true, enum: [...ALLOWED_EXCHANGES] },
    entryPrice: { type: Number, required: true },
    priceP: { type: Number, required: true },
    exitPrice: { type: Number },
    leverage: { type: Number, default: 1, max: 100, min: 1 },
    liquidationPrice: { type: Number, default: 0 },
    liquidationStats: { type: Object },
    liquidated: false,
    realisedPnl: { type: Number, default: 0 },
    marketThreshold: {
        type: Number
    },
    feeType: { type: String, required: true, enum: ['maker', 'taker'] },
    active: {
        type: Boolean,
        default: false
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
})
BotSchema.plugin(AutoIncrement, {
    id: 'botCounter',
    inc_field: 'id'
})
const BotConfig = mongoose.model('bot', BotSchema)
module.exports = BotConfig