import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { asyncAction } from "../../utils/js/asyncAction";
import { MultipleNotificationsResponse } from "../dto/getTrades.dto";
import { TradeDatabaseService } from "../../database/trades/access";

@Injectable()
export class NotificationsService {
  constructor(private readonly tradeDatabaseService: TradeDatabaseService) {}

  async queryNotifications(
    network: Network,
    user: string,
    limit: number,
    offset: number,
  ): Promise<MultipleNotificationsResponse> {
    const [err, userNotifications] = await asyncAction(
      this.tradeDatabaseService.getNotifications({
        network,
        user,
        limit,
        offset,
      }),
    );

    if (err) {
      throw new NotFoundException("Notifications Not Found");
    }

    const [nbErr, notificationNumber] = await asyncAction(
      this.tradeDatabaseService.getNotificationNumber({
        network,
        user,
      }),
    );

    if (nbErr) {
      throw new NotFoundException("Error getting total number of Notifications");
    }

    return {
      data: userNotifications,
      nextOffset: offset ?? 0 + userNotifications.length,
      totalNumber: notificationNumber,
    };
  }

  async readNotifications(network: Network, user?: string, notificationId?: string) {
    if (!notificationId && !user) {
      throw new BadRequestException("You must indicate a user address or a notification id");
    }
    const [err] = await asyncAction(
      this.tradeDatabaseService.markNotificationsRead({
        network,
        notificationId,
        user,
      }),
    );

    if (err) {
      throw new BadRequestException(err);
    }

    return {};
  }
}
