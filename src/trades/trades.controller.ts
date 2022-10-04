import { Controller, Patch, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Crud } from "@rewiko/crud";
import {
  CounterTradeResponse,
  SingleCounterTradeParameters,
  SingleTradeParameters,
  TradeResponse,
} from "./dto/getTrades.dto";
import { CounterTrade, Trade, TradeNotification } from "./entities/trade.entity";
import {
  CounterTradeResultInterceptor,
  TradeResultInterceptor,
} from "./interceptors/trades.interceptor";
import {
  CounterTradeCrudService,
  TradeCrudService,
  TradeNotificationCrudService,
} from "./tradeCrud.service";
import { TradesService } from "./trades.service";

@ApiTags("Trades")
@Crud({
  model: {
    type: Trade,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      nftsWanted: {
        eager: true,
      },
      tradeInfo: {
        eager: true,
      },
      "tradeInfo.cw721Assets": {
        eager: true,
        alias: "tradeInfo_cw721Assets_join",
      },
      "tradeInfo.cw721Assets.collection": {
        eager: true,
        alias: "tradeInfo_cw721Assets_collection_join",
      },
      "tradeInfo.cw721Assets.metadata": {
        eager: true,
        alias: "tradeInfo_cw721Assets_metadata_join",
      },
      "tradeInfo.cw721Assets.metadata.attributes": {
        eager: true,
        alias: "tradeInfo_cw721Assets_metadata_attributes_join",
      },
      "tradeInfo.cw20Assets": {
        eager: true,
      },
      "tradeInfo.coinAssets": {
        eager: true,
      },
      counterTrades: {
        eager: true,
      },
      "counterTrades.tradeInfo": {
        eager: true,
        alias: "counterTrade_tradeInfo_join",
      },
    },
  },
  routes: {
    getOneBase: {
      decorators: [],
      interceptors: [TradeResultInterceptor],
    },
    getManyBase: {
      decorators: [],
      interceptors: [TradeResultInterceptor],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("trades")
export class TradesController {
  constructor(private readonly tradesService: TradesService, public service: TradeCrudService) {}

  @Patch("")
  @ApiResponse({
    status: 200,
    type: () => TradeResponse,
    description: "Queries the information about a posted trade",
  })
  async getSingleTrade(@Query() params: SingleTradeParameters) {
    return await this.tradesService.getTradeById(params.network, params.tradeId);
  }
}

@ApiTags("Trades")
@Crud({
  model: {
    type: CounterTrade,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      tradeInfo: {
        eager: true,
      },
      "tradeInfo.cw721Assets": {
        eager: true,
        alias: "tradeInfo_cw721Assets_join",
      },
      "tradeInfo.cw721Assets.collection": {
        eager: true,
        alias: "tradeInfo_cw721Assets_collection_join",
      },
      "tradeInfo.cw721Assets.metadata": {
        eager: true,
        alias: "tradeInfo_cw721Assets_metadata_join",
      },
      "tradeInfo.cw721Assets.metadata.attributes": {
        eager: true,
        alias: "tradeInfo_cw721Assets_metadata_attributes_join",
      },
      "tradeInfo.cw20Assets": {
        eager: true,
      },
      "tradeInfo.coinAssets": {
        eager: true,
      },
      trade: {
        eager: true,
      },
    },
  },
  routes: {
    getOneBase: {
      decorators: [],
      interceptors: [CounterTradeResultInterceptor],
    },
    getManyBase: {
      decorators: [],
      interceptors: [CounterTradeResultInterceptor],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("counter-trades")
export class CounterTradesController {
  constructor(
    private readonly tradesService: TradesService,
    public service: CounterTradeCrudService,
  ) {}

  @Patch("")
  @ApiResponse({
    status: 200,
    type: () => CounterTradeResponse,
    description: "Queries the information about a posted counter trade",
  })
  async getSingleCounterTrade(@Query() params: SingleCounterTradeParameters) {
    return await this.tradesService.getCounterTradeById(
      params.network,
      params.tradeId,
      params.counterId,
    );
  }
}

@ApiTags("Trades")
@Crud({
  model: {
    type: TradeNotification,
  },
  query: {
    limit: 10,
    sort: [],
  },
  routes: {
    getOneBase: {
      decorators: [],
    },
    getManyBase: {
      decorators: [],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("trade-notifications")
export class TradeNotificationController {
  constructor(public service: TradeNotificationCrudService) {}
}
