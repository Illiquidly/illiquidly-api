import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Network } from "../utils/blockchain/dto/network.dto";
import { Repository } from "typeorm";
import { TradeNotification, TradeNotificationStatus } from "./entities/trade.entity";

@Injectable()
export class TradeNotificationsService {
  constructor(
    @InjectRepository(TradeNotification)
    private notificationRepository: Repository<TradeNotification>,
  ) {}

  async readNotifications(network: Network, user: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(TradeNotification)
      .set({ status: TradeNotificationStatus.read })
      .where("network = :network", { network })
      .andWhere("user = :user", { user })
      .execute();
  }
}
