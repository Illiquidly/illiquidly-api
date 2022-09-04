"use strict";

import "dotenv/config";
import { Network } from "../../utils/blockchain/dto/network.dto";

import { createRedisClient, quitDB } from "../../utils/redis_db_accessor";
import { QueueMessage } from "./websocket-server";

let network: Network;
if (process.argv[2]) {
  network = Network[process.argv[2]];
} else {
  network = Network['devnet'];
}

async function main() {
  // We send a message to the worker
  let db = createRedisClient();
  let message: QueueMessage = {
    message: process.env.TRIGGER_P2P_TRADE_QUERY_MSG,
    network,
  }
  await db.publish(process.env.P2P_QUEUE_NAME!, JSON.stringify(message));
  console.log("Message sent");
  db.quit();
  console.log(db.status)
}

main();
