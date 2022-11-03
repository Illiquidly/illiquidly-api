import { Module } from "@nestjs/common";
import { NftTransferService } from "./nft-transfer.service";
import { NftTransferController, NftTransferCrudService } from "./nft-transfer.controller";
import { UtilsModule } from "../utils-api/utils.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import { ConfigModule } from "@nestjs/config";
import { nftTransferAPIConfig } from "../utils/configuration";

@Module({
  imports: [
    UtilsModule,
    TypeOrmModule.forFeature(Entities),
    ConfigModule.forRoot({
      load: [nftTransferAPIConfig],
    }),
  ],
  controllers: [NftTransferController],
  providers: [NftTransferService, NftTransferCrudService],
})
export class NftTransferModule {}
