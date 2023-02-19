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

  async getApprovalResultFor(
    network: Network,
    approvals: {
      address: string;
      data: string;
      network: Network;
      tokenId: string;
    }[],
  ) {
    const arraySize = approvals.length;
    const maxSize = 30;
    var arrayOfOwnerships = [];
    for (var i = 0; i < arraySize; i += maxSize) {
      arrayOfOwnerships.push(approvals.slice(i, i + maxSize));
    }

    const networkOwnershipResult = (
      await pMap(arrayOfOwnerships, async ownerShip =>
        this.queryLimitService
          .sendIndependentQuery(network, contracts[network].multicall, {
            try_aggregate: {
              require_success: false,
              include_cause: false,
              queries: ownerShip,
            },
          })
          .then(response => {
            return response.return_data.map(e => {
              return e.length == 0 || e.data.length == 0
                ? null
                : JSON.parse(Buffer.from(e.data, "base64").toString());
            });
          }),
      )
    ).flat();
    // We return the initial object with an additional field
    return approvals.map((nft, i) => ({
      ...nft,
      hasApproval: networkOwnershipResult[i] != null,
    }));
  }

  async getOwnershipResultFor(
    network: Network,
    ownerShip: {
      address: string;
      data: string;
      network: Network;
      tokenId: string;
    }[],
  ) {
    const arraySize = ownerShip.length;
    const maxSize = 30;
    var arrayOfOwnerships = [];
    for (var i = 0; i < arraySize; i += maxSize) {
      arrayOfOwnerships.push(ownerShip.slice(i, i + maxSize));
    }

    const networkOwnershipResult = (
      await pMap(arrayOfOwnerships, async ownerShip =>
        this.queryLimitService
          .sendIndependentQuery(network, contracts[network].multicall, {
            try_aggregate: {
              require_success: false,
              include_cause: false,
              queries: ownerShip,
            },
          })
          .then(response => {
            return response.return_data.map(e => {
              return e.length == 0 || e.data.length == 0
                ? null
                : JSON.parse(Buffer.from(e.data, "base64").toString());
            });
          }),
      )
    ).flat();
    // We return the initial object with an additional field
    return ownerShip.map((nft, i) => ({
      ...nft,
      owner: networkOwnershipResult[i]?.owner,
    }));
  }

  async updateStateWithOwnership(network: Network, data: Loan[]) {
    // 1. We need to parse the DB object to a response for the frontend
    const approvals = data
      .map(loan => {
        return loan.cw721Assets.map(nft => {
          // We turn the object into a query :
          const approvalMsg = {
            approval: {
              token_id: nft.tokenId,
              spender: contracts[loan.network].loan,
              include_expired: false,
            },
          };
          return {
            address: nft.collection.collectionAddress,
            tokenId: nft.tokenId,
            data: Buffer.from(JSON.stringify(approvalMsg)).toString("base64"),
            network: loan.network,
          };
        });
      })
      .flat();

    const ownerships = data
      .map(loan => {
        return loan.cw721Assets.map(nft => {
          // We turn the object into a query :
          const ownershipMessage = {
            owner_of: {
              token_id: nft.tokenId,
            },
          };
          return {
            address: nft.collection.collectionAddress,
            tokenId: nft.tokenId,
            data: Buffer.from(JSON.stringify(ownershipMessage)).toString("base64"),
            network: loan.network,
          };
        });
      })
      .flat();

    // We do 2 queries, 1 for mainnet, one for testnet
    const chainApprovals = await this.getApprovalResultFor(network, approvals);
    const chainOwnerships = await this.getOwnershipResultFor(network, ownerships);

    // For published loans with no approval, we pass the status to inactive
    return data.map(loan => {
      const hasAllApprovals = loan.cw721Assets
        .map(nft => {
          //We check the nft status
          return (
            chainApprovals.find(
              ownership =>
                ownership.address == nft.collection.collectionAddress &&
                ownership.network == loan.network &&
                ownership.tokenId == nft.tokenId,
            )?.hasApproval &&
            chainOwnerships.find(
              ownership =>
                ownership.address == nft.collection.collectionAddress &&
                ownership.network == loan.network &&
                ownership.tokenId == nft.tokenId,
            )?.owner == loan.borrower
          );
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
  //@Cron(CronExpression.EVERY_10_SECONDS)
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
