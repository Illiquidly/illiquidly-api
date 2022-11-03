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
import { RedLockService } from "../utils/lock.service";
import { ConfigModule } from "@nestjs/config";
import { nftContentAPIConfig } from "../utils/configuration";
import { RawLCDQuery } from "../utils/blockchain/queryRawLCD.service";

@Module({
  imports: [
    TypeOrmModule.forFeature(Entities),
    ConfigModule.forRoot({
      load: [nftContentAPIConfig],
    }),
  ],
  controllers: [
    UtilsController,
    CollectionsController,
    TradeTokensController,
    CounterTradeTokensController,
  ],
  providers: [
    UtilsService,
    QueryLimitService,
    RedLockService,
    CW721CollectionCrudService,
    CW721TokenCrudService,
    CW721TokenInTradeCrudService,
    CW721TokenInCounterTradeCrudService,

    RawLCDQuery,
  ],
  exports: [UtilsService, QueryLimitService, RedLockService, RawLCDQuery],
})
export class UtilsModule {}
