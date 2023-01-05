import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LoansService } from "../loans.service";
import { LoanResponse, OfferResponse } from "../dto/getLoans.dto";
import { Loan } from "../entities/loan.entity";
import { Offer } from "../entities/offer.entity";
const pMap = require("p-map");

@Injectable()
export class LoanResultInterceptor implements NestInterceptor {
  constructor(
    private readonly tradesService: LoansService,
    @InjectRepository(Loan) private loansRepository: Repository<Loan>,
  ) {}

  async getLoanInfo(context: ExecutionContext, data: Loan[]): Promise<LoanResponse[]> {
    return pMap(
      data,
      async (loan: Loan): Promise<LoanResponse> =>
        this.tradesService.parseLoanDBToResponse(loan.network, loan),
    );
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    // We update the terms for loans that have been accepted
    await this.loansRepository.query(`
        UPDATE loan
        LEFT JOIN offer ON offer.loan_id = loan.id 
        SET loan.terms_duration_in_blocks = offer.terms_duration_in_blocks,
           loan.terms_principle_denom = offer.terms_principle_denom,
           loan.terms_principle_amount = offer.terms_principle_amount,
           loan.terms_interest = offer.terms_interest
        WHERE offer.state = "accepted" AND loan.terms_interest IS NULL
    `);

    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          // First we get all the trade Info needed (what arrives is only an object with an id)
          const parsedTrades = await this.getLoanInfo(context, data);

          // Then we return the whole data
          return {
            data: parsedTrades,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return this.getLoanInfo(context, res);
        } else {
          return await this.getLoanInfo(context, [res]);
        }
      }),
    );
  }
}

@Injectable()
export class OfferResultInterceptor implements NestInterceptor {
  constructor(
    private readonly loansService: LoansService,
    @InjectRepository(Offer) private counterTradesRepository: Repository<Offer>,
  ) {}

  async getOfferInfo(data: Offer[]): Promise<OfferResponse[]> {
    return pMap(
      data,
      async (offer: Offer): Promise<OfferResponse> =>
        this.loansService.parseOfferDBToResponse(offer.network, offer),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          const parsedOffers = await this.getOfferInfo(data);
          return {
            data: parsedOffers,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return this.getOfferInfo(res);
        } else {
          return this.getOfferInfo([res]);
        }
      }),
    );
  }
}
