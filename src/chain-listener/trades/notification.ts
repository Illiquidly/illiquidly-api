import "dotenv/config";
import Redis from "ioredis";
import Axios from "axios";
import { TxLog } from "@terra-money/terra.js";

import { asyncAction } from "../../utils/js/asyncAction";
import { chains, contracts } from "../../utils/blockchain/chains";
import { createRedisClient } from "../../utils/redis_db_accessor";
import { TradeDatabaseService } from "../../database/trades/access";
import { createNotificationDB, flushNotificationDB } from "../../database/trades/structure";
import { initDB } from "../../database/index";
import { QueueMessage } from "./websocket-server";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { sleep } from "../../utils/js/sleep";
import { RedisService } from "nestjs-redis";
import { TradeNotification } from "../../trades/dto/getTrades.dto";
import { NFTInfoService } from "src/database/nft_info/access";
const pMap = require("p-map");

const redisHashSetName: string = process.env.REDIS_NOTIFICATION_TXHASH_SET;
const redisDB = createRedisClient();
const knexDB = initDB();

const redisService = new RedisService({
  defaultKey: "client",
  clients: new Map().set("client", redisDB),
  size: 1,
});

const nftInfoService = new NFTInfoService(knexDB);
const databaseTradeService = new TradeDatabaseService(knexDB, redisService, nftInfoService);

async function getHashSetCardinal(db: Redis) {
  return await db.scard(redisHashSetName);
}

async function hasTx(db: Redis, txHash: string): Promise<boolean> {
  return (await db.sismember(redisHashSetName, txHash)) == 1;
}

async function resetDB() {
  await redisDB.del(redisHashSetName);
  await flushNotificationDB(knexDB);
  await createNotificationDB(knexDB);
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
    const offset = await getHashSetCardinal(redisDB);
    const [err, response] = await asyncAction(
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
    const txFilter = await Promise.all(
      response.data.tx_responses.map(async (tx: any) => !(await hasTx(redisDB, tx.txhash))),
    );
    const txToAnalyse = response.data.tx_responses.filter((_: any, i: number) => txFilter[i]);

    // Then we iterate over the transactions and get the action it refers to and the necessary information
    const notifications: TradeNotification[] = (
      await pMap(txToAnalyse, async (tx: any) => {
        return (
          await pMap(
            tx.logs,
            async (log: any) => {
              const txLog = new TxLog(log.msg_index, log.log, log.events);
              const contractEvents = txLog.eventsByType.wasm;
              // New counter_trade published
              let notifications: any[] = [];
              if (contractEvents?.action?.[0] == "confirm_counter_trade") {
                // If there is a new counter_trade, we notify the owner of the trade
                notifications.push({
                  time: tx.timestamp,
                  user: contractEvents.trader[0],
                  tradeId: contractEvents.trade_id[0],
                  counterId: contractEvents.counter_id[0],
                  notificationType: "new_counter_trade",
                });
              } else if (contractEvents?.action?.[0] == "review_counter_trade") {
                // If there is a new review of a counter_trade, we notify the owner of the counter trade
                notifications.push({
                  time: tx.timestamp,
                  user: contractEvents.counter_trader[0],
                  tradeId: contractEvents.trade_id[0],
                  counterId: contractEvents.counter_id[0],
                  notificationType: "counter_trade_review",
                });
              } else if (contractEvents?.action?.[0] == "refuse_counter_trade") {
                // If a counter_trade was refused, we notify the owner of the counter trade
                notifications.push({
                  time: tx.timestamp,
                  user: contractEvents.counter_trader[0],
                  tradeId: contractEvents.trade_id[0],
                  counterId: contractEvents.counter_id[0],
                  notificationType: "refuse_counter_trade",
                });
              } else if (contractEvents?.action?.[0] == "accept_counter_trade") {
                // If a counter_trade was accepted, we notify the owner of the counter trade
                const acceptedCounterId = contractEvents.counter_id[0];
                const tradeId = parseInt(contractEvents.trade_id[0]);
                notifications.push({
                  time: tx.timestamp,
                  user: contractEvents.counter_trader[0],
                  tradeId,
                  counterId: acceptedCounterId,
                  notificationType: "refuse_counter_trade",
                });

                // But we also notify all the other counter traders that their counter_trade is cancelled
                notifications.concat(
                  (
                    await databaseTradeService.getCounterTrades({
                      "filters.network": network,
                      "filters.tradeId": [tradeId],
                    })
                  )
                    .filter(counterInfo => counterInfo.counterId != acceptedCounterId)
                    .map(counterInfo => ({
                      time: tx.timestamp,
                      user: counterInfo.tradeInfo.owner,
                      tradeId,
                      counterId: counterInfo.counterId,
                      notificationType: "other_counter_trade_accepted",
                    })),
                );
              } else if (contractEvents?.action?.[0] == "cancel_trade") {
                // If a trade was cancelled, we notify the owner of all the counter trades
                const tradeId = parseInt(contractEvents.trade_id[0]);
                notifications = notifications.concat(
                  (
                    await databaseTradeService.getCounterTrades({
                      "filters.network": network,
                      "filters.tradeId": [tradeId],
                    })
                  ).map(counterInfo => ({
                    time: tx.timestamp,
                    user: counterInfo.tradeInfo.owner,
                    tradeId,
                    counterId: counterInfo.counterId,
                    notificationType: "counter_trade_cancelled",
                  })),
                );
              }
              return notifications;
            },
            // No concurrency because we are querying the local db
          )
        ).flat();
      })
    ).flat();

    // And we add the notifications in a bunch in the database
    if (notifications.length > 0) {
      await databaseTradeService.addToNotificationDB(notifications);
    }

    // We add the transaction hashes to the redis set :
    await redisDB.sadd(
      redisHashSetName,
      response.data.tx_responses.map((tx: any) => tx.txhash),
    );

    // If no transactions queried were a analyzed, we return
    if (!txToAnalyse.length) {
      continueQuerying = false;
    }
  } while (continueQuerying);

  // Test query all notifications
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
        console.log(
          "New Notification Message Received",
          new Date().toLocaleString(),
          parsedMessage,
        );
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
  console.log(response.data.tx_responses.length);
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
