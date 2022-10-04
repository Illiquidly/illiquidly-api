import { Module } from "@nestjs/common";

import { UtilsService } from "../utils-api/utils.service";
import { QueryLimitService } from "../utils/queryLimit.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import { TradeChangesService } from "./trade-changes.service";
import { TradesService } from "../trades/trades.service";
import { NotificationChangesService } from "./notification-changes.service";
import { TradesModule } from "../trades/trades.module";
import { WebsocketListenerService } from "./websocket-listener.service";

@Module({
  imports: [TradesModule, TypeOrmModule.forFeature(Entities)],
  controllers: [],
  providers: [
    TradeChangesService,
    NotificationChangesService,
    WebsocketListenerService,
    TradesService,
    UtilsService,
    QueryLimitService,
  ],
})
export class ChainListenerModule {}
