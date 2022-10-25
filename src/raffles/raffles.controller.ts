import { Controller, Patch, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Crud } from "@rewiko/crud";
import { SingleRaffleParameters } from "./dto/getRaffles.dto";

import { NotificationsRead } from "./dto/notifications.dto";
import { RaffleFavoriteMessage } from "./dto/raffleFavorite.dto";
import { Raffle, RaffleFavorite, RaffleNotification } from "./entities/raffle.entity";
import { RaffleResultInterceptor } from "./interceptors/raffles.interceptor";

import {
  RaffleCrudService,
  RaffleFavoriteCrudService,
  RaffleNotificationCrudService,
} from "./raffleCrud.service";
import { RafflesService } from "./raffles.service";

@ApiTags("Raffles")
@Crud({
  model: {
    type: Raffle,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      cw721Assets: {
        eager: true,
      },
      "cw721Assets.collection": {
        eager: true,
        alias: "cw721Assets_collection_join",
      },
      "cw721Assets.metadata": {
        eager: true,
        alias: "cw721Asset_metadata_join",
      },
      "cw721Assets.metadata.attributes": {
        eager: true,
        alias: "cw721Assets_metadata_attributes_join",
      },
      cw20TicketPrice: {
        eager: true,
      },
      coinTicketPrice: {
        eager: true,
      },
      participants: {
        eager: true,
      },
      raffleFavorites: {
        eager: true,
        select: false,
      },
    },
  },
  routes: {
    getOneBase: {
      decorators: [],
      interceptors: [RaffleResultInterceptor],
    },
    getManyBase: {
      decorators: [],
      interceptors: [RaffleResultInterceptor],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("raffles")
export class RafflesController {
  constructor(private readonly rafflesService: RafflesService, public service: RaffleCrudService) {}

  @Patch("")
  @ApiResponse({
    status: 200,
    type: () => Raffle,
    description: "Queries the information about a posted raffle",
  })
  async getSingleRaffle(@Query() params: SingleRaffleParameters) {
    return await this.rafflesService.getRaffleById(params.network, params.raffleId);
  }
}

@ApiTags("Raffles")
@Crud({
  model: {
    type: RaffleNotification,
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
@Controller("raffle-notifications")
export class RaffleNotificationController {
  constructor(
    private readonly rafflesService: RafflesService,
    public service: RaffleNotificationCrudService,
  ) {}

  @Patch("/read")
  async readNotification(@Query() params: NotificationsRead) {
    return await this.rafflesService.readNotifications(params.network, params.user);
  }
}

@ApiTags("Raffles")
@Crud({
  model: {
    type: RaffleFavorite,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      raffles: {
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
@Controller("raffle-favorites")
export class RaffleFavoriteController {
  constructor(
    private readonly rafflesService: RafflesService,
    public service: RaffleFavoriteCrudService,
  ) {}

  @Patch("/add")
  async addFavoriteRaffle(@Query() params: RaffleFavoriteMessage) {
    return await this.rafflesService.addFavoriteRaffle(
      params.network,
      params.user,
      params.raffleId,
    );
  }

  @Patch("/set")
  async setFavoriteRaffle(@Query() params: RaffleFavoriteMessage) {
    return await this.rafflesService.setFavoriteRaffle(
      params.network,
      params.user,
      params.raffleId,
    );
  }

  @Patch("/remove")
  async removeFavoriteRaffle(@Query() params: RaffleFavoriteMessage) {
    return await this.rafflesService.removeFavoriteRaffle(
      params.network,
      params.user,
      params.raffleId,
    );
  }
}
