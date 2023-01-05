import { Inject, Injectable } from "@nestjs/common";
import { asyncAction } from "../../utils/js/asyncAction";

import { Network } from "../../utils/blockchain/dto/network.dto";
import Axios from "axios";
import { chains, contracts } from "../../utils/blockchain/chains";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { TxLog } from "@terra-money/terra.js";
import {
  CounterTrade,
  TradeNotification,
  TradeNotificationType,
} from "../../trades/entities/trade.entity";
import { CW721TokenAttribute } from "../../utils-api/entities/nft-info.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { TradesService } from "../../trades/trades.service";
import { redisQueueConfig } from "../../utils/configuration";
import { ConfigType } from "@nestjs/config";
import { ChangeListenerService } from "../change-listener.service";
import { UtilsService } from "../../utils-api/utils.service";
const pMap = require("p-map");
const DATE_FORMAT = require("dateformat");

@Injectable()
export class NotificationChangesService extends ChangeListenerService {
  constructor(
    @InjectRedis("trade-notification-subscriber") readonly redisSubscriber: Redis,
    @InjectRedis("default-client") readonly redisDB: Redis,
    @InjectRepository(TradeNotification)
    private tradeNotificationRepository: Repository<TradeNotification>,
    @InjectRepository(CounterTrade) private counterTradesRepository: Repository<CounterTrade>,
    private readonly tradesService: TradesService,
    private readonly utilsService: UtilsService,
    @Inject(redisQueueConfig.KEY) queueConfig: ConfigType<typeof redisQueueConfig>,
  ) {
    super(
      redisSubscriber,
      redisDB,
      queueConfig.CONTRACT_UPDATE_QUEUE_NAME,
      queueConfig.TRIGGER_P2P_TRADE_QUERY_MSG,
      queueConfig.REDIS_TRADE_NOTIFICATION_TXHASH_SET,
    );
  }

  private async createNotification(network: Network, tradeId: number, tx: any) {
    const notification: TradeNotification = new TradeNotification();
    notification.network = network;
    notification.time = DATE_FORMAT(tx.timestamp, "yyyy-mm-dd HH:MM:ss");
    const trade = await this.tradesService.updateTrade(network, tradeId);
    notification.tradeId = tradeId;
    notification.notificationPreview =
      (await this.utilsService.parseTokenPreview(network, trade.tradeInfo.tradePreview)) ?? {};
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
      const notifications: TradeNotification[] = [];

      await pMap(txToAnalyse, async (tx: any) => {
        await pMap(
          tx.logs,
          async (log: any) => {
            const txLog = new TxLog(log.msg_index, log.log, log.events);
            const contractEvents = txLog.eventsByType.wasm;
            // New counter_trade published
            if (contractEvents?.action?.[0] == "confirm_counter_trade") {
              // If there is a new counter_trade, we notify the owner of the trade
              const tradeId = parseInt(contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0]);
              const notification = await this.createNotification(network, tradeId, tx);
              notification.user = contractEvents.trader[0];
              notification.counterTradeId = parseInt(
                contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
              );
              notification.notificationType = TradeNotificationType.newCounterTrade;
              notifications.push(notification);
            } else if (contractEvents?.action?.[0] == "review_counter_trade") {
              // If there is a new review of a counter_trade, we notify the owner of the counter trade
              const tradeId = parseInt(contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0]);
              const notification = await this.createNotification(network, tradeId, tx);
              notification.user = contractEvents.counter_trader[0];
              notification.counterTradeId = parseInt(
                contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
              );
              notification.notificationType = TradeNotificationType.counterTradeReview;
              notifications.push(notification);
            } else if (contractEvents?.action?.[0] == "refuse_counter_trade") {
              // If a counter_trade was refused, we notify the owner of the counter trade
              const tradeId = parseInt(contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0]);
              const notification = await this.createNotification(network, tradeId, tx);
              notification.user = contractEvents.counter_trader[0];
              notification.counterTradeId = parseInt(
                contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
              );
              notification.notificationType = TradeNotificationType.refuseCounterTrade;
              notifications.push(notification);
            } else if (contractEvents?.action?.[0] == "accept_counter_trade") {
              // If a counter_trade was accepted, we notify the owner of the counter trade
              const acceptedCounterId: number = parseInt(
                contractEvents.counter_id?.[0] ?? contractEvents.counter?.[0],
              );
              const tradeId = parseInt(contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0]);
              const notification = await this.createNotification(network, tradeId, tx);
              notification.user = contractEvents.counter_trader[0];
              notification.counterTradeId = acceptedCounterId;
              notification.notificationType = TradeNotificationType.counterTradeAccepted;
              notifications.push(notification);

              // But we also notify all the other counter traders that their counter_trade is cancelled
              const counterTrades: CounterTrade[] = await this.counterTradesRepository
                .createQueryBuilder("counter_trade")
                .innerJoinAndSelect("counter_trade.trade", "trade")
                .innerJoinAndSelect("counter_trade.tradeInfo", "tradeInfo")
                .where("counter_trade.network = :network", { network })
                .where("trade.tradeId = :tradeId", { tradeId })
                .getMany();

              notifications.concat(
                await pMap(
                  counterTrades.filter(
                    counterInfo => counterInfo.counterTradeId != acceptedCounterId,
                  ),
                  async (counterInfo: CounterTrade) => {
                    const notification = await this.createNotification(network, tradeId, tx);
                    notification.user = counterInfo.tradeInfo.owner;
                    notification.counterTradeId = counterInfo.counterTradeId;
                    notification.notificationType = TradeNotificationType.otherCounterTradeAccepted;
                    return notification;
                  },
                ),
              );
            } else if (contractEvents?.action?.[0] == "cancel_trade") {
              // If a trade was cancelled, we notify the owner of all the counter trades
              const tradeId = parseInt(contractEvents.trade_id?.[0] ?? contractEvents.trade?.[0]);

              const counterTrades: CounterTrade[] = await this.counterTradesRepository
                .createQueryBuilder("counter_trade")
                .innerJoinAndSelect("counter_trade.trade", "trade")
                .innerJoinAndSelect("counter_trade.tradeInfo", "tradeInfo")
                .where("counter_trade.network = :network", { network })
                .where("trade.tradeId = :tradeId", { tradeId })
                .getMany();

              notifications.concat(
                await pMap(counterTrades, async counterInfo => {
                  const notification = await this.createNotification(network, tradeId, tx);
                  notification.user = counterInfo.tradeInfo.owner;
                  notification.counterTradeId = counterInfo.counterTradeId;
                  notification.notificationType = TradeNotificationType.tradeCancelled;
                  return notification;
                }),
              );
            }
          },
          // No concurrency because we are querying the local db
        );
      });

      this.tradeNotificationRepository.save(notifications);

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
