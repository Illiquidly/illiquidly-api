import { Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";

import { TradesModule } from "../trades/trades.module";
import { TradeChangesService } from "./trades/trade-changes.service";
import { NotificationChangesService } from "./trades/notification-changes.service";

import { RafflesModule } from "../raffles/raffle.module";
import { RaffleChangesService } from "./raffles/raffle-changes.service";
import { RaffleNotificationChangesService } from "./raffles/notification-changes.service";

import { WebsocketListenerService } from "./websocket-listener.service";
import { ConfigModule } from "@nestjs/config";

import { redisQueueConfig, signingTerraConfig } from "../utils/configuration";
import { RandomnessProviderService } from "./raffles/provide_randomness";
import { TriggerDbUpdateService } from "./trigger_db_update";
import { UtilsModule } from "../utils-api/utils.module";

@Module({
  imports: [
    TradesModule,
    RafflesModule,
    TypeOrmModule.forFeature(Entities),
    ConfigModule.forRoot({
      load: [redisQueueConfig, signingTerraConfig],
    }),
    UtilsModule,
  ],
  controllers: [],
  providers: [
    TradeChangesService,
    NotificationChangesService,

    RaffleChangesService,
    RaffleNotificationChangesService,

    TriggerDbUpdateService,
    RandomnessProviderService,

    WebsocketListenerService,
  ],
})
export class ChainListenerModule {}
