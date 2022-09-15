import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { Knex } from "knex";
import { InjectKnex } from "nestjs-knex";
import { RedisService } from "nestjs-redis";
const pMap = require("p-map");
import {
  QueryParameters,
  Trade,
  TradeInfo,
  TradeNotification,
} from "../../trades/dto/getTrades.dto";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { NFTInfoService } from "../nft_info/access";

@Injectable()
export class TradeDatabaseService {
  redisDB: Redis;
  constructor(
    @InjectKnex() private readonly knexDB: Knex,
    private readonly redisService: RedisService,
    private readonly nftInfoService: NFTInfoService,
  ) {
    this.redisDB = redisService.getClient();
  }

  DATE_FORMATER = async (date, format) =>
    await import("dateformat").then((dateformat: any) => dateformat(date, format));

  getDBFields(tradeInfo: TradeInfo) {
    return {
      owner: tradeInfo.owner,
      time: tradeInfo.additionalInfo.time,
      last_counter_id: tradeInfo.lastCounterId,
      owner_comment: tradeInfo.additionalInfo.ownerComment?.comment,
      owner_comment_time: tradeInfo.additionalInfo.ownerComment?.time,
      trader_comment: tradeInfo.additionalInfo.traderComment?.comment,
      trader_comment_time: tradeInfo.additionalInfo.traderComment?.time,
      state: tradeInfo.state,
      accepted_counter_trade_id: tradeInfo.acceptedInfo?.counterId,
      assets_withdrawn: tradeInfo.assetsWithdrawn,
      associated_assets: JSON.stringify(tradeInfo.associatedAssets),
      whitelisted_users: JSON.stringify(tradeInfo.whitelistedUsers),
      nfts_wanted: JSON.stringify(tradeInfo.additionalInfo.nftsWanted),
      tokens_wanted: JSON.stringify(tradeInfo.additionalInfo.tokensWanted),
      trade_preview: JSON.stringify(tradeInfo.additionalInfo.tradePreview),
      whole_data: tradeInfo,
    };
  }

  async addToTradeDB(trades: Trade[]) {
    const insertToken = await this.knexDB("trades")
      .insert(
        trades.map(trade => ({
          network: trade.network,
          trade_id: trade.tradeId,
          ...this.getDBFields(trade.tradeInfo),
        })),
      )
      .onConflict()
      .merge(); // We erase if the data is already present
    return insertToken;
  }

  async addToCounterTradeDB(counterTrades: Trade[]) {
    const insertToken = await this.knexDB("counter-trades")
      .insert(
        counterTrades.map(counterTrade => ({
          network: counterTrade.network,
          tradeId: counterTrade.tradeId,
          counterId: counterTrade.counterId,
          ...this.getDBFields(counterTrade.tradeInfo),
        })),
      )
      .onConflict()
      .merge(); // We erase if the data is already present
    return insertToken;
  }

  async addToNotificationDB(notifications: TradeNotification[]) {
    const insertToken = await this.knexDB("notifications").insert(
      notifications.map((notification: TradeNotification) => ({
        time: this.DATE_FORMATER(new Date(notification.time), "yyyy-mm-dd HH:MM:ss"),
        user: notification.user,
        trade_id: notification.tradeId,
        counter_id: notification.counterId,
        notification_type: notification.notificationType,
        status: "unread",
        //status: notification.status ?? TradeNotificationStatus.unread,
      })),
    );
    return insertToken;
  }

  async markNotificationsRead({
    network,
    notificationId,
    user,
  }: {
    network: Network;
    notificationId?: string;
    user?: string;
  }) {
    const updateRequest = this.knexDB("notifications").where("network", network);
    if (notificationId) {
      updateRequest.where("id", notificationId);
    }
    if (user) {
      updateRequest.where("user", user);
    }
    const requestToken = await updateRequest.update({
      status: "read",
    });
    return requestToken;
  }

  parseFromDB(db_result: any): TradeInfo {
    return {
      network: db_result.network,
      acceptedInfo: {
        counterId: db_result.accepted_counter_trade_id,
      },
      assetsWithdrawn: db_result.assets_withdrawn,
      lastCounterId: db_result.last_counter_id,
      associatedAssets: JSON.parse(db_result.associated_assets),
      additionalInfo: {
        ownerComment: {
          comment: db_result.owner_comment,
          time: db_result.owner_comment_time,
        },
        time: db_result.time,
        nftsWanted: JSON.parse(db_result.nfts_wanted),
        tokensWanted: JSON.parse(db_result.tokens_wanted),
        tradePreview: JSON.parse(db_result.trade_preview),
        traderComment: {
          comment: db_result.trader_comment,
          time: db_result.trader_comment_time,
        },
      },
      owner: db_result.owner,
      state: db_result.state,
      whitelistedUsers: JSON.parse(db_result.whitelisted_users),
    };
  }

  parseFromNotificationDB(notification: any): TradeNotification {
    return {
      network: notification.network,
      id: notification.id,
      time: notification.time,
      user: notification.user,
      tradeId: notification.trade_id,
      counterId: notification.counter_id,
      notificationType: notification.notification_type,
      status: notification.status,
    };
  }

  async applyQueryParameters(
    currentQuery: Knex.QueryBuilder,
    limitUsed: boolean,
    parameters: QueryParameters,
  ) {
    // Filters
    currentQuery.where("network", parameters["filters.network"]);

    if (parameters?.["filters.globalSearch"]) {
      const nfts = await this.nftInfoService.getNftInfoByPartialName(
        parameters["filters.network"],
        parameters["filters.globalSearch"],
      );
      currentQuery.where(function () {
        // We first search the whole data with the raw query
        this.orWhereRaw("whole_data like ?", `%${parameters["filters.globalSearch"]}%`);
        // We then search the whole data with the found collection names
        for (const nft of nfts) {
          this.orWhereRaw("whole_data like ?", `%${nft.nftAddress}%`);
        }
      });
    }

    if (parameters?.["filters.counteredBy"]) {
      currentQuery.whereIn("trade_id", function () {
        if (!Array.isArray(parameters["filters.counteredBy"])) {
          parameters["filters.counteredBy"] = [parameters["filters.counteredBy"]];
        }
        this.select("trade_id")
          .from("counter-trades")
          .whereIn("owner", parameters["filters.counteredBy"]);
      });
    }

    if (parameters?.["filters.tradeId"]) {
      if (!Array.isArray(parameters["filters.tradeId"])) {
        parameters["filters.tradeId"] = [parameters["filters.tradeId"]];
      }
      currentQuery.whereIn("trade_id", parameters["filters.tradeId"]);
    }

    if (parameters?.["filters.state"]) {
      if (!Array.isArray(parameters["filters.state"])) {
        parameters["filters.state"] = [parameters["filters.state"]];
      }
      currentQuery.whereIn("state", parameters["filters.state"]);
    }

    if (parameters?.["filters.collections"]) {
      if (!Array.isArray(parameters["filters.collections"])) {
        parameters["filters.collections"] = [parameters["filters.collections"]];
      }
      currentQuery.where(function () {
        for (const collection of parameters["filters.collections"]) {
          this.orWhereRaw("associated_assets like ?", `%${collection}%`);
        }
      });
    }

    if (parameters?.["filters.whitelistedUsers"]) {
      if (!Array.isArray(parameters["filters.whitelistedUsers"])) {
        parameters["filters.whitelistedUsers"] = [parameters["filters.whitelistedUsers"]];
      }
      currentQuery.where(function () {
        for (const user of parameters["filters.whitelistedUsers"]) {
          this.orWhereRaw("whitelisted_users like ?", `%${user}%`);
        }
      });
    }

    if (parameters?.["filters.lookingFor"]) {
      if (!Array.isArray(parameters["filters.lookingFor"])) {
        parameters["filters.lookingFor"] = [parameters["filters.lookingFor"]];
      }

      const possibleNfts = (
        await pMap(parameters?.["filters.lookingFor"], async (address: string) => {
          console.log(address);
          return await this.nftInfoService.getNftInfoByPartialName(
            parameters["filters.network"],
            address,
          );
        })
      ).flat();

      currentQuery.where(function () {
        for (const address of parameters?.["filters.lookingFor"] ?? []) {
          this.orWhereRaw("nfts_wanted like ?", `%${address}%`);
          this.orWhereRaw("tokens_wanted like ?", `%${address}%`);
        }

        // We also tranform token names to addresses if ever the search is for a token Name
        for (const nft of possibleNfts?.["filters.lookingFor"] ?? []) {
          this.orWhereRaw("nfts_wanted like ?", `%${nft}%`);
        }
      });
    }

    // Sort
    currentQuery.orderBy(
      parameters?.["sorters.parameter"] ?? "trade_id",
      parameters?.["sorters.direction"] ?? "desc",
    );

    // Pagination
    if (limitUsed) {
      currentQuery.offset(parameters?.["pagination.offset"] ?? 0);

      currentQuery.limit(
        Math.min(
          parameters?.["pagination.limit"] ?? parseInt(process.env.BASE_TRADE_QUERY_LIMIT),
          parseInt(process.env.MAX_TRADE_QUERY_LIMIT),
        ),
      );
    }
  }

  async getTrades(parameters: QueryParameters) {
    const tradeInfoQuery = this.knexDB("trades").select("*");

    await this.applyQueryParameters(tradeInfoQuery, true, parameters);

    const tradeInfo = await tradeInfoQuery;

    return tradeInfo.map(info => ({
      tradeId: info.trade_id,
      tradeInfo: this.parseFromDB(info),
    }));
  }

  async getTradeNumber(parameters: QueryParameters) {
    const tradeNumberQuery = this.knexDB("trades");

    await this.applyQueryParameters(tradeNumberQuery, false, parameters);

    const tradeInfo = await tradeNumberQuery.count("id as nbTrade");
    return +tradeInfo[0].nbTrade;
  }

  async getCounterTrades(parameters: QueryParameters) {
    const counterTradeInfoQuery = this.knexDB("counter-trades").select("*");

    await this.applyQueryParameters(counterTradeInfoQuery, true, parameters);

    const counterTradeInfo = await counterTradeInfoQuery;

    return counterTradeInfo.map(info => ({
      tradeId: info.trade_id,
      counterId: info.counter_id,
      tradeInfo: this.parseFromDB(info),
    }));
  }

  async getTrade(network: Network, tradeId: number): Promise<Trade> {
    const tradeInfo = await this.knexDB("trades").select("*").where({
      network: network,
      trade_id: tradeId,
    });
    return {
      network: tradeInfo[0].network,
      tradeId: tradeInfo[0].trade_id,
      tradeInfo: this.parseFromDB(tradeInfo[0]),
    };
  }

  async getCounterTrade(network: Network, tradeId: number, counterId: number): Promise<Trade> {
    const counterTradeInfo = await this.knexDB("counter-trades").select("*").where({
      network: network,
      trade_id: tradeId,
      counter_id: counterId,
    });
    return {
      network: counterTradeInfo[0].network,
      tradeId: counterTradeInfo[0].trade_id,
      counterId: counterTradeInfo[0].counter_id,
      tradeInfo: this.parseFromDB(counterTradeInfo[0]),
    };
  }

  async getNotifications({
    network,
    user,
    limit,
    offset,
  }: {
    network: Network;
    user?: string;
    limit?: number;
    offset?: number;
  }): Promise<TradeNotification[]> {
    const notificationInfoQuery = this.knexDB("notifications")
      .select("*")
      .orderBy([
        { column: "time", order: "desc" },
        { column: "id", order: "desc" },
      ])
      .where("network", network)
      .offset(offset ?? 0)
      .limit(
        Math.min(
          limit ?? parseInt(process.env.BASE_TRADE_QUERY_LIMIT),
          parseInt(process.env.MAX_TRADE_QUERY_LIMIT),
        ),
      );

    if (user) {
      notificationInfoQuery.where("user", user);
    }

    const notifications = await notificationInfoQuery;

    return notifications.map(notification => this.parseFromNotificationDB(notification));
  }

  async getNotificationNumber({
    network,
    user,
  }: {
    network: Network;
    user?: string;
  }): Promise<number> {
    const notificationNumberQuery = this.knexDB("notifications")
      .where("network", network)
      .count("id as nbNotif");

    if (user) {
      notificationNumberQuery.where("user", user);
    }

    const notificationNumber = await notificationNumberQuery;

    return +notificationNumber[0].nbNotif;
  }
}
