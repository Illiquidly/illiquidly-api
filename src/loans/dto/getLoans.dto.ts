import { Transform } from "class-transformer";

import { IsInt, IsString } from "class-validator";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { AssetResponse, RawCoin } from "../../utils-api/dto/nft.dto";
import { LoanState, OfferState } from "../../utils/blockchain/dto/loan-info.dto";
import { IsAddress } from "../../utils/nest/addressValidator";
import { Offer } from "../entities/offer.entity";
import { Coin, Loan } from "../entities/loan.entity";

export class SingleLoanParameters {
  network: Network;

  @IsAddress()
  borrower: string;

  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  loanId: number;
}

export class SingleOfferParameters {
  network: Network;

  @IsString()
  globalOfferId: string;
}

export class TermsResponse {
  principle: RawCoin;
  interest: string;
  totalAmountToRepay: string;
  interestRate: string;
  durationInBlocks: number;
}

export class LoanInfoResponse {
  terms?: TermsResponse;
  associatedAssets: AssetResponse[];
  listDate: string;
  state: LoanState;
  offerAmount: number;
  activeOffer?: OfferResponse;
  startBlock?: number;
  comment?: string;
  loanPreview: AssetResponse;
}

export class LoanResponse {
  id: number;
  network: Network;
  borrower: string;
  loanId: number;
  offers: OfferResponse[];
  loanInfo: LoanInfoResponse;
}

export class OfferInfoResponse {
  lender: string;
  terms: TermsResponse;
  state: OfferState;
  listDate: string;
  depositedFunds?: Coin;
  comment?: string;
}

export class OfferResponse {
  id: number;
  network: Network;
  borrower: string;
  loanId: number;
  globalOfferId: string;
  loan: Loan;
  offerInfo: OfferInfoResponse;
}
