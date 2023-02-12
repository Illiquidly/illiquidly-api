import { Controller, Patch, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Crud } from "@rewiko/crud";
import {
  LoanResponse,
  OfferResponse,
  SingleLoanParameters,
  SingleOfferParameters,
} from "./dto/getLoans.dto";
import { LoanFavoriteMessage } from "./dto/loanFavorite.dto";

import { NotificationsRead } from "./dto/notifications.dto";
import { Loan, LoanFavorite, LoanNotification } from "./entities/loan.entity";
import { Offer } from "./entities/offer.entity";
import { LoanResultInterceptor, OfferResultInterceptor } from "./interceptors/loans.interceptor";
import {
  LoanCrudService,
  LoanFavoriteCrudService,
  LoanNotificationCrudService,
  OfferCrudService,
} from "./loanCrud.service";
import { LoansService } from "./loans.service";

@ApiTags("Loans")
@Crud({
  model: {
    type: Loan,
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
      offers: {
        eager: true,
      },
      loanFavorites: {
        eager: true,
        select: false,
      },
      activeOffer: {
        eager: true,
      },
    },
  },
  routes: {
    getOneBase: {
      decorators: [],
      interceptors: [LoanResultInterceptor],
    },
    getManyBase: {
      decorators: [],
      interceptors: [LoanResultInterceptor],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("loans")
export class LoanController {
  constructor(private readonly loansService: LoansService, public service: LoanCrudService) {}

  @Patch("")
  @ApiResponse({
    status: 200,
    type: () => LoanResponse,
    description: "Queries the information about a posted loan",
  })
  async getSingleRaffle(@Query() params: SingleLoanParameters) {
    return await this.loansService.getLoanById(params.network, params.borrower, params.loanId);
  }
}

@ApiTags("Loans")
@Crud({
  model: {
    type: Offer,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      loan: {
        eager: true,
        select: true,
      },
    },
  },
  routes: {
    getOneBase: {
      decorators: [],
      interceptors: [OfferResultInterceptor],
    },
    getManyBase: {
      decorators: [],
      interceptors: [OfferResultInterceptor],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("loan-offers")
export class OfferController {
  constructor(private readonly tradesService: LoansService, public service: OfferCrudService) {}

  @Patch("")
  @ApiResponse({
    status: 200,
    type: () => OfferResponse,
    description: "Queries the information about a posted counter trade",
  })
  async getSingleCounterTrade(@Query() params: SingleOfferParameters) {
    return await this.tradesService.getOfferById(params.network, params.globalOfferId);
  }
}

@ApiTags("Loans")
@Crud({
  model: {
    type: LoanNotification,
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
@Controller("loan-notifications")
export class LoanNotificationController {
  constructor(
    private readonly loansService: LoansService,
    public service: LoanNotificationCrudService,
  ) {}

  @Patch("/read")
  async readNotification(@Query() params: NotificationsRead) {
    return await this.loansService.readNotifications(params.network, params.user);
  }
}

@ApiTags("Loans")
@Crud({
  model: {
    type: LoanFavorite,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      loans: {
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
@Controller("loan-favorites")
export class LoanFavoriteController {
  constructor(
    private readonly loansService: LoansService,
    public service: LoanFavoriteCrudService,
  ) {}

  @Patch("/add")
  async addFavoriteLoan(@Query() params: LoanFavoriteMessage) {
    return await this.loansService.addFavoriteLoan(
      params.network,
      params.user,
      params.borrower,
      params.loanId,
    );
  }

  @Patch("/remove")
  async removeFavoriteLoan(@Query() params: LoanFavoriteMessage) {
    return await this.loansService.removeFavoriteLoan(
      params.network,
      params.user,
      params.borrower,
      params.loanId,
    );
  }
}
