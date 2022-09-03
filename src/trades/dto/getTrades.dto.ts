import { Transform } from "class-transformer";
import { IsInt } from "class-validator";
import { Network } from "../../utils/blockchain/dto/network.dto";

export class Asset {
  [asset: string]: {
    address: string;
    amount?: number;
    tokenId?: string;
    denom?: string;
  };
};
export class TradeInfo {
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

export class SingleTradeParameters {

  network: Network;

  @IsInt()
  @Transform(({value}) => Number.parseInt(value))
  tradeId: number;
}

export class SingleCounterTradeParameters {
  network: Network;

  @IsInt()
  @Transform(({value}) => Number.parseInt(value))
  tradeId: number;

  @IsInt()
  @Transform(({value}) => Number.parseInt(value))
  counterId: number;
}

export class MultipleTradeResponse{
  data : Trade[];
  next_offset: number | null;
}

export class MultipleNotificationsResponse{
  data : TradeNotification[];
  next_offset: number | null;
}
