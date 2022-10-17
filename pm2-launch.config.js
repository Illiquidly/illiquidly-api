module.exports = {
  apps : [{
    name   : "illiquidly-api",
    script : "npm run start",
  },
{
    name   : "regular-trade-updates-testnet",
    script : "node dist/chain-listener/trigger_update testnet",
    cron_restart: '*/30 * * * * *',
    "autorestart" : false
  },
{
    name   : "regular-trade-updates-mainnet",
    script : "node dist/chain-listener/trigger_update mainnet",
    cron_restart: '*/30 * * * * *',
    "autorestart" : false
  }
]
}
