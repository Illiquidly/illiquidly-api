import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { contracts } from "../utils/blockchain/chains";
import { LoanState } from "../utils/blockchain/dto/loan-info.dto";
import { Network } from "../utils/blockchain/dto/network.dto";
import { asyncAction } from "../utils/js/asyncAction";
import { QueryLimitService } from "../utils/queryLimit.service";
import { Repository } from "typeorm";
import { Loan } from "./entities/loan.entity";
const pMap = require("p-map");
const _ = require("lodash");

@Injectable()
export class UpdateStateWithApprovals {
  constructor(
    @InjectRepository(Loan) private loansRepository: Repository<Loan>,
    private readonly queryLimitService: QueryLimitService,
  ) {}

  async getOwnershipResultFor(
    network: Network,
    ownerShip: {
      address: string;
      data: string;
      network: Network;
      tokenId: string;
    }[],
  ) {
    if (ownerShip.length == 0) {
      return [];
    }
    const networkOwnership = ownerShip.filter(v => v.network == network);
    const networkOwnershipResult = await this.queryLimitService
      .sendIndependentQuery(network, contracts[network].multicall, {
        try_aggregate: {
          require_success: false,
          include_cause: false,
          queries: networkOwnership,
        },
      })
      .then(response => {
        return response.return_data.map(e => {
          return e.length == 0 || e.data.length == 0
            ? null
            : JSON.parse(Buffer.from(e.data, "base64").toString());
        });
      });

    // We return the initial object with an additional field
    return ownerShip.map((nft, i) => ({
      ...nft,
      hasApproval: networkOwnershipResult[i] != null,
    }));
  }

  async updateStateWithOwnership(network: Network, data: Loan[]) {
    // 1. We need to parse the DB object to a response for the frontend
    const ownerShip = data
      .map(loan => {
        return loan.cw721Assets.map(nft => {
          // We turn the object into a query :
          const msg = {
            approval: {
              token_id: nft.tokenId,
              spender: contracts[loan.network].loan,
              include_expired: false,
            },
          };
          return {
            address: nft.collection.collectionAddress,
            tokenId: nft.tokenId,
            data: Buffer.from(JSON.stringify(msg)).toString("base64"),
            network: loan.network,
          };
        });
      })
      .flat();

    // We do 2 queries, 1 for mainnet, one for testnet
    const chainOwnership = await this.getOwnershipResultFor(network, ownerShip);

    // For published loans with no approval, we pass the status to inactive
    return data.map(loan => {
      const hasAllApprovals = loan.cw721Assets
        .map(nft => {
          //We check the nft status
          return chainOwnership.find(
            ownership =>
              ownership.address == nft.collection.collectionAddress &&
              ownership.network == loan.network &&
              ownership.tokenId == nft.tokenId,
          )?.hasApproval;
        })
        .every(v => v);
      if (!hasAllApprovals) {
        return {
          id: loan.id,
          state: LoanState.Inactive,
        };
      } else {
        return undefined;
      }
    });
  }

  isValidNetwork(network: Network) {
    return contracts[network].multicall;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateOwnershipStatus() {
    const [err] = await asyncAction(
      pMap(Object.values(Network), async (network: Network) => {
        if (!this.isValidNetwork(network)) {
          return;
        }
        // First we get all loan objects and their NFTs that are still in the published state
        const loans = await this.loansRepository.find({
          where: {
            network,
            state: LoanState.Published,
          },
          relations: {
            cw721Assets: {
              collection: true,
            },
          },
        });
        await this.updateOwnershipStatusFor(network, loans);
      }),
    );
  }

  async updateOwnershipStatusFor(network: Network, loans: Loan[]) {
    // We query the ones that need correction
    const toCorrect = await this.updateStateWithOwnership(network, loans);
    // Finally we correct the ones that need correction
    return this.loansRepository.save(_.compact(toCorrect));
  }
}
