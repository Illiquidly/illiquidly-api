import { Module } from "@nestjs/common";
import { NftContentService } from "./nft-content.service";
import { NftContentQuerierService } from "./nft-content-querier.service";
import { NftContentController } from "./nft-content.controller";

@Module({
  controllers: [NftContentController],
  providers: [NftContentService, NftContentQuerierService,],
})
export class NftContentModule {}
