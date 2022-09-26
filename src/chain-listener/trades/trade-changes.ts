import "dotenv/config";
import Redis from "ioredis";
import Axios from "axios";
import { TxLog } from "@terra-money/terra.js";

import { chains, contracts } from "../../utils/blockchain/chains";
import { createRedisClient } from "../../utils/redis_db_accessor";
import { asyncAction } from "../../utils/js/asyncAction";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { QueueMessage } from "./websocket-server";
import { sleep } from "../../utils/js/sleep";
import { QueryLimitService } from "../../utils/queryLimit.service";
import { TradesService } from "../../trades/trades.service";
import { UtilsService } from "../../utils-api/utils.service";
import { CounterTrade, Trade } from "../../trades/entities/trade.entity";
import { DataSource, Repository } from "typeorm";
import {
  CW20Coin,
  CW721Collection,
  CW721Token,
  CW721TokenMetadata,
} from "../../utils-api/entities/nft-info.entity";
import { typeOrmOptions } from "../../utils/typeormOptions";
const _ = require("lodash");
const pMap = require("p-map");

const redisHashSetName: string = process.env.REDIS_TXHASH_SET;

async function getHashSetCardinal(db: Redis) {
  return await db.scard(redisHashSetName);
}

async function hasTx(db: Redis, txHash: string): Promise<boolean> {
  return (await db.sismember(redisHashSetName, txHash)) == 1;
}

const txHashClient = createRedisClient();

const queryLimitService: QueryLimitService = new QueryLimitService();

const manager = new DataSource({
  type: "mysql",
  ...typeOrmOptions,
});

let tradesRepository: Repository<Trade>;
let counterTradesRepository: Repository<CounterTrade>;
let collectionRepository: Repository<CW721Collection>;
let tokenRepository: Repository<CW20Coin>;
let nftTokenRepository: Repository<CW721Token>;
let nftTokenMetadataRepository: Repository<CW721TokenMetadata>;

let tradesService: TradesService;

async function initElements() {
  await manager.initialize();
  tradesRepository = manager.getRepository(Trade);
  counterTradesRepository = manager.getRepository(CounterTrade);
  collectionRepository = manager.getRepository(CW721Collection);
  tokenRepository = manager.getRepository(CW20Coin);
  nftTokenRepository = manager.getRepository(CW721Token);
  nftTokenMetadataRepository = manager.getRepository(CW721TokenMetadata);

  const utilsService = new UtilsService(
    collectionRepository,
    tokenRepository,
    nftTokenRepository,
    nftTokenMetadataRepository,
    queryLimitService,
  );
  tradesService = new TradesService(
    tradesRepository,
    counterTradesRepository,
    collectionRepository,
    utilsService,
    queryLimitService,
  );
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

    console.log(_.uniqWith(_.compact(idsToQuery), _.isEqual));

    // The we query the blockchain for trade info and put it into the database
    await pMap(
      _.uniqWith(_.compact(idsToQuery), _.isEqual),
      async (id: number[]) => {
        const [tradeId, counterId] = id;
        // We update the tradeInfo and all its associated counter_trades in the database
        await tradesService.updateTradeAndCounterTrades(network, tradeId);
        if (counterId != undefined) {
          // If a counterId is defined, we also update that specific counterId
          await tradesService.getCounterTradeById(network, tradeId, counterId);
        }
      },
      { concurrency: 1 },
    );

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
  console.log("Update finished");
}

async function launchReceiver() {
  const db = createRedisClient();

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

launchReceiver()
  // Then query the new transcations for the first time
  .then(async () => await txHashClient.del(redisHashSetName))
  .then(async () => await queryNewTransaction(Network.testnet));
