import { Module } from "@nestjs/common";

import { UtilsService } from "../utils-api/utils.service";
import { QueryLimitService } from "../utils/queryLimit.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";

import { TradesModule } from "../trades/trades.module";
import { TradeChangesService } from "./trades/trade-changes.service";
import { NotificationChangesService } from "./trades/notification-changes.service";
import { TradesService } from "../trades/trades.service";

import { RafflesModule } from "../raffles/raffle.module";
import { RafflesService } from "../raffles/raffles.service";
import { RaffleChangesService } from "./raffles/raffle-changes.service";
import { RaffleNotificationChangesService } from "./raffles/notification-changes.service";

import { WebsocketListenerService } from "./websocket-listener.service";
import { RedisLockService } from "../utils/lock";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { redisQueueConfig } from "../utils/configuration";

@Module({
  imports: [
    TradesModule,
    RafflesModule,
    TypeOrmModule.forFeature(Entities),
    ConfigModule.forRoot({
      load: [redisQueueConfig],
    }),
  ],
  controllers: [],
  providers: [
    TradesService,
    TradeChangesService,
    NotificationChangesService,

    RafflesService,
    RaffleChangesService,
    RaffleNotificationChangesService,

    WebsocketListenerService,
    UtilsService,
    QueryLimitService,
    RedisLockService,
    ConfigService,
  ],
})
export class ChainListenerModule {}
