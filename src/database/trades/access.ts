/*
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

  async addToTradeDB(trades: TradeInfoResponse[]) {
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

  async addToCounterTradeDB(counterTrades: TradeInfoResponse[]) {
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

  async addToCollectionDB(network: Network, assets: TradeAsset[]) {
    const insertToken = await this.knexDB("counter-trades")
      .insert(
        assets.map(asset => ({
          network,
          denom: asset.denom,
          asset_type: asset.assetType,
        })),
      )
      .onConflict()
      .ignore(); // We ignore if the data is already present
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
        // status: notification.status ?? TradeNotificationStatus.unread,
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

  parseFromDB(dbResult: any): TradeInfo {
    return {
      acceptedInfo: {
        counterId: dbResult.accepted_counter_trade_id,
      },
      assetsWithdrawn: dbResult.assets_withdrawn,
      lastCounterId: dbResult.last_counter_id,
      associatedAssets: JSON.parse(dbResult.associated_assets),
      additionalInfo: {
        ownerComment: {
          comment: dbResult.owner_comment,
          time: dbResult.owner_comment_time,
        },
        time: dbResult.time,
        nftsWanted: JSON.parse(dbResult.nfts_wanted),
        tokensWanted: JSON.parse(dbResult.tokens_wanted),
        tradePreview: JSON.parse(dbResult.trade_preview),
        traderComment: {
          comment: dbResult.trader_comment,
          time: dbResult.trader_comment_time,
        },
      },
      owner: dbResult.owner,
      state: dbResult.state,
      whitelistedUsers: JSON.parse(dbResult.whitelisted_users),
    };
  }

  parseFromCollectionDB(asset: any): TradeAsset {
    return {
      denom: asset.denom,
      assetType: asset.asset_type,
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

    if (parameters?.["filters.owners"]) {
      if (!Array.isArray(parameters["filters.owners"])) {
        parameters["filters.owners"] = [parameters["filters.owners"]];
      }
      currentQuery.whereIn("owner", parameters["filters.owners"]);
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

    if (parameters?.["filters.hasLiquidAsset"] != undefined) {
      // We filter on liquid assets
      if (parameters["filters.hasLiquidAsset"]) {
        currentQuery.where(function () {
          this.orWhereRaw("associated_assets like ?", `%"coin":%`);
          this.orWhereRaw("associated_assets like ?", `%"cw20Coin":%`);
        });
      } else {
        // We filter on only illiquid assets
        console.log("no liquid assets");
        currentQuery.where(function () {
          this.orWhereRaw("associated_assets is null");
          this.orWhere(function () {
            this.andWhereRaw("associated_assets not like ?", `%"coin":%`);
            this.andWhereRaw("associated_assets not like ?", `%"cw20Coin":%`);
          });
        });
      }
    }

    // Sort
    currentQuery.orderBy(
      parameters?.["sorters.parameter"] ?? "trade_id",
      parameters?.["sorters.direction"] ?? "desc",
    );

    // Pagination
    if (limitUsed) {
      currentQuery.offset(parameters?.["pagination.offset"] ?? 0);
      console.log(
        "limit",
        parameters["pagination.limit"],
        process.env.BASE_TRADE_QUERY_LIMIT,
        process.env.MAX_TRADE_QUERY_LIMIT,
      );

      console.log(
        Math.min(
          parameters?.["pagination.limit"] ?? parseInt(process.env.BASE_TRADE_QUERY_LIMIT),
          parseInt(process.env.MAX_TRADE_QUERY_LIMIT),
        ),
      );
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

  async getCounterTradeNumber(parameters: QueryParameters) {
    const counterTradeNumberQuery = this.knexDB("counter-trades");

    await this.applyQueryParameters(counterTradeNumberQuery, false, parameters);

    const counterTradeInfo = await counterTradeNumberQuery.count("id as nbCounterTrade");

    return +counterTradeInfo[0].nbCounterTrade;
  }

  async getTrade(network: Network, tradeId: number): Promise<TradeInfoResponse> {
    const tradeInfo = await this.knexDB("trades").select("*").where({
      network,
      trade_id: tradeId,
    });
    return {
      network: tradeInfo[0].network,
      tradeId: tradeInfo[0].trade_id,
      tradeInfo: this.parseFromDB(tradeInfo[0]),
    };
  }

  async getCounterTrade(
    network: Network,
    tradeId: number,
    counterId: number,
  ): Promise<TradeInfoResponse> {
    const counterTradeInfo = await this.knexDB("counter-trades").select("*").where({
      network,
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

  async getCollections(network: Network) {
    const collections = await this.knexDB("trade-assets-denom").where("network", network);
    return collections.map(collection => this.parseFromCollectionDB(collection));
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
*/
