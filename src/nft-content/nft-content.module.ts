import { Module } from "@nestjs/common";
import { NftContentService } from "./nft-content.service";
import { NftContentQuerierService } from "./nft-content-querier.service";
import { NftContentController } from "./nft-content.controller";
import { UtilsService } from "../utils-api/utils.service";
import { UtilsModule } from "../utils-api/utils.module";
import { NFTInfoService } from "../database/nft_info/access";

@Module({
  imports: [UtilsModule],
  controllers: [NftContentController],
  providers: [NftContentService, NftContentQuerierService, UtilsService, NFTInfoService],
})
export class NftContentModule {}
