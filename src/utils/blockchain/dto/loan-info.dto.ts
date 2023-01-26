import { Asset } from "./trade-info.dto";

export class Coin {
  denom: string;
  amount: string;
}

export class Term {
  principle: Coin;
  interest: string;
  durationInBlocks: number;
}

export enum LoanState {
  Published = "published",
  Started = "started",
  PendingDefault = "pending_default",
  Defaulted = "defaulted",
  Ended = "ended",
  Inactive = "inactive",
}

export enum OfferState {
  Published = "published",
  Accepted = "accepted",
  Refused = "refused",
  Cancelled = "cancelled",
}

export class BlockChainCollateralInfo {
  terms?: Term;
  associatedAssets: Asset[];
  listDate: number;
  state: LoanState;
  offerAmount: number;
  activeOffer?: string;
  startBlock?: number;
  comment?: string;
  loanPreview?: any;
}

export class BlockChainLoanResponse {
  borrower: string;
  loanId: number;
  collateral: BlockChainCollateralInfo;
}

export class BlockChainOfferInfo {
  lender: string;
  borrower: string;
  loanId: number;
  offerId: number;
  terms: Term;
  state: OfferState;
  listDate: number;
  depositedFunds?: Coin;
  comment?: string;
}

export class BlockChainOfferResponse {
  globalOfferId: string;
  offerInfo: BlockChainOfferInfo;
}
