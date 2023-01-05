import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";

import { InjectRepository } from "@nestjs/typeorm";
import { AbstractFilterToSelectCrudService } from "../trades/tradeCrud.service";
import { Loan, LoanFavorite, LoanNotification } from "./entities/loan.entity";
import { Offer } from "./entities/offer.entity";

@Injectable()
export class LoanCrudService extends AbstractFilterToSelectCrudService<Loan> {
  constructor(@InjectRepository(Loan) repo) {
    super(repo);
  }
}

@Injectable()
export class OfferCrudService extends AbstractFilterToSelectCrudService<Offer> {
  constructor(@InjectRepository(Offer) repo) {
    super(repo);
  }
}

@Injectable()
export class LoanNotificationCrudService extends TypeOrmCrudService<LoanNotification> {
  constructor(@InjectRepository(LoanNotification) repo) {
    super(repo);
  }
}

@Injectable()
export class LoanFavoriteCrudService extends TypeOrmCrudService<LoanFavorite> {
  constructor(@InjectRepository(LoanFavorite) repo) {
    super(repo);
  }
}
