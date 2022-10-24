import { Inject, Injectable } from "@nestjs/common";
import { asyncAction } from "../../utils/js/asyncAction";

import { Network } from "../../utils/blockchain/dto/network.dto";
import Axios from "axios";
import { chains, contracts } from "../../utils/blockchain/chains";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { TxLog } from "@terra-money/terra.js";
import { TradesService } from "../../trades/trades.service";
import { QueueMessage } from "../websocket-listener.service";
import { sleep } from "../../utils/js/sleep";
import { ConfigType } from "@nestjs/config";
import { redisQueueConfig } from "../../utils/configuration";
import { ChangeListenerService } from "../change-listener.service";
const pMap = require("p-map");
const _ = require("lodash");

@Injectable()
export class TradeChangesService extends ChangeListenerService {
  constructor(
    @InjectRedis("trade-subscriber") readonly redisSubscriber: Redis,
    @InjectRedis("default-client") readonly redisDB: Redis,
    readonly tradesService: TradesService,
    @Inject(redisQueueConfig.KEY) queueConfig: ConfigType<typeof redisQueueConfig>,
  ) {
    super(
      redisSubscriber,
      redisDB,
      queueConfig.CONTRACT_UPDATE_QUEUE_NAME,
      queueConfig.TRIGGER_P2P_TRADE_QUERY_MSG,
      queueConfig.REDIS_TRADE_TXHASH_SET,
    );
  }

  async queryNewTransaction(network: Network) {
    const lcd = Axios.create(
      chains[network].axiosObject ?? {
        baseURL: chains[network].URL,
      },
    );
    console.log("Start trade update for ", network);
    // We loop query the lcd for new transactions on the p2p trade contract from the last one registered, until there is no tx left
    let txToAnalyse = [];
    do {
      // We start querying after we left off
      const offset = await this.getHashSetCardinal(network);
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
        response.data.tx_responses.map(async (tx: any) => !(await this.hasTx(network, tx.txhash))),
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
              const counterTradeIds = (
                txLog.eventsByType.wasm.counter_id ?? txLog.eventsByType.wasm.counter
              )?.map((id: string) => parseInt(id));
              return _.unzip([tradeIds, counterTradeIds]);
            })
            .flat();
        })
        .flat();

      console.log("Trade Ids to update", _.uniqWith(_.compact(idsToQuery), _.isEqual));

      // The we query the blockchain for trade info and put it into the database
      await pMap(
        _.uniqWith(_.compact(idsToQuery), _.isEqual),
        async (id: number[]) => {
          const [tradeId, counterTradeId] = id;
          // We update the tradeInfo and all its associated counter_trades in the database
          await this.tradesService.updateTradeAndCounterTrades(network, tradeId);
          if (counterTradeId != undefined) {
            // If a counterId is defined, we also update that specific counterId
            await this.tradesService.updateCounterTrade(network, tradeId, counterTradeId);
          }
        },
        { concurrency: 1 },
      );

      // We add the transaction hashes to the redis set :
      let txHashes = response.data.tx_responses.map((tx: any) => tx.txhash);
      if(txHashes.length){
         await this.redisDB.sadd(
          this.getSetName(network),
          response.data.tx_responses.map((tx: any) => tx.txhash),
        );
      }

      // If no transactions queried were a analyzed, we return
    } while (txToAnalyse.length);
    console.log("Update finished");
  }
}
