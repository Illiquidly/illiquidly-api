declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // API OPTIONS
      UPDATE_DESPITE_LOCK_TIME: number;
      IDLE_UPDATE_INTERVAL: number;
      QUERY_TIMEOUT: number;
      ENVIRONMENT: "staging" | "PRODUCTION";

      // Database options
      DB_VERSION: string;

      // Redis queues and set hashes
      P2P_QUEUE_NAME: string;
      TRIGGER_P2P_TRADE_QUERY_MSG: string;
      REDIS_TXHASH_SET: string;
      REDIS_NOTIFICATION_TXHASH_SET: string;
      FLUSH_DB_ON_STARTUP: "true" | "false";
    }
  }
}
