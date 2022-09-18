import { Module } from "@nestjs/common";
import { QueryLimitService } from "../utils/queryLimit.service";
import { NFTInfoService } from "../database/nft_info/access";
import { UtilsController } from "./utils.controller";
import { UtilsService } from "./utils.service";

@Module({
  controllers: [UtilsController],
  providers: [UtilsService, NFTInfoService, QueryLimitService],
  exports: [UtilsService],
})
export class UtilsModule {}
