import { Module } from "@nestjs/common";
import { QueryLimitService } from "../utils/queryLimit.service";
import { NFTInfoService } from "../database/nft_info/access";
import { UtilsController } from "./utils.controller";
import { UtilsService } from "./utils.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import { CW721CollectionCrudService, CW721TokenCrudService } from "./cw721CrudService";

@Module({
  imports: [TypeOrmModule.forFeature(Entities)],
  controllers: [UtilsController],
  providers: [
    UtilsService,
    NFTInfoService,
    QueryLimitService,
    CW721CollectionCrudService,
    CW721TokenCrudService,
  ],
  exports: [UtilsService],
})
export class UtilsModule {}
