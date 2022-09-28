import "dotenv/config";
import Redis from "ioredis";
import Axios from "axios";
import { TxLog } from "@terra-money/terra.js";

import { asyncAction } from "../../utils/js/asyncAction";
import { chains, contracts } from "../../utils/blockchain/chains";
import { QueueMessage } from "./websocket-server";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { sleep } from "../../utils/js/sleep";
import { DataSource, Repository } from "typeorm";
import { typeOrmOptions } from "../../utils/typeormOptions";
import {
  CounterTrade,
  TradeNotification,
  TradeNotificationStatus,
  TradeNotificationType,
} from "../../trades/entities/trade.entity";
const pMap = require("p-map");
const DATE_FORMAT = require("dateformat");

const redisHashSetName: string = process.env.REDIS_NOTIFICATION_TXHASH_SET;
const redisDB = new Redis();

const manager = new DataSource({
  type: "mysql",
  ...typeOrmOptions,
});

let counterTradesRepository: Repository<CounterTrade>;
let tradeNotificationRepository: Repository<TradeNotification>;

async function initElements() {
  await manager.initialize();
  counterTradesRepository = manager.getRepository(CounterTrade);
  tradeNotificationRepository = manager.getRepository(TradeNotification);
}

async function getHashSetCardinal(db: Redis) {
  return await db.scard(redisHashSetName);
}

async function hasTx(db: Redis, txHash: string): Promise<boolean> {
  return (await db.sismember(redisHashSetName, txHash)) == 1;
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
    const notifications: TradeNotification[] = [];

    await pMap(txToAnalyse, async (tx: any) => {
      await pMap(
        tx.logs,
        async (log: any) => {
          const txLog = new TxLog(log.msg_index, log.log, log.events);
          const contractEvents = txLog.eventsByType.wasm;
          // New counter_trade published
          console.log(offset, contractEvents?.action, tx.txhash);
          if (contractEvents?.action?.[0] == "confirm_counter_trade") {
            console.log("confirmed");
            // If there is a new counter_trade, we notify the owner of the trade
            const notification: TradeNotification = new TradeNotification();
            notification.network = network;
            notification.time = DATE_FORMAT(tx.timestamp, "yyyy-mm-dd HH:MM:ss");
            notification.user = contractEvents.trader[0];
            notification.tradeId = parseInt(
              contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0],
            );
            notification.counterTradeId = parseInt(
              contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
            );
            notification.notificationType = TradeNotificationType.newCounterTrade;
            notification.status = TradeNotificationStatus.unread;
            notifications.push(notification);
          } else if (contractEvents?.action?.[0] == "review_counter_trade") {
            // If there is a new review of a counter_trade, we notify the owner of the counter trade
            const notification: TradeNotification = new TradeNotification();
            notification.network = network;
            notification.time = tx.timestamp;
            notification.user = contractEvents.counter_trader[0];
            notification.tradeId = parseInt(
              contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0],
            );
            notification.counterTradeId = parseInt(
              contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
            );
            notification.notificationType = TradeNotificationType.counterTradeReview;
            notification.status = TradeNotificationStatus.unread;
            notifications.push(notification);
          } else if (contractEvents?.action?.[0] == "refuse_counter_trade") {
            // If a counter_trade was refused, we notify the owner of the counter trade
            const notification: TradeNotification = new TradeNotification();
            notification.network = network;
            notification.time = tx.timestamp;
            notification.user = contractEvents.counter_trader[0];
            notification.tradeId = parseInt(
              contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0],
            );
            notification.counterTradeId = parseInt(
              contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
            );
            notification.notificationType = TradeNotificationType.refuseCounterTrade;
            notification.status = TradeNotificationStatus.unread;
            notifications.push(notification);
          } else if (contractEvents?.action?.[0] == "accept_counter_trade") {
            // If a counter_trade was accepted, we notify the owner of the counter trade
            const acceptedCounterId: number = parseInt(
              contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
            );
            const tradeId = parseInt(contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0]);

            const notification: TradeNotification = new TradeNotification();
            notification.network = network;
            notification.time = tx.timestamp;
            notification.user = contractEvents.counter_trader[0];
            notification.tradeId = tradeId;
            notification.counterTradeId = acceptedCounterId;
            notification.notificationType = TradeNotificationType.counterTradeAccepted;
            notification.status = TradeNotificationStatus.unread;
            notifications.push(notification);

            // But we also notify all the other counter traders that their counter_trade is cancelled
            const counterTrades: CounterTrade[] = await counterTradesRepository
              .createQueryBuilder("counter_trade")
              .innerJoinAndSelect("counter_trade.trade", "trade")
              .where("counter_trade.network = :network", { network })
              .where("trade.tradeId = :tradeId", { tradeId })
              .getMany();

            notifications.concat(
              counterTrades
                .filter(counterInfo => counterInfo.counterTradeId != acceptedCounterId)
                .map(counterInfo => {
                  const notification: TradeNotification = new TradeNotification();
                  notification.network = network;
                  notification.time = tx.timestamp;
                  notification.user = counterInfo.tradeInfo.owner;
                  notification.tradeId = tradeId;
                  notification.counterTradeId = counterInfo.counterTradeId;
                  notification.notificationType = TradeNotificationType.otherCounterTradeAccepted;
                  notification.status = TradeNotificationStatus.unread;
                  return notification;
                }),
            );
          } else if (contractEvents?.action?.[0] == "cancel_trade") {
            // If a trade was cancelled, we notify the owner of all the counter trades
            const tradeId = parseInt(contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0]);

            const counterTrades: CounterTrade[] = await counterTradesRepository
              .createQueryBuilder("counter_trade")
              .innerJoinAndSelect("counter_trade.trade", "trade")
              .where("counter_trade.network = :network", { network })
              .where("trade.tradeId = :tradeId", { tradeId })
              .getMany();

            notifications.concat(
              counterTrades.map(counterInfo => {
                const notification: TradeNotification = new TradeNotification();
                notification.network = network;
                notification.time = tx.timestamp;
                notification.user = counterInfo.tradeInfo.owner;
                notification.tradeId = tradeId;
                notification.counterTradeId = counterInfo.counterTradeId;
                notification.notificationType = TradeNotificationType.tradeCancelled;
                notification.status = TradeNotificationStatus.unread;
                return notification;
              }),
            );
          }
        },
        // No concurrency because we are querying the local db
      );
    });
    console.log(notifications);

    tradeNotificationRepository.save(notifications);

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
  const db = new Redis();
  await initElements();
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

launchReceiver()
  // Then query the new transcations for the first time
  .then(async () => {
    //await redisDB.del(redisHashSetName)
    await queryNewTransaction(Network.testnet);
  });
