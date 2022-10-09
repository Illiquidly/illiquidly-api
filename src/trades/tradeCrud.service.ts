import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";

import { InjectRepository } from "@nestjs/typeorm";
import { Trade, CounterTrade, TradeNotification, TradeFavorite } from "./entities/trade.entity";
import { CrudRequest, GetManyDefaultResponse } from "@rewiko/crud";

@Injectable()
export class TradeCrudService extends TypeOrmCrudService<Trade> {
  constructor(@InjectRepository(Trade) repo) {
    super(repo);
  }

  public async getMany(req: CrudRequest): Promise<GetManyDefaultResponse<Trade> | Trade[]> {
    const { parsed, options } = req;

    // We start by querying the trade ids that match the filters
    let tradeIds = await (await this.createBuilder(parsed, options)).getMany();
    if (!Array.isArray(tradeIds)) {
      tradeIds = [tradeIds];
    }

    // Then we select all info of this trade
    // Parsed stays the same, you remove filter, you remove search, you add or for all ids selected
    parsed.search = {};
    parsed.filter = [];
    parsed.or = tradeIds.map(trade => ({
      field: "id",
      operator: "$eq",
      value: trade.id,
    }));
    // We make sure we select all field we need now
    Object.keys(options?.query?.join ?? []).forEach(function (key, index) {
      options.query.join[key].select = true;
    });

    const builder = await this.createBuilder(parsed, options);
    return this.doGetMany(builder, parsed, options);
  }
}

@Injectable()
export class CounterTradeCrudService extends TypeOrmCrudService<CounterTrade> {
  constructor(@InjectRepository(CounterTrade) repo) {
    super(repo);
  }

  public async getMany(req: CrudRequest): Promise<GetManyDefaultResponse<CounterTrade> | CounterTrade[]> {
    const { parsed, options } = req;

    // We start by querying the trade ids that match the filters
    let counterTradeIds = await (await this.createBuilder(parsed, options)).getMany();
    if (!Array.isArray(counterTradeIds)) {
      counterTradeIds = [counterTradeIds];
    }

    // Then we select all info of this counterTrade
    // Parsed stays the same, you remove filter, you remove search, you add or for all ids selected
    parsed.search = {};
    parsed.filter = [];
    parsed.or = counterTradeIds.map(counterTrade => ({
      field: "id",
      operator: "$eq",
      value: counterTrade.id,
    }));
    // We make sure we select all field we need now
    Object.keys(options?.query?.join ?? []).forEach(function (key, index) {
      options.query.join[key].select = true;
    });

    const builder = await this.createBuilder(parsed, options);
    return this.doGetMany(builder, parsed, options);
  }
}

@Injectable()
export class TradeNotificationCrudService extends TypeOrmCrudService<TradeNotification> {
  constructor(@InjectRepository(TradeNotification) repo) {
    super(repo);
  }
}

@Injectable()
export class TradeFavoriteCrudService extends TypeOrmCrudService<TradeNotification> {
  constructor(@InjectRepository(TradeFavorite) repo) {
    super(repo);
  }
}
