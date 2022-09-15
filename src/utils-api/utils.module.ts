import { Module } from "@nestjs/common";
import { NFTInfoService } from "../database/nft_info/access";
import { UtilsController } from "./utils.controller";
import { UtilsService } from "./utils.service";

@Module({
  controllers: [UtilsController],
  providers: [UtilsService, NFTInfoService],
  exports: [UtilsService],
})
export class UtilsModule {}
