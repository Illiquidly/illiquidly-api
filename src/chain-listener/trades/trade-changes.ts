import "dotenv/config";
import Redis from "ioredis";
import Axios from "axios";
const _ = require("lodash");
const pMap = require("p-map");
import { TxLog } from "@terra-money/terra.js";
const camelcaseObjectDeep = require("camelcase-object-deep");

import { chains, contracts } from "../../utils/blockchain/chains";
import { getCounterTradeInfo, getTradeInfo} from "../../utils/blockchain/p2pTradeQuery";
import { createRedisClient } from "../../utils/redis_db_accessor";
import { asyncAction } from "../../utils/js/asyncAction";
import { addToTradeDB, addToCounterTradeDB, getCounterTrades, Trade, getTrades } from "../../database/trades/access";
import { createTradeDB, flushTradeDB, initDB } from "../../database/trades/structure";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { QueueMessage } from "./websocket-server";

let redisHashSetName: string = process.env.REDIS_TXHASH_SET!;

async function getHashSetCardinal(db: Redis) {
  return db.scard(redisHashSetName);
}

async function hasTx(db: Redis, txHash: string): Promise<boolean> {
  return (await db.sismember(redisHashSetName, txHash)) == 1;
}

let txHashClient = createRedisClient();
const knexDB = initDB();

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
    let offset = await getHashSetCardinal(txHashClient);
    let [err, response] = await asyncAction(
      lcd.get("/cosmos/tx/v1beta1/txs", {
        params: {
          events: `wasm._contract_address='${contracts[network].p2pTrade}'`,
          "pagination.offset": offset,
        },
      }),
    );
    // If we get no lcd tx result
    if (err) {
      console.log(err);
      return;
    }

    // We start by querying only new transactions (We do this in two steps, as the filter function doesn't wait for async results)
    let txFilter = await Promise.all(
      response.data.tx_responses.map(
        async (tx: any) => !(await hasTx(txHashClient, tx.txhash)),
      ),
    );
    let txToAnalyse = response.data.tx_responses.filter((_1: any, i: number) => txFilter[i]);

    // Then we iterate over the transactions and get the trade_id and/or (trade_id, counter_id)
    let idsToQuery: number[][] = txToAnalyse
      .map((tx: any) => {
        return tx.logs
          .map((log: any): number[][] => {
            let txLog = new TxLog(log.msg_index, log.log, log.events);
            let trade_ids = txLog.eventsByType.wasm.trade_id?.map((id: string) => parseInt(id));
            let counter_ids = txLog.eventsByType.wasm.counter_id?.map((id: string) => parseInt(id));
            return _.unzip([trade_ids, counter_ids]);
          })
          .flat();
      })
      .flat();

    // The we query the blockchain for trade info and put it into the database
    let toAdd: Trade[] = (
      await pMap(
        _.compact(idsToQuery),
        async (id: number[]) => {
          if (id.length == 1) {
            let [tradeId] = id;
            // We query the trade_info
            let tradeInfo = await getTradeInfo(network, tradeId);

            // We query all counters associated with this trade in the db and update them here
            let counterIds = (
              await getCounterTrades(
                knexDB,
                {
                  "filters.network":network,
                  "filters.trade_id": [tradeId],
              })
            ).map(counterInfo => counterInfo.counterId);
            let counterTradeInfos = await pMap(
              counterIds,
              async (counterId: number) => {
                let counterTradeInfo = await getCounterTradeInfo(network, tradeId, counterId);
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
            let [tradeId, counterId] = id;
            // We query the tradeInfo and counterTradeInfo
            let tradeInfo: any = await getTradeInfo(network, tradeId);
            let counterTradeInfo = await getCounterTradeInfo(network, tradeId, counterId);

            // We query all counters associated with this trade in the db and update them here
            let counterIds = (
              await getCounterTrades(knexDB,
                {
                  "filters.network":network,
                  "filters.trade_id": [tradeId],
              })
            ).map(counterInfo => counterInfo.counterId);
            let allCounterTradeInfos = await pMap(
              counterIds,
              async (counterId: number) => {
                let counterTradeInfo = await getCounterTradeInfo(network, tradeId, counterId);
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
    let tradesToAdd = toAdd.filter((trade: Trade) => trade.counterId === undefined);
    if (tradesToAdd.length) {
      await addToTradeDB(knexDB, tradesToAdd);
    }

    // Then the counter trades
    let counterTradesToAdd = toAdd.filter((trade: Trade) => trade.counterId !== undefined);
    if (counterTradesToAdd.length) {
      await addToCounterTradeDB(knexDB, counterTradesToAdd);
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
  let db = createRedisClient();

  db.subscribe(process.env.P2P_QUEUE_NAME!, (err: any, _) => {
    if (err) {
      // Just like other commands, subscribe() can fail for some reasons,
      // ex network issues.
      console.error("Failed to subscribe: %s", err.message);
    } else {
      // `count` represents the number of channels this client are currently subscribed to.
      console.log(
        `Subscribed successfully! This client is currently subscribed to the trade channel.`,
      );
    }
  });

  let isAlreadyQuerying = {

  };
  db.on("message", async (channel, message) => {
    if (
      channel == process.env.P2P_QUEUE_NAME!
    ) {
      let parsedMessage: QueueMessage = JSON.parse(message);
      if(
        parsedMessage.message == process.env.TRIGGER_P2P_TRADE_QUERY_MSG &&
        !isAlreadyQuerying[parsedMessage.network]
      ){
        console.log("New Trade Message Received", new Date().toLocaleString(), parsedMessage);
        isAlreadyQuerying[parsedMessage.network] = true;
        await queryNewTransaction(parsedMessage.network);
        isAlreadyQuerying[parsedMessage.network] = false;
      }
    }
  });
}

async function testQuery() {
  const lcd = Axios.create(
    chains[process.env.CHAIN!].axiosObject ?? {
      baseURL: chains["testnet"].URL,
    },
  );
  let response = await lcd.get("/cosmos/tx/v1beta1/txs", {
    params: {
      events: `wasm._contract_address='${contracts["testnet"].p2pTrade}'`,
      "pagination.offset": 200,
    },
  });
}

/* For testing purposes only */
//resetDB().then((_)=>queryNewTransaction())
//testQuery()

/* Actual event loop */
if (process.env.FLUSH_DB_ON_STARTUP == "true") {
  resetDB()
    .then(_ => launchReceiver())
    // Then query the new transcations for the first time
    .then(() => queryNewTransaction(Network.testnet));
} else {
  launchReceiver()
    // Then query the new transcations for the first time
    .then(() => queryNewTransaction(Network.testnet));
}
