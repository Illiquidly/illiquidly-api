import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";

import { InjectRepository } from "@nestjs/typeorm";
import { Trade, CounterTrade, TradeNotification, TradeFavorite } from "./entities/trade.entity";
import { CrudRequest, GetManyDefaultResponse } from "@rewiko/crud";

function getResponseIds(res: any) {
  if (res?.data) {
    return res.data.map(r => r.id);
  } else if (Array.isArray(res)) {
    return res.map(r => r.id);
  } else {
    return [res.id];
  }
}

function parseForResponse(dataToReturn, oldRes) {
  if (oldRes?.data) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data, ...metadata } = oldRes;
    return {
      data: dataToReturn,
      ...metadata,
    };
  } else {
    return dataToReturn;
  }
}

export class AbstractTradeCrudService<T> extends TypeOrmCrudService<T> {
  public async getMany(req: CrudRequest): Promise<GetManyDefaultResponse<T> | T[]> {
    const { parsed, options } = req;

    // We start by querying the trade ids that match the filters
    const builder = await this.createBuilder(parsed, options);
    const objectIdsQueryResult = await this.doGetMany(builder, parsed, options);

    const objectIds = getResponseIds(objectIdsQueryResult);
    if (!objectIds.length) {
      return parseForResponse([], objectIdsQueryResult);
    }
    
    parsed.limit = undefined;
    parsed.offset = undefined;
    parsed.page = undefined;


    // Then we select all info of this counterTrade, we simply modify the search argument
    parsed.search = {
      $or: objectIds.map(id => ({
        id,
      })),
    };

    // We make sure we select all field we need now
    Object.keys(options?.query?.join ?? []).forEach(function (key) {
      options.query.join[key].select = true;
    });

    const finalBuilder = await this.createBuilder(parsed, options);
    const data = await finalBuilder.getMany();

    return parseForResponse(data, objectIdsQueryResult);
  }
}

@Injectable()
export class TradeCrudService extends AbstractTradeCrudService<Trade> {
  constructor(@InjectRepository(Trade) repo) {
    super(repo);
  }
}

@Injectable()
export class CounterTradeCrudService extends AbstractTradeCrudService<CounterTrade> {
  constructor(@InjectRepository(CounterTrade) repo) {
    super(repo);
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
