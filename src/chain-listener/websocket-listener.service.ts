"use strict";

import "dotenv/config";

import { WebSocketClient } from "@terra-money/terra.js";

export interface QueueMessage {
  message: string;
  network: Network;
}
import { Injectable } from "@nestjs/common";
import { Network } from "../utils/blockchain/dto/network.dto";
import { contracts, ws } from "../utils/blockchain/chains";
import Redis from "ioredis";
import { InjectRedis } from "@liaoliaots/nestjs-redis";

@Injectable()
export class WebsocketListenerService {
  constructor(@InjectRedis("trade-publisher") private readonly redisPublisher: Redis) {
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
            await this.redisPublisher.publish(process.env.P2P_QUEUE_NAME, JSON.stringify(message));
            console.log("New contract transaction");
          },
        );
        console.log("Subscribed to the Trade contract on", chain);
        wsclient.start();
      }
    });
  }
}
