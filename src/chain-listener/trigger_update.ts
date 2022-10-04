"use strict";

import "dotenv/config";
import Redis from "ioredis";
import { Network } from "../utils/blockchain/dto/network.dto";

import { QueueMessage } from "./websocket-listener.service";

let network: Network;
if (process.argv[2]) {
  network = Network[process.argv[2]];
} else {
  network = Network.devnet;
}

async function main() {
  // We send a message to the worker
  const db = new Redis();
  const message: QueueMessage = {
    message: process.env.TRIGGER_P2P_TRADE_QUERY_MSG,
    network,
  };
  await db.publish(process.env.P2P_QUEUE_NAME, JSON.stringify(message));
  console.log("Message sent");
  db.quit();
  console.log(db.status);
}

main();
