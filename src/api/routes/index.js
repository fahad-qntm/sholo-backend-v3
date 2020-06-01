const express = require('express')
const router = express.Router()
const users = require('./users/users.controller')
const backTest = require('./backtest/backtest.controller')
// const bots = require('./bots/bots.controller')
// const accounts = require('./accounts/accounts.controller')
router.use('/users', users)
router.use('/backtest', backTest)
/*
router.use('/bots', bots)
router.use('/accounts', accounts)*/
module.exports = router
