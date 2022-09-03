import { Module } from "@nestjs/common";
import { NftContentModule } from "./nft-content/nft-content.module";
import { UtilsModule } from "./utils-api/utils.module";
import { TradesModule } from "./trades/trades.module";

@Module({
  imports: [NftContentModule, UtilsModule, TradesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
