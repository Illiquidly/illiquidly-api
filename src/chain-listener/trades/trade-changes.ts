import "dotenv/config";
import Redis from "ioredis";
import Axios from "axios";
import { TxLog } from "@terra-money/terra.js";

import { chains, contracts } from "../../utils/blockchain/chains";
import { getCounterTradeInfo, getTradeInfo } from "../../utils/blockchain/p2pTradeQuery";
import { createRedisClient } from "../../utils/redis_db_accessor";
import { asyncAction } from "../../utils/js/asyncAction";
import { TradeDatabaseService } from "../../database/trades/access";
import { createTradeDB, flushTradeDB, initDB } from "../../database/trades/structure";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { QueueMessage } from "./websocket-server";
import { sleep } from "../../utils/js/sleep";
import { RedisService } from "nestjs-redis";
import { Trade } from "../../trades/dto/getTrades.dto";
import { NFTInfoService } from "../../database/nft_info/access";
const _ = require("lodash");
const pMap = require("p-map");
const camelcaseObjectDeep = require("camelcase-object-deep");

const redisHashSetName: string = process.env.REDIS_TXHASH_SET;

async function getHashSetCardinal(db: Redis) {
  return await db.scard(redisHashSetName);
}

async function hasTx(db: Redis, txHash: string): Promise<boolean> {
  return (await db.sismember(redisHashSetName, txHash)) == 1;
}

const txHashClient = createRedisClient();
const knexDB = initDB();

const redisService = new RedisService({
  defaultKey: "client",
  clients: new Map().set("client", txHashClient),
  size: 1,
});
const nftInfoService = new NFTInfoService(knexDB);
const databaseTradeService = new TradeDatabaseService(knexDB, redisService, nftInfoService);

async function resetDB() {
  await txHashClient.del(redisHashSetName);
  await flushTradeDB(knexDB);
  await createTradeDB(knexDB);
}
async function queryNewTransaction(network: Network) {
  const lcd = Axios.create(
    chains[network].axiosObject ?? {
      baseURL: chains[network].URL,
    },
  );

  // We loop query the lcd for new transactions on the p2p trade contract from the last one registered, until there is no tx left
  let continueQuerying = true;
  do {
    // We start querying after we left off
    const offset = await getHashSetCardinal(txHashClient);
    const [err, response] = await asyncAction(
      lcd.get("/cosmos/tx/v1beta1/txs", {
        params: {
          events: `wasm._contract_address='${contracts[network].p2pTrade}'`,
          "pagination.offset": offset,
        },
      }),
    );
    console.log(offset, response.data);
    // If we get no lcd tx result
    if (err) {
      console.log(err);
      return;
    }

    // We start by querying only new transactions (We do this in two steps, as the filter function doesn't wait for async results)
    const txFilter = await Promise.all(
      response.data.tx_responses.map(async (tx: any) => !(await hasTx(txHashClient, tx.txhash))),
    );
    const txToAnalyse = response.data.tx_responses.filter((_1: any, i: number) => txFilter[i]);

    // Then we iterate over the transactions and get the trade_id and/or (trade_id, counter_id)
    const idsToQuery: number[][] = txToAnalyse
      .map((tx: any) => {
        return tx.logs
          .map((log: any): number[][] => {
            const txLog = new TxLog(log.msg_index, log.log, log.events);
            const tradeIds = txLog.eventsByType.wasm.trade_id?.map((id: string) => parseInt(id));
            const counterIds = txLog.eventsByType.wasm.counter_id?.map((id: string) =>
              parseInt(id),
            );
            return _.unzip([tradeIds, counterIds]);
          })
          .flat();
      })
      .flat();

    console.log(idsToQuery);

    // The we query the blockchain for trade info and put it into the database
    const toAdd: Trade[] = (
      await pMap(
        _.compact(idsToQuery),
        async (id: number[]) => {
          if (id.length == 1) {
            const [tradeId] = id;
            // We query the trade_info
            const tradeInfo = await getTradeInfo(network, tradeId);

            // We query all counters associated with this trade in the db and update them here
            const counterIds = (
              await databaseTradeService.getCounterTrades({
                "filters.network": network,
                "filters.tradeId": [tradeId],
              })
            ).map(counterInfo => counterInfo.counterId);
            const counterTradeInfos = await pMap(
              counterIds,
              async (counterId: number) => {
                const counterTradeInfo = await getCounterTradeInfo(network, tradeId, counterId);
                return {
                  network,
                  tradeId,
                  counterId,
                  tradeInfo: camelcaseObjectDeep(counterTradeInfo),
                };
              },
              { concurrency: 2 },
            );

            // We return it to add to the db
            return [
              {
                network,
                tradeId,
                counterId: undefined,
                tradeInfo: camelcaseObjectDeep(tradeInfo),
              },
              ...counterTradeInfos,
            ];
          } else {
            const [tradeId, counterId] = id;
            // We query the tradeInfo and counterTradeInfo
            const tradeInfo: any = await getTradeInfo(network, tradeId);
            const counterTradeInfo = await getCounterTradeInfo(network, tradeId, counterId);

            // We query all counters associated with this trade in the db and update them here
            const counterIds = (
              await databaseTradeService.getCounterTrades({
                "filters.network": network,
                "filters.tradeId": [tradeId],
              })
            ).map(counterInfo => counterInfo.counterId);
            const allCounterTradeInfos = await pMap(
              counterIds,
              async (counterId: number) => {
                const counterTradeInfo = await getCounterTradeInfo(network, tradeId, counterId);
                return {
                  network,
                  tradeId,
                  counterId,
                  tradeInfo: camelcaseObjectDeep(counterTradeInfo),
                };
              },
              { concurrency: 2 },
            );

            // We return them to add to the db
            return [
              {
                network,
                tradeId,
                counterId: undefined,
                tradeInfo: camelcaseObjectDeep(tradeInfo),
              },
              {
                network,
                tradeId,
                counterId,
                tradeInfo: camelcaseObjectDeep(counterTradeInfo),
              },
              ...allCounterTradeInfos,
            ];
          }
        },
        { concurrency: 2 },
      )
    ).flat();

    // And we add them in a bunch to the database
    // First the trades
    const tradesToAdd = toAdd.filter((trade: Trade) => trade.counterId === undefined);
    if (tradesToAdd.length > 0) {
      await databaseTradeService.addToTradeDB(tradesToAdd);
    }

    // Then the counter trades
    const counterTradesToAdd = toAdd.filter((trade: Trade) => trade.counterId !== undefined);
    if (counterTradesToAdd.length > 0) {
      await databaseTradeService.addToCounterTradeDB(counterTradesToAdd);
    }

    // We add the transaction hashes to the redis set :
    await txHashClient.sadd(
      redisHashSetName,
      response.data.tx_responses.map((tx: any) => tx.txhash),
    );

    // If no transactions queried were a analyzed, we return
    if (!txToAnalyse.length) {
      continueQuerying = false;
    }
  } while (continueQuerying);
}

async function launchReceiver() {
  const db = createRedisClient();

  db.subscribe(process.env.P2P_QUEUE_NAME, (err: any) => {
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
  db.on("message", async (channel, message) => {
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
        await queryNewTransaction(parsedMessage.network);
        isAlreadyQuerying[parsedMessage.network] = false;
      }
    }
  });
}
/*
async function testQuery() {
  const lcd = Axios.create(
    chains[process.env.CHAIN].axiosObject ?? {
      baseURL: chains["testnet"].URL,
    },
  );
  const response = await lcd.get("/cosmos/tx/v1beta1/txs", {
    params: {
      events: `wasm._contract_address='${contracts["testnet"].p2pTrade}'`,
      "pagination.offset": 200,
    },
  });
  console.log(response)
}
*/

/* For testing purposes only */
// resetDB().then((_)=>queryNewTransaction())
// testQuery()

/* Actual event loop */
if (process.env.FLUSH_DB_ON_STARTUP == "true") {
  resetDB()
    .then(async () => await launchReceiver())
    // Then query the new transcations for the first time
    .then(async () => await queryNewTransaction(Network.testnet));
} else {
  launchReceiver()
    // Then query the new transcations for the first time
    .then(async () => await queryNewTransaction(Network.testnet));
}
