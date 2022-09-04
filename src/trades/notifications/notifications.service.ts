import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { asyncAction } from "../../utils/js/asyncAction";
import { MultipleNotificationsResponse } from "../dto/getTrades.dto";
import { getNotifications, markNotificationsRead } from "../../database/trades/access";
import { InjectKnex, Knex } from "nestjs-knex";

@Injectable()
export class NotificationsService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async queryNotifications(
    network: Network,
    user: string,
    limit: number,
    offset: number,
  ): Promise<MultipleNotificationsResponse> {
    const [err, userNotifications] = await asyncAction(
      getNotifications(this.knex, {
        network,
        user,
        limit,
        offset,
      }),
    );

    if (err) {
      throw new NotFoundException("Notifications Not Found");
    }

    return {
      data: userNotifications,
      nextOffset: offset ?? 0 + userNotifications.length,
    };
  }

  async readNotifications(network: Network, user?: string, notificationId?: string) {
    if (!notificationId && !user) {
      throw new BadRequestException("You must indicate a user address or a notification id");
    }
    let [err, _userNotifications] = await asyncAction(
      markNotificationsRead(this.knex, {
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
