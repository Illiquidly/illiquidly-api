import { Module } from "@nestjs/common";
import { TradesService } from "./trades.service";
import { TradesController } from "./trades.controller";
import { NotificationsService } from "./notifications/notifications.service";

@Module({
  controllers: [TradesController],
  providers: [TradesService, NotificationsService],
})
export class TradesModule {}
