import { Module } from "@nestjs/common";
import { TradesService } from "./trades.service";
import { TradesController } from "./trades.controller";
import { NotificationsService } from "./notifications/notifications.service";
import { UtilsService } from "../utils-api/utils.service";
import { UtilsModule } from "../utils-api/utils.module";
import { TradeDatabaseService } from "../database/trades/access";
import { NFTInfoService } from "../database/nft_info/access";
import { QueryLimitService } from "../utils/queryLimit.service";

@Module({
  imports: [UtilsModule],
  controllers: [TradesController],
  providers: [
    TradesService,
    NotificationsService,
    UtilsService,
    TradeDatabaseService,
    NFTInfoService,
    QueryLimitService,
  ],
})
export class TradesModule {}
