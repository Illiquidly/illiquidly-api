import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { IsInt } from "class-validator";
import { AssetResponse } from "src/utils-api/dto/nft.dto";
import { CW721Collection } from "../../utils-api/entities/nft-info.entity";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { CounterTrade, Trade } from "../entities/trade.entity";

export interface TradeInfoResponse {
  acceptedInfo: {
    counterId?: number;
  };
  assetsWithdrawn: boolean;
  lastCounterId?: number;
  associatedAssets: AssetResponse[];
  additionalInfo: {
    ownerComment: {
      comment: string;
      time: string;
    };
    time: string;
    nftsWanted?: CW721Collection[];
    tokensWanted: AssetResponse[];
    tradePreview: AssetResponse[];
    traderComment: {
      comment?: string;
      time?: string;
    };
    lookingFor?: (Partial<CW721Collection> & {
      currency?: string;
      amount?: string;
    })[];
  };
  owner: string;
  state: string;
  whitelistedUsers: string[];
}

export class CounterTradeResponse {
  network: Network;
  counterId: number;
  id: number;
  trade: Trade;
  tradeInfo: TradeInfoResponse;
}

export class TradeResponse {
  network: Network;
  tradeId: number;
  id: number;
  counterTrades: CounterTrade[];
  tradeInfo: TradeInfoResponse;
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
