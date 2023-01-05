import "dotenv/config";
import { contracts } from "./chains";
import { Network } from "./dto/network.dto";
import { sendIndependentQuery } from "./sendIndependentQuery";
import { BlockChainLoanResponse, BlockChainOfferResponse } from "./dto/loan-info.dto";
const camelCaseObjectDeep = require("camelcase-object-deep");

export class BlockchainLoanQuery {
  sendQueryFunction: typeof sendIndependentQuery;
  constructor(sendQueryFunction: typeof sendIndependentQuery = sendIndependentQuery) {
    this.sendQueryFunction = sendQueryFunction;
  }

  async getCollateralInfo(
    network: Network,
    borrower: string,
    loanId: number,
  ): Promise<BlockChainLoanResponse> {
    return camelCaseObjectDeep(
      await sendIndependentQuery(network, contracts[network].loan, {
        collateral_info: {
          borrower,
          loan_id: loanId,
        },
      }),
    );
  }

  async getOfferInfo(network: Network, offerId: string): Promise<BlockChainOfferResponse> {
    return camelCaseObjectDeep(
      await sendIndependentQuery(network, contracts[network].loan, {
        offer_info: {
          global_offer_id: offerId,
        },
      }),
    );
  }
}
