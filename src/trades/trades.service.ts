import { Injectable, NotFoundException } from "@nestjs/common";
import { getCounterTradeInfo, getTradeInfo } from "../utils/blockchain/p2pTradeQuery";
import { asyncAction } from "../utils/js/asyncAction";
import { MultipleTradeResponse, QueryParameters, Trade } from "./dto/getTrades.dto";
import {
  addToCounterTradeDB,
  addToTradeDB,
  getCounterTrade,
  getCounterTrades,
  getTrade,
  getTrades,
} from "../database/trades/access";
const camelCaseObjectDeep = require("camelcase-object-deep");
import { Network } from "../utils/blockchain/dto/network.dto";
import { InjectKnex, Knex } from "nestjs-knex";

@Injectable()
export class TradesService {
  constructor(@InjectKnex() private readonly knexDB: Knex) {}

  async getMultipleTrades(params: QueryParameters): Promise<MultipleTradeResponse> {
    let [err, tradeInfo] = await asyncAction(getTrades(this.knexDB, params));
    if (err || !tradeInfo.length) {
      throw new NotFoundException("Trades Not Found");
    }
    let offset = params?.["pagination.offset"];
    return {
      data: tradeInfo,
      nextOffset: offset ?? 0 + tradeInfo.length,
    };
  }

  async getMultipleCounterTrades(params: QueryParameters): Promise<MultipleTradeResponse> {
    let [err, tradeInfo] = await asyncAction(getCounterTrades(this.knexDB, params));
    if (err || !tradeInfo.length) {
      throw new NotFoundException("Counter Trades Not Found");
    }
    return tradeInfo;
  }

  async getSingleTrade(network: Network, tradeId: number): Promise<Trade> {
    let [err, tradeInfo] = await asyncAction(getTrade(this.knexDB, network, tradeId));
    if (err) {
      // We try to query the trade on_chain directly :
      let queryErr: any;
      [queryErr, tradeInfo] = await asyncAction(getTradeInfo(network, tradeId));
      if (queryErr) {
        throw new NotFoundException("Trade Not Found");
      }
      tradeInfo = {
        network,
        tradeId,
        counterId: undefined,
        tradeInfo: camelCaseObjectDeep(tradeInfo),
      };
      // We add it to the database
      await addToTradeDB(this.knexDB, [tradeInfo]);
    }
    return tradeInfo;
  }

  async getSingleCounterTrade(
    network: Network,
    tradeId: number,
    counterId: number,
  ): Promise<Trade> {
    let [err, counterTradeInfo] = await asyncAction(
      getCounterTrade(this.knexDB, network, tradeId, counterId),
    );
    if (err) {
      // We try to query the counter_trade on_chain directly :
      let queryErr: any;
      [queryErr, counterTradeInfo] = await asyncAction(
        getCounterTradeInfo(network, tradeId, counterId),
      );
      if (queryErr) {
        throw new NotFoundException("Counter Trade Not Found");
      }
      counterTradeInfo = {
        network,
        tradeId,
        counterId: counterId,
        tradeInfo: camelCaseObjectDeep(counterTradeInfo),
      };
      // We add it to the database
      await addToCounterTradeDB(this.knexDB, [counterTradeInfo]);
    }
    return counterTradeInfo;
  }
}
