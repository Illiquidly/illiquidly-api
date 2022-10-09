import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { TradesService } from "../trades.service";
import { InjectRepository } from "@nestjs/typeorm";
import { CounterTrade, Trade } from "../entities/trade.entity";
import { Repository } from "typeorm";
import { CounterTradeResponse, TradeResponse } from "../dto/getTrades.dto";
const pMap = require("p-map");

@Injectable()
export class TradeResultInterceptor implements NestInterceptor {
  constructor(
    private readonly tradesService: TradesService,
    @InjectRepository(Trade) private tradesRepository: Repository<Trade>,
  ) {}

  async getTradeInfo(data: Trade[]): Promise<TradeResponse[]> {
    if (!data.length) {
      return [];
    }
    const dbTradeInfo = await this.tradesRepository.find({
      where: data,
      relations: {
        nftsWanted: true,
        tradeInfo: {
          cw721Assets: {
            collection: true,
            metadata: {
              attributes: true,
            },
          },
          cw20Assets: true,
          coinAssets: true,
        },
        counterTrades: {
          tradeInfo: true,
        },
      },
    });

    return pMap(
      dbTradeInfo,
      async (trade: Trade): Promise<TradeResponse> =>
        this.tradesService.parseTradeDBToResponse(trade.network, trade),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          // First we get all the trade Info needed (what arrives is only an object with an id)
          const parsedTrades = await this.getTradeInfo(data);

          // Then we return the whole data
          return {
            data: parsedTrades,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return this.getTradeInfo(res);
        } else {
          return await this.getTradeInfo([res]);
        }
      }),
    );
  }
}

@Injectable()
export class CounterTradeResultInterceptor implements NestInterceptor {
  constructor(
    private readonly tradesService: TradesService,
    @InjectRepository(CounterTrade) private counterTradesRepository: Repository<CounterTrade>,
  ) {}

  async getCounterTradeInfo(data: CounterTrade[]): Promise<TradeResponse[]> {
    if (!data.length) {
      return [];
    }
    const dbCounterTradeInfo = await this.counterTradesRepository.find({
      where: data,
      relations: {
        tradeInfo: {
          cw721Assets: {
            collection: true,
            metadata: {
              attributes: true,
            },
          },
          cw20Assets: true,
          coinAssets: true,
        },
        trade: true,
      },
    });

    return pMap(
      dbCounterTradeInfo,
      async (counterTrade: CounterTrade): Promise<CounterTradeResponse> =>
        this.tradesService.parseCounterTradeDBToResponse(counterTrade.network, counterTrade),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          const parsedCounterTrades = await this.getCounterTradeInfo(data);
          return {
            data: parsedCounterTrades,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return this.getCounterTradeInfo(res);
        } else {
          return this.getCounterTradeInfo([res]);
        }
      }),
    );
  }
}
