import { Injectable, NotFoundException } from "@nestjs/common";
import { asyncAction } from "../utils/js/asyncAction";
import { Network } from "../utils/blockchain/dto/network.dto";
import { UtilsService } from "../utils-api/utils.service";
import { QueryLimitService } from "../utils/queryLimit.service";
import { BlockchainNFTQuery } from "../utils/blockchain/nft_query";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Asset, CW721Coin } from "../utils-api/dto/nft.dto";
import {
  BlockChainCollateralInfo,
  BlockChainLoanResponse,
  BlockChainOfferResponse,
  LoanState,
  Term,
} from "../utils/blockchain/dto/loan-info.dto";
import {
  Loan,
  LoanFavorite,
  LoanNotification,
  NotificationStatus,
  SimpleFavorite,
} from "./entities/loan.entity";
import { BlockchainLoanQuery } from "../utils/blockchain/loanQuery";
import {
  LoanInfoResponse,
  LoanResponse,
  OfferInfoResponse,
  OfferResponse,
  TermsResponse,
} from "./dto/getLoans.dto";
import { Offer } from "./entities/offer.entity";
import { coinToRawCoin } from "../trades/trades.service";
import { formatDecimal } from "../utils/js/parseCoin";
const pMap = require("p-map");
const _ = require("lodash");
import big from "big.js";
import { RedLockService } from "../utils/lock.service";
import { UpdateStateWithApprovals } from "./updateStateWithApprovals";

@Injectable()
export class LoansService {
  loanQuery: BlockchainLoanQuery;
  nftQuery: BlockchainNFTQuery;
  constructor(
    @InjectRepository(Loan) private loansRepository: Repository<Loan>,
    @InjectRepository(Offer) private offerRepository: Repository<Offer>,
    @InjectRepository(LoanNotification)
    private notificationRepository: Repository<LoanNotification>,
    @InjectRepository(LoanFavorite)
    private favoriteRepository: Repository<LoanFavorite>,
    private readonly utilsService: UtilsService,
    private readonly queryLimitService: QueryLimitService,
    private readonly redlockService: RedLockService,
    private readonly updateStateWithApprovals: UpdateStateWithApprovals,
  ) {
    this.loanQuery = new BlockchainLoanQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );

    this.nftQuery = new BlockchainNFTQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );
  }

  private async queryDistantLoanAndParseForDB(
    network: Network,
    borrower: string,
    loanId: number,
  ): Promise<Loan> {
    // We try to query the raffle on_chain directly :
    const [queryErr, distantLoanInfo]: [any, BlockChainCollateralInfo] = await asyncAction(
      this.loanQuery.getCollateralInfo(network, borrower, loanId),
    );
    if (queryErr) {
      throw new NotFoundException("Loan Not Found");
    }
    // We parse the new queried object for the database

    return this.mapDistantLoanToDB(network, {
      borrower,
      loanId,
      collateral: distantLoanInfo,
    });
  }

  private async queryDistantOfferAndParseForDB(
    network: Network,
    globalOfferId: string,
  ): Promise<Offer> {
    // We try to query the counter_trade on_chain directly :
    const [queryErr, distantOfferInfo]: [any, BlockChainOfferResponse] = await asyncAction(
      this.loanQuery.getOfferInfo(network, globalOfferId),
    );
    if (queryErr) {
      throw new NotFoundException("Offer Not Found");
    }
    // We save the new queried trade Info To the database
    return {
      id: null,
      network,
      globalOfferId,
      borrower: distantOfferInfo.offerInfo.borrower,
      loanId: distantOfferInfo.offerInfo.loanId,
      lender: distantOfferInfo.offerInfo.lender,
      loan: null,
      terms: distantOfferInfo.offerInfo.terms,
      state: distantOfferInfo.offerInfo.state,
      listDate: new Date(distantOfferInfo.offerInfo.listDate / 1000000),
      depositedFunds: distantOfferInfo.offerInfo.depositedFunds ?? { amount: null, denom: null },
      comment: distantOfferInfo.offerInfo.comment,
    };
  }

  // When updating a loan directly from the Blockchain, you want to update their loanInfo only
  async updateLoan(network: Network, borrower: string, loanId: number) {
    const [, loanInfo]: [any, Loan] = await asyncAction(
      this.loansRepository.findOne({
        relations: { offers: true },
        where: { borrower, loanId, network },
      }),
    );

    // We query the brand new on-chain info
    const loanDBObject = await this.queryDistantLoanAndParseForDB(network, borrower, loanId);
    // We assign the old id to the new object, to save it in place
    loanDBObject.id = loanInfo?.id;
    loanDBObject.offers = loanInfo?.offers ?? [];

    // We verify the loan is not in the liquidation_pending state
    const block = await this.queryLimitService.getBlockHeight(network);

    // We try to update the loan. If the loan already exists, we don't care
    // This is a workaround, because we don't have functionnal lock

    await this.redlockService.doWithLock(
      `update_offer_${loanDBObject.loanId}-${loanDBObject.borrower}`,
      async () => {
        return asyncAction(this.loansRepository.save(loanDBObject));
      },
    );

    // After it's saved, we add the activeOffer if necessary
    if (loanDBObject.activeOfferOfferId) {
      console.log("should add offer active");
      loanDBObject.activeOffer = await this.updateOffer(network, loanDBObject.activeOfferOfferId);
    }

    // We check for the actual offer state
    if (
      loanDBObject.state == LoanState.Started &&
      loanDBObject.startBlock + loanDBObject?.activeOffer?.terms?.durationInBlocks <
        parseInt(block.block.header.height)
    ) {
      loanDBObject.state = LoanState.PendingDefault;
    }

    await this.redlockService.doWithLock(
      `update_offer_${loanDBObject.loanId}-${loanDBObject.borrower}`,
      async () => {
        return asyncAction(this.loansRepository.save(loanDBObject));
      },
    );

    // We save it again

    return loanDBObject;
  }

  async updateLoanAndOffers(network: Network, borrower: string, loanId: number) {
    // We start by updating the loan
    const loanInfo = await this.updateLoan(network, borrower, loanId);
    // Then we update every offer associated with the loan in the database
    await pMap(loanInfo.offers, async (offer: Offer) =>
      asyncAction(this.updateOffer(network, offer.globalOfferId)),
    );
  }

  async updateOffer(network: Network, globalOfferId: string): Promise<Offer> {
    return await this.redlockService.doWithLock(`update_offer_${globalOfferId}`, async () => {
      const [, offerInfo] = await asyncAction(
        this.offerRepository.findOne({
          relations: { loan: true },
          where: { network, globalOfferId },
        }),
      );

      const offerDBObject: Offer = await this.queryDistantOfferAndParseForDB(
        network,
        globalOfferId,
      );

      // We assign the old id to the new object, to save it in place
      offerDBObject.id = offerInfo?.id;
      offerDBObject.loan = offerInfo?.loan;

      // We try to get the associated trade if it exists in the database
      if (!offerDBObject?.loan) {
        // We query the database to look for the corresponding trade
        const [, loanInfo] = await asyncAction(
          this.loansRepository.findOneBy({
            network,
            borrower: offerDBObject.borrower,
            loanId: offerDBObject.loanId,
          }),
        );
        if (loanInfo) {
          // If it was already registered, we can simply save it
          offerDBObject.loan = loanInfo;
        } else {
          // If it was not in the database, we have to look else-where
          offerDBObject.loan = await this.updateLoan(
            network,
            offerDBObject.borrower,
            offerDBObject.loanId,
          );
        }
      }
      return this.offerRepository.save(offerDBObject);
    });
  }

  async getLoanById(network: Network, borrower: string, loanId: number): Promise<LoanResponse> {
    const loanDBObject = await this.updateLoan(network, borrower, loanId);
    const newStateObject = await this.updateStateWithApprovals.updateOwnershipStatusFor(network, [loanDBObject]);
    if(newStateObject?.[0]){
      loanDBObject.state = newStateObject[0].state;
    }
    console.log(newStateObject)
    return await this.parseLoanDBToResponse(network, loanDBObject);
  }

  async getOfferById(network: Network, globalOfferId: string): Promise<OfferResponse> {
    const offerDBObject = await this.updateOffer(network, globalOfferId);

    // Now we return the database response
    return this.parseOfferDBToResponse(network, offerDBObject);
  }

  async mapDistantLoanToDB(network: Network, loanInfo: BlockChainLoanResponse): Promise<Loan> {
    return {
      id: null,
      network,
      loanId: loanInfo.loanId,
      borrower: loanInfo.borrower,
      state: loanInfo.collateral.state,
      cw721Assets: await pMap(
        loanInfo.collateral.associatedAssets.filter((asset: Asset) => !!asset.cw721Coin),
        async (asset: CW721Coin) => {
          const token = await this.utilsService.nftTokenInfoFromDB(
            network,
            asset.cw721Coin.address,
            asset.cw721Coin.tokenId,
          );
          return token;
        },
      ),
      cw1155Assets: loanInfo.collateral.associatedAssets.filter((asset: Asset) => asset.cw1155Coin),
      terms: loanInfo.collateral.terms,
      startBlock: loanInfo.collateral.startBlock,
      listDate: new Date(loanInfo.collateral.listDate / 1000000),
      offerAmount: loanInfo.collateral.offerAmount,
      offers: undefined,
      loanFavorites: null,
      activeOfferOfferId: loanInfo.collateral.activeOffer,
      comment: loanInfo.collateral.comment,
      loanPreview: JSON.stringify(loanInfo.collateral.loanPreview),
    };
  }

  async parseLoanDBToResponse(network: Network, loan: Loan): Promise<LoanResponse> {
    if (loan.activeOffer) {
      loan.activeOffer.loan = null;
    }

    const loanInfo: LoanInfoResponse = {
      associatedAssets: (
        await pMap(loan.cw721Assets ?? [], async asset => {
          return {
            cw721Coin: await this.utilsService.parseTokenDBToResponse(asset),
          };
        })
      ).concat(loan.cw1155Assets ?? []),
      listDate: loan.listDate.toISOString(),
      state: loan.state,
      offerAmount: loan.offerAmount,
      activeOffer: loan.activeOffer ? this.parseOfferDBToResponse(network, loan.activeOffer) : null,
      startBlock: loan.startBlock,
      comment: loan.comment,
      loanPreview: await this.utilsService.parseTokenPreview(network, loan.loanPreview),
      terms: loan.terms ? termsToTermsResponse(loan.terms) : undefined,
    };

    // We parse the raffleInfo :
    return {
      network,
      loanId: loan.loanId,
      id: loan.id,
      borrower: loan.borrower,
      offers: loan.offers.map(offer => this.parseOfferDBToResponse(network, offer)),
      loanInfo,
    };
  }

  parseOfferDBToResponse(network: Network, offer: Offer): OfferResponse {
    const offerInfo: OfferInfoResponse = {
      lender: offer.lender,
      terms: termsToTermsResponse(offer.terms),
      state: offer.state,
      listDate: offer.listDate.toISOString(),
      depositedFunds: offer.depositedFunds?.denom ? offer.depositedFunds : null,
      comment: offer.comment,
    };

    return {
      id: offer.id,
      network,
      borrower: offer.borrower,
      loanId: offer.loanId,
      globalOfferId: offer.globalOfferId,
      loan: offer.loan,
      offerInfo,
    };
  }

  async readNotifications(network: Network, user: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(LoanNotification)
      .set({ status: NotificationStatus.read })
      .where("network = :network", { network })
      .andWhere("user = :user", { user })
      .execute();
  }

  async addFavoriteLoan(network: Network, user: string, borrower: string, loanId: number) {
    let currentFavorite: LoanFavorite = await this.favoriteRepository.findOne({
      relations: {
        loans: true,
      },
      where: {
        network,
        user,
      },
    });

    if (!currentFavorite) {
      currentFavorite = {
        id: null,
        network,
        user,
        loans: [],
      };
    }
    // We query the raffle informations
    const newLoan = await this.loansRepository.findOneBy({ network, borrower, loanId });

    if (newLoan) {
      currentFavorite.loans.push(newLoan);
    }

    currentFavorite.loans = _.uniqBy(currentFavorite.loans, (loan: Loan) => loan.id);

    // We save to the database
    this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
  }

  async removeFavoriteLoan(network: Network, user: string, borrower: string, loanId: number) {
    const currentFavorite: LoanFavorite = await this.favoriteRepository.findOne({
      relations: {
        loans: true,
      },
      where: {
        network,
        user,
      },
    });

    if (!currentFavorite) {
      return;
    }

    // We update the raffles
    currentFavorite.loans = _.differenceWith(
      currentFavorite.loans,
      [
        {
          borrower,
          loanId,
        },
      ],
      (el1: Loan, el2: SimpleFavorite) => el1.borrower == el2.borrower && el1.loanId == el2.loanId,
    );

    this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
  }
}

function termsToTermsResponse(terms: Term): TermsResponse {
  return {
    principle: coinToRawCoin({
      coin: terms.principle,
    }),
    interest: formatDecimal(terms.interest),
    totalAmountToRepay: big(terms.principle.amount).plus(terms.interest).toString(),
    interestRate: big(terms.interest).mul(100).div(terms.principle.amount).round(2).toString(),
    durationInBlocks: terms.durationInBlocks,
  };
}
