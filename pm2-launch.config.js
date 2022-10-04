module.exports = {
  apps : [{
    name   : "illiquidly-api",
    script : "npm run start",
  },{
    name   : "regular-trade-updates",
    script : "node dist/chain-listener/trigger_update testnet",
    cron_restart: '*/30 * * * * *',
    "autorestart" : false
  }
]
}