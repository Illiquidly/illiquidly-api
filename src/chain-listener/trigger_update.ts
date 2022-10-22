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

  // We register a Trade Message
  const tradeMessage: QueueMessage = {
    message: process.env.TRIGGER_P2P_TRADE_QUERY_MSG,
    network,
  };
  await db.publish(process.env.CONTRACT_UPDATE_QUEUE_NAME, JSON.stringify(tradeMessage));

  // We register a Raffle Message
  const raffleMessage: QueueMessage = {
    message: process.env.TRIGGER_RAFFLE_QUERY_MSG,
    network,
  };
  await db.publish(process.env.CONTRACT_UPDATE_QUEUE_NAME, JSON.stringify(raffleMessage));

  console.log("Messages sent (trade and raffle)");
  db.quit();
  console.log(db.status);
}

main();
