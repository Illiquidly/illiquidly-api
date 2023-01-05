import { registerAs } from "@nestjs/config";

export const redisQueueConfig = registerAs("redisConfig", () => ({
  // Redis queues and set hashes
  CONTRACT_UPDATE_QUEUE_NAME: process.env.CONTRACT_UPDATE_QUEUE_NAME,

  // For Trades
  TRIGGER_P2P_TRADE_QUERY_MSG: process.env.TRIGGER_P2P_TRADE_QUERY_MSG,
  REDIS_TRADE_TXHASH_SET: process.env.REDIS_TRADE_TXHASH_SET,
  REDIS_TRADE_NOTIFICATION_TXHASH_SET: process.env.REDIS_TRADE_NOTIFICATION_TXHASH_SET,

  // For Raffles
  TRIGGER_RAFFLE_QUERY_MSG: process.env.TRIGGER_RAFFLE_QUERY_MSG,
  REDIS_RAFFLE_TXHASH_SET: process.env.REDIS_RAFFLE_TXHASH_SET,
  REDIS_RAFFLE_NOTIFICATION_TXHASH_SET: process.env.REDIS_RAFFLE_NOTIFICATION_TXHASH_SET,

  // For Loans
  TRIGGER_LOAN_QUERY_MSG: process.env.TRIGGER_LOAN_QUERY_MSG,
  REDIS_LOAN_TXHASH_SET: process.env.REDIS_LOAN_TXHASH_SET,
  REDIS_LOAN_NOTIFICATION_TXHASH_SET: process.env.REDIS_LOAN_NOTIFICATION_TXHASH_SET,

  FLUSH_DB_ON_STARTUP: process.env.FLUSH_DB_ON_STARTUP == "true",
}));

export const nftContentAPIConfig = registerAs("wallet-content-config", () => ({
  UPDATE_DESPITE_LOCK_TIME: parseInt(process.env.UPDATE_DESPITE_LOCK_TIME),
  IDLE_UPDATE_INTERVAL: parseInt(process.env.IDLE_UPDATE_INTERVAL),
  QUERY_TIMEOUT: parseInt(process.env.QUERY_TIMEOUT),

  // Database options
  DB_VERSION: process.env.DB_VERSION,
}));

export const nftTransferAPIConfig = registerAs("nft-transfer-config", () => ({
  IDLE_UPDATE_INTERVAL: parseInt(process.env.NFT_TRANSFER_IDLE_UPDATE_INTERVAL),
  TXHASH_SET_NAME: process.env.NFT_TRANSFER_TXHASH_SET_NAME,
}));

export const signingTerraConfig = registerAs("signing-terra-config", () => ({
  testnet: process.env.TERRA_TESTNET_MNEMONIC,
}));
