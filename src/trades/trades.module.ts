import { Module } from "@nestjs/common";
import { TradesService } from "./trades.service";
import {
  CounterTradesController,
  TradeNotificationController,
  TradesController,
  TradeFavoriteController,
} from "./trades.controller";
import { UtilsService } from "../utils-api/utils.service";
import { UtilsModule } from "../utils-api/utils.module";
import { QueryLimitService } from "../utils/queryLimit.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import {
  CounterTradeCrudService,
  TradeCrudService,
  TradeFavoriteCrudService,
  TradeNotificationCrudService,
} from "./tradeCrud.service";

@Module({
  imports: [UtilsModule, TypeOrmModule.forFeature(Entities)],
  controllers: [
    TradesController,
    CounterTradesController,
    TradeNotificationController,
    TradeFavoriteController,
  ],
  providers: [
    TradesService,
    UtilsService,
    QueryLimitService,
    TradeCrudService,
    CounterTradeCrudService,
    TradeNotificationCrudService,
    TradeFavoriteCrudService,
  ],
})
export class TradesModule {}
