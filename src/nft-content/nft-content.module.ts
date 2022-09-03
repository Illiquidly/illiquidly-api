import { Module } from "@nestjs/common";
import { NftContentService } from "./nft-content.service";
import { NftContentController } from "./nft-content.controller";

@Module({
  controllers: [NftContentController],
  providers: [NftContentService],
})
export class NftContentModule {}
