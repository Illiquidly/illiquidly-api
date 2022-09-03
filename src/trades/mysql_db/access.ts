import { Knex } from "knex";
import { Network } from "src/utils/blockchain/dto/network.dto";

import { getNftInfoByPartialName } from "../../utils/mysql_db_accessor";
import { getTradeDB } from "./structure.js";
const DATE_FORMATER = async (date, format) => await import("dateformat").then((dateformat: any) => dateformat(date, format))
export type Asset = {
  [asset: string]: {
    address: string;
    amount?: number;
    tokenId?: string;
    denom?: string;
  };
};
interface TradeInfo {
  network: Network;
  acceptedInfo?: any; // TODO correct this type
  assetsWithdrawn: boolean;
  associatedAssets: Asset[];
  lastCounterId?: number;
  additionalInfo: {
    ownerComment: {
      comment: string;
      time: string;
    };
    time: string;
    nftsWanted: string[];
    traderComment?: {
      comment: string;
      time: string;
    };
  };
  owner: string;
  state: string;
  whitelistedUsers: string[];
}

interface Trade {
  network: Network;
  tradeId: number;
  counterId?: number;
  tradeInfo: TradeInfo;
}

enum TradeNotificationType {
  newCounterTrade = "new_counter_trade",
  counterTradeReview = "counter_trade_review",
  counterTradeAccepted = "counter_trade_accepted",
  counterTradeCancelled = "counter_trade_cancelled",
}

enum TradeNotificationStatus {
  unread = "unread",
  read = "read",
}

interface TradeNotification {
  id?: number;
  time: string;
  user: string;
  tradeId: number;
  counterId: number;
  notificationType: TradeNotificationType;
  status?: TradeNotificationStatus;
}

interface QueryParameters {
  /* Filters section */
  "filters.globalSearch"?: string;
  "filters.trade_id"?: number[];
  "filters.state"?: string[];
  "filters.collections"?: string[];
  "filters.lookingFor"?: string[];
  "filters.counteredBy"?: string;
  "filters.whitelistedUsers"?: string[];

  /* Pagination section */
  "pagination.offset"?: number;
  "pagination.limit"?: number;

  /* Sorters section */
  "sorters.parameter"?: string;
  "sorters.direction"?: string;
}

function getDBFields(tradeInfo: TradeInfo) {
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
    whole_data: tradeInfo,
  };
}

async function addToTradeDB(trades: Trade[]) {
  let knexDB = getTradeDB();
  let insertToken = await knexDB("trades")
    .insert(
      trades.map(trade => ({
        network: trade.network,
        trade_id: trade.tradeId,
        ...getDBFields(trade.tradeInfo),
      })),
    )
    .onConflict()
    .merge(); // We erase if the data is already present
  return insertToken;
}

async function addToCounterTradeDB(counterTrades: Trade[]) {
  let knexDB = getTradeDB();
  let insertToken = await knexDB("counter-trades")
    .insert(
      counterTrades.map(counterTrade => ({
        network: counterTrade.network,
        tradeId: counterTrade.tradeId,
        counterId: counterTrade.counterId,
        ...getDBFields(counterTrade.tradeInfo),
      })),
    )
    .onConflict()
    .merge(); // We erase if the data is already present
  return insertToken;
}

async function addToNotificationDB(notifications: TradeNotification[]) {
  let knexDB = getTradeDB();
  let insertToken = await knexDB("notifications").insert(
    notifications.map((notification: TradeNotification) => ({
      time: DATE_FORMATER(new Date(notification.time), "yyyy-mm-dd HH:MM:ss"),
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

async function markNotificationsRead({
  network,
  notificationId,
  user,
}: {
  network: Network,
  notificationId?: string;
  user?: string;
}) {
  let knexDB = getTradeDB();
  let updateRequest = knexDB("notifications")
    .where("network",network);
  if (notificationId) {
    updateRequest.where("id", notificationId);
  }
  if (user) {
    updateRequest.where("user", user);
  }
  let requestToken = await updateRequest.update({
    status: "read",
  });
  return requestToken;
}

function parseFromDB(db_result: any): TradeInfo {
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
      traderComment: {
        comment: db_result.trader_comment,
        time: db_result.trader_comment_time,
      },
    },
    owner: db_result.owner,
    state: db_result.state,
    whitelistedUsers: db_result.whitelisted_users,
  };
}

function parseFromNotificationDB(notification: any): TradeNotification {
  return {
    id: notification.id,
    time: notification.time,
    user: notification.user,
    tradeId: notification.trade_id,
    counterId: notification.counter_id,
    notificationType: notification.notification_type,
    status: notification.status,
  };
}

async function applyQueryParameters(currentQuery: Knex.QueryBuilder, parameters?: QueryParameters) {
  // Filters
  currentQuery.where("network", parameters["filters.network"]);

  if (parameters?.["filters.globalSearch"]) {
    let nfts = await getNftInfoByPartialName(
      process.env.CHAIN!,
      parameters["filters.globalSearch"]!,
    );
    currentQuery.where(function () {
      // We first search the whole data with the raw query
      this.whereRaw("whole_data like ?", `%${parameters["filters.globalSearch"]}%`);
      // We then search the whole data with the found collection names
      for (let nft of nfts) {
        this.orWhereRaw("whole_data like ?", `%${nft.nftAddress}%`);
      }
    });
  }

  if (parameters?.["filters.counteredBy"]) {
    currentQuery.whereIn("trade_id", function () {
      this.select("trade_id")
        .from("counter-trades")
        .where("owner", parameters["filters.counteredBy"]);
    });
  }

  if (parameters?.["filters.trade_id"]) {
    currentQuery.whereIn("trade_id", parameters["filters.trade_id"]);
  }

  if (parameters?.["filters.state"]) {
    currentQuery.whereIn("state", parameters["filters.state"]);
  }

  if (parameters?.["filters.collections"]) {
    currentQuery.where(function () {
      for (let collection of parameters["filters.collections"]!) {
        this.orWhereRaw("associated_assets like ?", `%${collection}%`);
      }
    });
  }

  if (parameters?.["filters.whitelistedUsers"]) {
    currentQuery.where(function () {
      for (let user of parameters["filters.whitelistedUsers"]!) {
        this.orWhereRaw("whitelisted_users like ?", `%${user}%`);
      }
    });
  }

  if (parameters?.["filters.lookingFor"]) {
    currentQuery.where(function () {
      for (let nft of parameters["filters.lookingFor"]!) {
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
  currentQuery.offset(parameters?.["pagination.offset"] ?? 0);

  currentQuery.limit(
    Math.min(
      parameters?.["pagination.limit"] ?? parseInt(process.env.BASE_TRADE_QUERY_LIMIT!),
      parseInt(process.env.MAX_TRADE_QUERY_LIMIT!),
    ),
  );
}

async function getTrades(parameters?: QueryParameters) {
  let knexDB = getTradeDB();
  let tradeInfoQuery = knexDB("trades").select("*");

  await applyQueryParameters(tradeInfoQuery, parameters);

  let tradeInfo = await tradeInfoQuery;

  return tradeInfo.map(info => ({
    tradeId: info.trade_id,
    tradeInfo: parseFromDB(info),
  }));
}

async function getCounterTrades(parameters?: QueryParameters) {
  let knexDB = getTradeDB();
  let counterTradeInfoQuery = knexDB("counter-trades").select("*");

  await applyQueryParameters(counterTradeInfoQuery, parameters);

  let counterTradeInfo = await counterTradeInfoQuery;

  return counterTradeInfo.map(info => ({
    tradeId: info.trade_id,
    counterId: info.counter_id,
    tradeInfo: parseFromDB(info),
  }));
}

async function getTrade(network: Network, tradeId: number): Promise<Trade> {
  let knexDB = getTradeDB();
  let tradeInfo = await knexDB("trades").select("*").where({
    network: network,
    trade_id: tradeId,
  });
  return {
    network: tradeInfo[0].network,
    tradeId: tradeInfo[0].trade_id,
    tradeInfo: parseFromDB(tradeInfo[0]),
  };
}

async function getCounterTrade(network: Network, tradeId: number, counterId: number): Promise<Trade> {
  let knexDB = getTradeDB();
  let counterTradeInfo = await knexDB("counter-trades").select("*").where({
    network: network,
    trade_id: tradeId,
    counter_id: counterId,
  });
  return {
    network: counterTradeInfo[0].network,
    tradeId: counterTradeInfo[0].trade_id,
    counterId: counterTradeInfo[0].counter_id,
    tradeInfo: parseFromDB(counterTradeInfo[0]),
  };
}

async function getNotifications({
  network,
  user,
  limit,
  offset,
}: {
  network: Network,
  user?: string;
  limit?: number;
  offset?: number;
}): Promise<TradeNotification[]> {
  let knexDB = getTradeDB();
  let notificationInfoQuery = knexDB("notifications")
    .select("*")
    .orderBy([
      { column: "time", order: "desc" },
      { column: "id", order: "desc" },
    ])
    .where("network",network)
    .offset(offset ?? 0)
    .limit(
      Math.min(
        limit ?? parseInt(process.env.BASE_TRADE_QUERY_LIMIT!),
        parseInt(process.env.MAX_TRADE_QUERY_LIMIT!),
      ),
    );

  if (user) {
    notificationInfoQuery.where("user", user);
  }

  let notifications = await notificationInfoQuery;

  return notifications.map(notification => parseFromNotificationDB(notification));
}

export {
  addToTradeDB,
  addToCounterTradeDB,
  addToNotificationDB,
  markNotificationsRead,
  getTrades,
  getCounterTrades,
  getTrade,
  getCounterTrade,
  getNotifications,
  TradeInfo,
  Trade,
  TradeNotification,
};
