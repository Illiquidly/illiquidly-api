import { Module } from "@nestjs/common";
import { TradesService } from "./trades.service";
import {
  CounterTradesController,
  TradeNotificationController,
  TradesController,
  TradeFavoriteController,
} from "./trades.controller";
import { UtilsModule } from "../utils-api/utils.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import {
  CounterTradeCrudService,
  TradeCrudService,
  TradeFavoriteCrudService,
  TradeNotificationCrudService,
} from "./tradeCrud.service";
import { TradeFavoritesService } from "./trades.favorites.service";
import { TradeNotificationsService } from "./trades.notifications.service";

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
    TradeNotificationsService,
    TradeFavoritesService,

    TradeCrudService,
    CounterTradeCrudService,
    TradeNotificationCrudService,
    TradeFavoriteCrudService,
  ],
  exports: [TradesService],
})
export class TradesModule {}
