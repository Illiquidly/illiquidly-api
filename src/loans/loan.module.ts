import { Module } from "@nestjs/common";

import { UtilsModule } from "../utils-api/utils.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import {
  LoanController,
  LoanFavoriteController,
  LoanNotificationController,
  OfferController,
} from "./loans.controller";
import { LoansService } from "./loans.service";
import {
  LoanCrudService,
  LoanFavoriteCrudService,
  LoanNotificationCrudService,
  OfferCrudService,
} from "./loanCrud.service";
import { UpdateStateWithApprovals } from "./updateStateWithApprovals";

@Module({
  imports: [UtilsModule, TypeOrmModule.forFeature(Entities)],
  controllers: [
    LoanController,
    OfferController,
    LoanNotificationController,
    LoanFavoriteController,
  ],
  providers: [
    LoansService,

    LoanCrudService,
    OfferCrudService,
    LoanNotificationCrudService,
    LoanFavoriteCrudService,
    UpdateStateWithApprovals,
  ],
  exports: [LoansService],
})
export class LoansModule {}
