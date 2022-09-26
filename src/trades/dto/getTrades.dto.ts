import { Transform } from "class-transformer";

import { IsInt } from "class-validator";
import { CW721Collection } from "src/utils-api/entities/nft-info.entity";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { CounterTrade, RawAsset, Trade } from "../entities/trade.entity";

export interface Collection {
  collectionAddress: string;
  collectionName: string;
}

export interface RawCoin {
  currency?: string;
  amount?: string;
}

export type Asset = Coin & CW20Coin & CW721Coin & CW1155Coin;

export class Coin {
  coin: {
    denom: string;
    amount: string;
  };
}

export class CW20Coin {
  cw20Coin: {
    address: string;
    amount: string;
  };
}
export class CW721Coin {
  cw721Coin: {
    address: string;
    tokenId: string;
  };
}
export class CW1155Coin {
  cw1155Coin: {
    address: string;
    tokenId: string;
    value: string;
  };
}

export class TradeInfo {
  acceptedInfo?: any; // TODO correct this type
  assetsWithdrawn: boolean;
  associatedAssets: RawAsset[];
  associatedAssetsWithInfo?: any[];
  associatedCollections?: Partial<Collection>[];
  lastCounterId?: number;
  additionalInfo: {
    ownerComment: {
      comment: string;
      time: string;
    };
    time: string;
    nftsWanted?: CW721Collection[];
    tokensWanted: Asset[];
    lookingFor?: (Partial<CW721Collection> | RawCoin)[];
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

export class CounterTradeInfoResponse {
  network: Network;
  counterId: number;
  primary_id: number;
  trade: Trade;
  tradeInfo: TradeInfo;
}

export class TradeInfoResponse {
  network: Network;
  tradeId: number;
  primary_id: number;
  counterTrades: CounterTrade[];
  tradeInfo: TradeInfo;
}
/*
export class QueryParameters {
  "filters.network": Network;
  "filters.globalSearch"?: string;
  "filters.tradeId"?: number[];
  "filters.owners"?: string[];
  "filters.state"?: string[];
  "filters.collections"?: string[];
  "filters.lookingFor"?: string[];
  "filters.counteredBy"?: string[];
  "filters.whitelistedUsers"?: string[];

  @Transform(({ value }) => value === "true")
  "filters.hasLiquidAsset"?: boolean;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  "pagination.offset"?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  "pagination.limit"?: number;

  "sorters.parameter"?: string;
  "sorters.direction"?: string;
}

*/

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
