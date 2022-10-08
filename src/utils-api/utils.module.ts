import { Module } from "@nestjs/common";
import { QueryLimitService } from "../utils/queryLimit.service";
import {
  CollectionsController,
  CounterTradeTokensController,
  TradeTokensController,
  UtilsController,
} from "./utils.controller";
import { UtilsService } from "./utils.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import {
  CW721CollectionCrudService,
  CW721TokenCrudService,
  CW721TokenInCounterTradeCrudService,
  CW721TokenInTradeCrudService,
} from "./cw721CrudService";

@Module({
  imports: [TypeOrmModule.forFeature(Entities)],
  controllers: [
    UtilsController,
    CollectionsController,
    TradeTokensController,
    CounterTradeTokensController,
  ],
  providers: [
    UtilsService,
    QueryLimitService,
    CW721CollectionCrudService,
    CW721TokenCrudService,
    CW721TokenInTradeCrudService,
    CW721TokenInCounterTradeCrudService,
  ],
  exports: [UtilsService],
})
export class UtilsModule {}
