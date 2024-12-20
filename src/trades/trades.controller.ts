import { Controller, Patch, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Crud } from "@rewiko/crud";
import {
  CounterTradeResponse,
  SingleCounterTradeParameters,
  SingleTradeParameters,
  TradeResponse,
} from "./dto/getTrades.dto";
import { NotificationsRead } from "./dto/notifications.dto";
import { TradeFavoriteMessage } from "./dto/tradeFavorite.dto";
import { CounterTrade, Trade, TradeFavorite, TradeNotification } from "./entities/trade.entity";
import {
  CounterTradeResultInterceptor,
  TradeResultInterceptor,
} from "./interceptors/trades.interceptor";
import {
  CounterTradeCrudService,
  TradeCrudService,
  TradeFavoriteCrudService,
  TradeNotificationCrudService,
} from "./tradeCrud.service";
import { TradeFavoritesService } from "./trades.favorites.service";
import { TradeNotificationsService } from "./trades.notifications.service";
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
      tradeFavorites: {
        eager: true,
        select: false,
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
        select: true,
      },
      "tradeInfo.cw721Assets": {
        eager: true,
        alias: "tradeInfo_cw721Assets_join",
        select: true,
      },
      "tradeInfo.cw721Assets.collection": {
        eager: true,
        alias: "tradeInfo_cw721Assets_collection_join",
        select: true,
      },
      "tradeInfo.cw721Assets.metadata": {
        eager: true,
        alias: "tradeInfo_cw721Assets_metadata_join",
        select: true,
      },
      "tradeInfo.cw721Assets.metadata.attributes": {
        eager: true,
        alias: "tradeInfo_cw721Assets_metadata_attributes_join",
        select: true,
      },
      "tradeInfo.cw20Assets": {
        eager: true,
        select: true,
      },
      "tradeInfo.coinAssets": {
        eager: true,
        select: true,
      },
      trade: {
        eager: true,
        select: true,
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
  constructor(
    private readonly tradesService: TradeNotificationsService,
    public service: TradeNotificationCrudService,
  ) {}

  @Patch("/read")
  async getSingleTrade(@Query() params: NotificationsRead) {
    return await this.tradesService.readNotifications(params.network, params.user);
  }
}

@ApiTags("Trades")
@Crud({
  model: {
    type: TradeFavorite,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      trades: {
        eager: true,
      },
    },
  },
  routes: {
    getOneBase: {},
    deleteOneBase: {},
    getManyBase: {},
    only: ["getManyBase", "getOneBase", "deleteOneBase"],
  },
})
@Controller("trade-favorites")
export class TradeFavoriteController {
  constructor(
    private readonly tradeFavoritesService: TradeFavoritesService,
    public service: TradeFavoriteCrudService,
  ) {}

  @Patch("/add")
  async addFavoriteTrade(@Query() params: TradeFavoriteMessage) {
    return await this.tradeFavoritesService.addFavoriteTrade(
      params.network,
      params.user,
      params.tradeId,
    );
  }

  @Patch("/set")
  async setFavoriteTrade(@Query() params: TradeFavoriteMessage) {
    return await this.tradeFavoritesService.setFavoriteTrade(
      params.network,
      params.user,
      params.tradeId,
    );
  }

  @Patch("/remove")
  async removeFavoriteTrade(@Query() params: TradeFavoriteMessage) {
    return await this.tradeFavoritesService.removeFavoriteTrade(
      params.network,
      params.user,
      params.tradeId,
    );
  }
}
