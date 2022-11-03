import { Module } from "@nestjs/common";
import { NftContentService } from "./nft-content.service";
import { NftContentQuerierService } from "./nft-content-querier.service";
import { NftContentController } from "./nft-content.controller";
import { UtilsModule } from "../utils-api/utils.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import { ConfigModule } from "@nestjs/config";
import { nftContentAPIConfig } from "../utils/configuration";

@Module({
  imports: [
    UtilsModule,
    TypeOrmModule.forFeature(Entities),
    ConfigModule.forRoot({
      load: [nftContentAPIConfig],
    }),
  ],
  controllers: [NftContentController],
  providers: [NftContentService, NftContentQuerierService],
})
export class NftContentModule {}
