import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { MsgExecuteContract } from "@terra-money/terra.js";
import { chains, contracts } from "../utils/blockchain/chains";
import { Network } from "../utils/blockchain/dto/network.dto";
import { Address } from "../utils/blockchain/terra_utils";
import { redisQueueConfig } from "../utils/configuration";
import { ConfigType } from "@nestjs/config";
import { asyncAction } from "../utils/js/asyncAction";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { QueueMessage } from "./websocket-listener.service";

@Injectable()
export class TriggerDbUpdateService {
  queueConfig: ConfigType<typeof redisQueueConfig>;
  private readonly logger = new Logger( TriggerDbUpdateService.name);

  constructor(
    @Inject(redisQueueConfig.KEY) queueConfig: ConfigType<typeof redisQueueConfig>,
    @InjectRedis("trade-publisher") private readonly redisPublisher: Redis
  ) {
    this.queueConfig = queueConfig;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sendUpdateMessage() {
    // We send messages for each chains
    Object.keys(chains).forEach(async (network: Network)=>{
      // We register a Trade Message
      if(contracts?.[network]?.p2pTrade){
        const tradeMessage: QueueMessage = {
          message: this.queueConfig.TRIGGER_P2P_TRADE_QUERY_MSG,
          network,
        };
        await this.redisPublisher.publish(this.queueConfig.CONTRACT_UPDATE_QUEUE_NAME, JSON.stringify(tradeMessage));
        this.logger.log(`Update asked for the trade contract on ${network}`);
      }

      // We register a Raffle Message
      if(contracts?.[network]?.raffle){
        const raffleMessage: QueueMessage = {
          message: this.queueConfig.TRIGGER_RAFFLE_QUERY_MSG,
          network,
        };
        await this.redisPublisher.publish(this.queueConfig.CONTRACT_UPDATE_QUEUE_NAME, JSON.stringify(raffleMessage));
      }
        this.logger.log(`Update asked for the raffle contract on ${network}`);
    });
  }
}
