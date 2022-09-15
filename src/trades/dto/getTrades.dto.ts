import { Transform } from "class-transformer";
import { IsInt } from "class-validator";
import { Network } from "../../utils/blockchain/dto/network.dto";

export interface Collection {
  collectionAddress: string;
  collectionName: string;
}

export interface Coin {
  currency?: string;
  amount?: string;
}

export class Asset {
  [asset: string]: {
    address: string;
    amount?: string;
    tokenId?: string;
    denom?: string;
  };
}
export class TradeInfo {
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
    tokensWanted: Asset[];
    lookingFor?: Array<Partial<Collection> & Coin>;
    tradePreview?: any;
    traderComment?: {
      comment: string;
      time: string;
    };
  };
  owner: string;
  state: string;
  whitelistedUsers: string[];
}

export class Trade {
  network: Network;
  tradeId: number;
  counterId?: number;
  tradeInfo: TradeInfo;
}

export enum TradeNotificationType {
  newCounterTrade = "new_counter_trade",
  counterTradeReview = "counter_trade_review",
  counterTradeAccepted = "counter_trade_accepted",
  counterTradeCancelled = "counter_trade_cancelled",
}

enum TradeNotificationStatus {
  unread = "unread",
  read = "read",
}

export class TradeNotification {
  id?: number;
  time: string;
  user: string;
  network: string;
  tradeId: number;
  counterId: number;
  notificationType: TradeNotificationType;
  status?: TradeNotificationStatus;
}

export class QueryParameters {
  /* Filters section */
  "filters.network": Network;
  "filters.globalSearch"?: string;
  "filters.tradeId"?: number[] | number;
  "filters.state"?: string[] | string;
  "filters.collections"?: string[] | string;
  "filters.lookingFor"?: string[] | string;
  "filters.counteredBy"?: string[] | string;
  "filters.whitelistedUsers"?: string[] | string;

  /* Pagination section */
  "pagination.offset"?: number;
  "pagination.limit"?: number;

  /* Sorters section */
  "sorters.parameter"?: string;
  "sorters.direction"?: string;
}

export class SingleTradeParameters {
  network: Network;

  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  tradeId: number;
}

export class SingleCounterTradeParameters {
  network: Network;

  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  tradeId: number;

  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  counterId: number;
}

export class MultipleTradeResponse {
  data: Trade[];
  nextOffset: number | null;
  totalNumber: number;
}

export class MultipleNotificationsResponse {
  data: TradeNotification[];
  nextOffset: number | null;
  totalNumber: number;
}
