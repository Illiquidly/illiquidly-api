import { Module } from "@nestjs/common";
import { QueryLimitService } from "../utils/queryLimit.service";
import { NftContentService } from "./nft-content.service";
import { NftContentQuerierService } from "./nft-content-querier.service";
import { NftContentController } from "./nft-content.controller";
import { UtilsService } from "../utils-api/utils.service";
import { UtilsModule } from "../utils-api/utils.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import { RedisLockModule, RedisLockService } from "../utils/lock";

@Module({
  imports: [UtilsModule, RedisLockModule, TypeOrmModule.forFeature(Entities)],
  controllers: [NftContentController],
  providers: [
    NftContentService,
    NftContentQuerierService,
    UtilsService,
    QueryLimitService,
    RedisLockService,
  ],
})
export class NftContentModule {}
