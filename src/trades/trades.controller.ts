import { Controller, Get, Post, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  MultipleNotificationsResponse,
  MultipleTradeResponse,
  QueryParameters,
  SingleCounterTradeParameters,
  SingleTradeParameters,
  Trade,
} from "./dto/getTrades.dto";
import { NotificationsQuery, NotificationsRead } from "./dto/notifications.dto";
import { NotificationsService } from "./notifications/notifications.service";
import { TradesService } from "./trades.service";

@ApiTags("Trades")
@Controller("trades")
export class TradesController {
  constructor(
    private readonly tradesService: TradesService,
    private readonly notificationService: NotificationsService,
  ) {}

  @Get("")
  @ApiResponse({
    status: 200,
    type: () => Trade,
    description: "Queries the information about a posted trade",
  })
  async getSingleTrade(@Query() params: SingleTradeParameters) {
    return this.tradesService.getSingleTrade(params.network, params.tradeId);
  }

  @Get("all")
  @ApiResponse({
    status: 200,
    type: () => MultipleTradeResponse,
    description: "Queries multiple trade information at once",
  })
  async getTrades(@Query() params: QueryParameters) {
    return this.tradesService.getMultipleTrades(params);
  }

  @Get("counter_trades")
  @ApiResponse({
    status: 200,
    type: () => Trade,
    description: "Queries the information about a posted counter trade",
  })
  async getSingleCounterTrade(@Query() params: SingleCounterTradeParameters) {
    return this.tradesService.getSingleCounterTrade(
      params.network,
      params.tradeId,
      params.counterId,
    );
  }

  @Get("counter_trades/all")
  @ApiResponse({
    status: 200,
    type: () => MultipleTradeResponse,
    description: "Queries multiple counter trade information at once",
  })
  async getCounterTrades(@Query() params: QueryParameters) {
    return this.tradesService.getMultipleCounterTrades(params);
  }

  @ApiResponse({
    status: 200,
    type: () => MultipleNotificationsResponse,
    description: "Queries user's notifications",
  })
  @Get("notifications")
  async queryNotifications(@Query() params: NotificationsQuery) {
    return this.notificationService.queryNotifications(
      params.network,
      params.user,
      params.limit,
      params.offset,
    );
  }

  @ApiResponse({
    status: 200,
    description: "Marks the user's notifications as read",
  })
  @Post("notifications/read")
  async readNotifications(@Query() params: NotificationsRead) {
    return this.notificationService.readNotifications(
      params.network,
      params.user,
      params.notificationId,
    );
  }
}
