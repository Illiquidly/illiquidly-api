import { Inject, Injectable } from "@nestjs/common";
import { asyncAction } from "../../utils/js/asyncAction";

import { Network } from "../../utils/blockchain/dto/network.dto";
import Axios from "axios";
import { chains, contracts } from "../../utils/blockchain/chains";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { TxLog } from "@terra-money/terra.js";
import { RafflesService } from "../../raffles/raffles.service";
import { ConfigType } from "@nestjs/config";
import { redisQueueConfig } from "../../utils/configuration";
import { ChangeListenerService } from "../change-listener.service";
const pMap = require("p-map");
const _ = require("lodash");

@Injectable()
export class RaffleChangesService extends ChangeListenerService {
  constructor(
    @InjectRedis("raffle-subscriber") readonly redisSubscriber: Redis,
    @InjectRedis("default-client") readonly redisDB: Redis,
    readonly rafflesService: RafflesService,
    @Inject(redisQueueConfig.KEY) queueConfig: ConfigType<typeof redisQueueConfig>,
  ) {
    super(
      redisSubscriber,
      redisDB,
      queueConfig.CONTRACT_UPDATE_QUEUE_NAME,
      queueConfig.TRIGGER_RAFFLE_QUERY_MSG,
      queueConfig.REDIS_RAFFLE_TXHASH_SET,
    );
  }

  async queryNewTransaction(network: Network) {
    const lcd = Axios.create(
      chains[network].axiosObject ?? {
        baseURL: chains[network].URL,
      },
    );
    // We loop query the lcd for new transactions on the raffle contract from the last one registered, until there is no tx left
    let txToAnalyse = [];
    do {
      // We start querying after we left off
      const offset = await this.getHashSetCardinal(network);
      const [err, response] = await asyncAction(
        lcd.get("/cosmos/tx/v1beta1/txs", {
          params: {
            events: `wasm._contract_address='${contracts[network].raffle}'`,
            "pagination.offset": offset,
          },
        }),
      );

      // If we get no lcd tx result
      if (err) {
        this.logger.error(err);
        return;
      }

      // We start by querying only new transactions (We do this in two steps, as the filter function doesn't wait for async results)
      const txFilter = await Promise.all(
        response.data.tx_responses.map(async (tx: any) => !(await this.hasTx(network, tx.txhash))),
      );
      txToAnalyse = response.data.tx_responses.filter((_1: any, i: number) => txFilter[i]);

      // Then we iterate over the transactions and get the raffle_id
      const idsToQuery: number[] = txToAnalyse
        .map((tx: any) => {
          return tx.logs
            .map((log: any): number[] => {
              const txLog = new TxLog(log.msg_index, log.log, log.events);
              const raffleIds = txLog.eventsByType.wasm.raffle_id?.map((id: string) =>
                parseInt(id),
              );
              return raffleIds;
            })
            .flat();
        })
        .flat();

      // Then we query the blockchain for raffle info and put it into the database
      await pMap(
        _.uniqWith(_.compact(idsToQuery), _.isEqual),
        async (raffleId: number) => {
          // We update the tradeInfo and all its associated counter_trades in the database
          await this.rafflesService.updateRaffleAndParticipants(network, raffleId);
        }
      );

      // We add the transaction hashes to the redis set :
      const txHashes = response.data.tx_responses.map((tx: any) => tx.txhash);
      if (txHashes.length) {
        await this.redisDB.sadd(
          this.getSetName(network),
          response.data.tx_responses.map((tx: any) => tx.txhash),
        );
      }
      this.logger.log(
        `Raffle Update done for offset ${offset} for queue ${this.getSetName(network)}`,
      );

      // If no transactions queried were a analyzed, we return
    } while (txToAnalyse.length);
  }
}
