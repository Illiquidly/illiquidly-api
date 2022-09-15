"use strict";

import "dotenv/config";

import { WebSocketClient } from "@terra-money/terra.js";
import { createRedisClient } from "../../utils/redis_db_accessor";
import { ws, contracts } from "../../utils/blockchain/chains";
import { Network } from "../../utils/blockchain/dto/network.dto";

export interface QueueMessage {
  message: string;
  network: Network;
}

async function main() {
  const db = await createRedisClient();

  // P2P Transaction tracker
  // We subscribe to each network

  Object.entries(contracts).forEach(value => {
    const [chain, contracts] = value;

    const wsclient = new WebSocketClient(ws[chain], -1, 8000);

    if (contracts.p2pTrade) {
      wsclient.subscribeTx(
        {
          "message.action": "/cosmwasm.wasm.v1.MsgExecuteContract",
          "wasm._contract_address": contracts.p2pTrade,
        },
        async () => {
          // If we get a new transaction on the contract, we send a message to the worker
          const message: QueueMessage = {
            message: process.env.TRIGGER_P2P_TRADE_QUERY_MSG,
            network: Network[chain],
          };
          await db.publish(process.env.P2P_QUEUE_NAME, JSON.stringify(message));
          console.log("New contract transaction");
        },
      );
      console.log(chain);
      wsclient.start();
    }
  });
}
main();
