import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { TradesService } from "../trades.service";
import { Network } from "../../utils/blockchain/dto/network.dto";
const pMap = require("p-map");

@Injectable()
export class TradeResultInterceptor implements NestInterceptor {
  constructor(private readonly tradesService: TradesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          const parsedTrades = await pMap(data, async trade =>
            this.tradesService.parseTradeDBToResponse(Network.testnet, trade),
          );
          return {
            data: parsedTrades,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return await pMap(res, async trade =>
            this.tradesService.parseTradeDBToResponse(Network.testnet, trade),
          );
        } else {
          return await this.tradesService.parseTradeDBToResponse(Network.testnet, res);
        }
      }),
    );
  }
}

@Injectable()
export class CounterTradeResultInterceptor implements NestInterceptor {
  constructor(private readonly tradesService: TradesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          const parsedCounterTrades = await pMap(data, async trade =>
            this.tradesService.parseCounterTradeDBToResponse(Network.testnet, trade),
          );
          return {
            data: parsedCounterTrades,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return await pMap(res, async trade =>
            this.tradesService.parseCounterTradeDBToResponse(Network.testnet, trade),
          );
        } else {
          return await this.tradesService.parseCounterTradeDBToResponse(Network.testnet, res);
        }
      }),
    );
  }
}
