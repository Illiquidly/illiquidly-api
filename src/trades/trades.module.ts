import { Module } from "@nestjs/common";
import { TradesService } from "./trades.service";
import {
  CounterTradesController,
  TradeNotificationController,
  TradesController,
} from "./trades.controller";
import { UtilsService } from "../utils-api/utils.service";
import { UtilsModule } from "../utils-api/utils.module";
import { NFTInfoService } from "../database/nft_info/access";
import { QueryLimitService } from "../utils/queryLimit.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import {
  CounterTradeCrudService,
  TradeCrudService,
  TradeNotificationCrudService,
} from "./tradeCrud.service";

@Module({
  imports: [UtilsModule, TypeOrmModule.forFeature(Entities)],
  controllers: [TradesController, CounterTradesController, TradeNotificationController],
  providers: [
    TradesService,
    UtilsService,
    NFTInfoService,
    QueryLimitService,
    TradeCrudService,
    CounterTradeCrudService,
    TradeNotificationCrudService,
  ],
})
export class TradesModule {}
