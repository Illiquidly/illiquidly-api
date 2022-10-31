import { Inject, Injectable, Logger } from "@nestjs/common";
import { asyncAction } from "../../utils/js/asyncAction";

import { Network } from "../../utils/blockchain/dto/network.dto";
import Axios from "axios";
import { chains, contracts } from "../../utils/blockchain/chains";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { TxLog } from "@terra-money/terra.js";
import { CW721TokenAttribute } from "../../utils-api/entities/nft-info.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { TradesService } from "../../trades/trades.service";
import { ConfigType } from "@nestjs/config";
import { RafflesService } from "../../raffles/raffles.service";
import { RaffleNotification, RaffleNotificationType } from "../../raffles/entities/raffle.entity";
import { redisQueueConfig } from "../../utils/configuration";
import { ChangeListenerService } from "../change-listener.service";
const pMap = require("p-map");
const DATE_FORMAT = require("dateformat");

@Injectable()
export class RaffleNotificationChangesService extends ChangeListenerService { 
  
  constructor(
    @InjectRedis("raffle-notification-subscriber") readonly redisSubscriber: Redis,
    @InjectRedis("default-client") readonly redisDB: Redis,
    @InjectRepository(RaffleNotification)
    private raffleNotificationRepository: Repository<RaffleNotification>,
    private readonly tradesService: TradesService,
    private readonly rafflesService: RafflesService,
    @Inject(redisQueueConfig.KEY) queueConfig: ConfigType<typeof redisQueueConfig>,
  ) {
    super(
      redisSubscriber,
      redisDB,
      queueConfig.CONTRACT_UPDATE_QUEUE_NAME,
      queueConfig.TRIGGER_RAFFLE_QUERY_MSG,
      queueConfig.REDIS_RAFFLE_NOTIFICATION_TXHASH_SET,
    );
  }

  private async createNotification(network: Network, raffleId: number, tx: any) {
    const notification: RaffleNotification = new RaffleNotification();
    notification.network = network;
    notification.time = DATE_FORMAT(tx.timestamp, "yyyy-mm-dd HH:MM:ss");
    const raffle = await this.rafflesService.updateRaffleAndParticipants(network, raffleId);
    notification.raffleId = raffleId;
    notification.user = raffle.owner;
    notification.notificationPreview =
      (await this.tradesService.parseTokenPreview(network, raffle.rafflePreview)) ?? {};
    // We need to make sure we don't send the Metadata back with the attribute
    notification.notificationPreview.cw721Coin.attributes =
      notification.notificationPreview.cw721Coin.attributes.map(
        (attribute: CW721TokenAttribute) => {
          attribute.metadata = null;
          return attribute;
        },
      );
    return notification;
  }

  async queryNewTransaction(network: Network) {
    const lcd = Axios.create(
      chains[network].axiosObject ?? {
        baseURL: chains[network].URL,
      },
    );

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
      // If we get no lcd tx result
      if (err) {
        this.logger.error(err);
        return;
      }

      // We start by querying only new transactions (We do this in two steps, as the filter function doesn't wait for async results)
      const txFilter = await Promise.all(
        response.data.tx_responses.map(async (tx: any) => !(await this.hasTx(network, tx.txhash))),
      );
      txToAnalyse = response.data.tx_responses.filter((_: any, i: number) => txFilter[i]);
      // Then we iterate over the transactions and get the action it refers to and the necessary information
      const notifications: RaffleNotification[] = [];

      await pMap(txToAnalyse, async (tx: any) => {
        await pMap(
          tx.logs,
          async (log: any) => {
            const txLog = new TxLog(log.msg_index, log.log, log.events);
            const contractEvents = txLog.eventsByType.wasm;
            // New counter_trade published
            if (contractEvents?.action?.[0] == "buy_ticket") {
              // If there is a new ticket that was bought
              const raffleId = parseInt(contractEvents.raffle_id?.[0]);
              const notification = await this.createNotification(network, raffleId, tx);
              notification.user = contractEvents.owner[0];
              notification.notificationType = RaffleNotificationType.newTicketBought;
              notifications.push(notification);
            }
          },
          // No concurrency because we are querying the local db
        );
      });

      // We don't really care if this call fails
      asyncAction(this.raffleNotificationRepository.save(notifications));

      // We add the transaction hashes to the redis set :
      const txHashes = response.data.tx_responses.map((tx: any) => tx.txhash);
      if (txHashes.length) {
        await this.redisDB.sadd(
          this.getSetName(network),
          response.data.tx_responses.map((tx: any) => tx.txhash),
        );
      }
      // If no transactions queried were a analyzed, we return
    } while (txToAnalyse.length);
  }
}
