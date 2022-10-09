import { Injectable } from "@nestjs/common";
import { asyncAction } from "../utils/js/asyncAction";

import { Network } from "../utils/blockchain/dto/network.dto";
import Axios from "axios";
import { chains, contracts } from "../utils/blockchain/chains";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { TxLog } from "@terra-money/terra.js";
import { TradesService } from "../trades/trades.service";
import { QueueMessage } from "./websocket-listener.service";
import { sleep } from "../utils/js/sleep";
const pMap = require("p-map");
const _ = require("lodash");

const redisHashSetName: string = process.env.REDIS_TXHASH_SET;

async function getHashSetCardinal(db: Redis) {
  return await db.scard(redisHashSetName);
}

async function hasTx(db: Redis, txHash: string): Promise<boolean> {
  return (await db.sismember(redisHashSetName, txHash)) == 1;
}

@Injectable()
export class TradeChangesService {
  constructor(
    private readonly tradesService: TradesService,
    @InjectRedis("trade-subscriber") private readonly redisSubscriber: Redis,
    @InjectRedis("default-client") private readonly redisDB: Redis,
  ) {
    // We subsribe to the redis reg-sub channel
    this.redisSubscriber.subscribe(process.env.P2P_QUEUE_NAME, (err: any) => {
      if (err) {
        // Just like other commands, subscribe() can fail for some reasons,
        // ex network issues.
        console.error("Failed to subscribe: %s", err.message);
      } else {
        // `count` represents the number of channels this client are currently subscribed to.
        console.log(
          "Subscribed successfully! This client is currently subscribed to the trade channel.",
        );
      }
    });

    const isAlreadyQuerying = {};
    this.redisSubscriber.on("message", async (channel, message) => {
      if (channel == process.env.P2P_QUEUE_NAME) {
        const parsedMessage: QueueMessage = JSON.parse(message);
        if (
          parsedMessage.message == process.env.TRIGGER_P2P_TRADE_QUERY_MSG &&
          !isAlreadyQuerying[parsedMessage.network]
        ) {
          console.log("New Trade Message Received", new Date().toLocaleString(), parsedMessage);
          isAlreadyQuerying[parsedMessage.network] = true;
          // We await 2 seconds for the fcd to update
          await sleep(2000);
          await this.queryNewTransaction(parsedMessage.network);
          isAlreadyQuerying[parsedMessage.network] = false;
        }
      }
    });
  }

  private async queryNewTransaction(network: Network) {
    const lcd = Axios.create(
      chains[network].axiosObject ?? {
        baseURL: chains[network].URL,
      },
    );

    // We loop query the lcd for new transactions on the p2p trade contract from the last one registered, until there is no tx left
    let txToAnalyse = [];
    do {
      // We start querying after we left off
      const offset = await getHashSetCardinal(this.redisDB);
      const [err, response] = await asyncAction(
        lcd.get("/cosmos/tx/v1beta1/txs", {
          params: {
            events: `wasm._contract_address='${contracts[network].p2pTrade}'`,
            "pagination.offset": offset,
          },
        }),
      );

      console.log(offset);
      // If we get no lcd tx result
      if (err) {
        console.log(err);
        return;
      }

      // We start by querying only new transactions (We do this in two steps, as the filter function doesn't wait for async results)
      const txFilter = await Promise.all(
        response.data.tx_responses.map(async (tx: any) => !(await hasTx(this.redisDB, tx.txhash))),
      );
      txToAnalyse = response.data.tx_responses.filter((_1: any, i: number) => txFilter[i]);

      // Then we iterate over the transactions and get the trade_id and/or (trade_id, counter_id)
      const idsToQuery: number[][] = txToAnalyse
        .map((tx: any) => {
          return tx.logs
            .map((log: any): number[][] => {
              const txLog = new TxLog(log.msg_index, log.log, log.events);
              const tradeIds = (
                txLog.eventsByType.wasm.trade_id ?? txLog.eventsByType.wasm.trade
              )?.map((id: string) => parseInt(id));
              const counterIds = (
                txLog.eventsByType.wasm.counter_id ?? txLog.eventsByType.wasm.counter
              )?.map((id: string) => parseInt(id));
              return _.unzip([tradeIds, counterIds]);
            })
            .flat();
        })
        .flat();

      console.log(_.uniqWith(_.compact(idsToQuery), _.isEqual));

      // The we query the blockchain for trade info and put it into the database
      await pMap(
        _.uniqWith(_.compact(idsToQuery), _.isEqual),
        async (id: number[]) => {
          const [tradeId, counterId] = id;
          // We update the tradeInfo and all its associated counter_trades in the database
          await this.tradesService.updateTradeAndCounterTrades(network, tradeId);
          if (counterId != undefined) {
            // If a counterId is defined, we also update that specific counterId
            await this.tradesService.getCounterTradeById(network, tradeId, counterId);
          }
        },
        { concurrency: 1 },
      );

      // We add the transaction hashes to the redis set :
      await this.redisDB.sadd(
        redisHashSetName,
        response.data.tx_responses.map((tx: any) => tx.txhash),
      );

      // If no transactions queried were a analyzed, we return
    } while (txToAnalyse.length);
    console.log("Update finished");
  }
}
