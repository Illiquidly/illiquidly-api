import { NFTContentResponse } from "./dto/get-nft-content.dto";

import { asyncAction } from "../utils/js/asyncAction.js";
import { fromIPFSImageURLtoImageURL } from "../utils/blockchain/ipfs";
import { Network } from "../utils/blockchain/dto/network.dto";
import { Injectable, Logger } from "@nestjs/common";
import { UtilsService } from "../utils-api/utils.service";
import { BlockchainNFTQuery } from "../utils/blockchain/nft_query";
import { QueryLimitService } from "../utils/queryLimit.service";
import { UpdateState, WalletContent } from "./entities/nft-content.entity";
import { TokenResponse } from "../utils-api/dto/nft.dto";
import { CW721Token } from "src/utils-api/entities/nft-info.entity";

const camelCaseObjectDeep = require("camelcase-object-deep");
const _ = require("lodash");
const pMap = require("p-map");

@Injectable()
export class NftContentQuerierService {
  readonly logger = new Logger(NftContentQuerierService.name);
  nftQuery: BlockchainNFTQuery;
  constructor(
    private readonly utilsService: UtilsService,
    private readonly queryLimitService: QueryLimitService,
  ) {
    this.nftQuery = new BlockchainNFTQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );
  }

  async getOneTokenBatchFromNFT(
    network: Network,
    address: string,
    nft: string,
    startAfter: string | undefined = undefined,
  ) {
    // We get the token batch
    const [, tokenBatch] = await asyncAction(
      this.nftQuery.getUserTokens(network, nft, address, 100, startAfter),
    );

    /// If we received no token, or an error, we return
    if (!tokenBatch) {
      return [];
    }

    // For all token we just encountered, we load their info from the database
    // Or from the blockchain if it doesn't exist
    const [, tokenInfos]: [any, CW721Token[]] = await asyncAction(
      pMap(tokenBatch, async (id: string) => {
        const [innerErr, tokenInfo] = await asyncAction(
          this.utilsService.nftTokenInfoFromDB(network, nft, id),
        );
        if (innerErr) {
          this.logger.log("Error Fetching NFT Info From DB", innerErr);
        }
        return tokenInfo;
      }),
    );
    return tokenInfos;
  }

  async parseTokensFromOneNft(
    network: Network,
    address: string,
    nft: string,
  ): Promise<CW721Token[]> {
    let tokens: CW721Token[];
    let startAfter: string | undefined;
    let lastTokens: CW721Token[];
    let allTokens: CW721Token[] = [];
    do {
      lastTokens = tokens;
      tokens = await this.getOneTokenBatchFromNFT(network, address, nft, startAfter);

      tokens = _.compact(tokens);
      // If some tokens have been queried, we prepare the next token iteration
      if (tokens && tokens.length > 0) {
        startAfter = tokens[tokens.length - 1].tokenId;
        allTokens = allTokens.concat(tokens);
      }
      // We query the blockchain up until :
      // 1. We have the same result twice
      // OR
      // 2. The query returns no result
    } while (!_.isEqual(lastTokens, tokens) && tokens.length > 0);
    return allTokens;
  }

  // We update the tokens associated with all the new nfts that were encountered in the last transactions
  async parseNFTSet(
    data: WalletContent,
    network: Network,
    nfts: string[],
    address: string,
  ): Promise<void> {
    await pMap(
      nfts,
      async (collectionAddress: string) => {
        // We first remove all tokens associated with the collection
        data.ownedTokens =
          data?.ownedTokens?.filter(token => {
            return token.collection?.collectionAddress != collectionAddress;
          }) ?? [];

        // We then add all the tokens associated from the address
        const newNfts = await this.parseTokensFromOneNft(network, address, collectionAddress);

        data.ownedTokens = data.ownedTokens.concat(_.compact(newNfts));
        data.ownedTokens = _.uniqBy(data.ownedTokens, token => `${token.id}-${token.collectionId}`);
      },
      { concurrency: 1 },
    );
  }

  async mapWalletContentDBForResponse(
    network: Network,
    walletContent: WalletContent,
  ): Promise<NFTContentResponse> {
    const ownedTokens: TokenResponse[] = await pMap(
      walletContent?.ownedTokens ?? [],
      async (token: CW721Token) => {
        token = await this.utilsService.updateMetadataForChangingNFTs(network, token);
        return this.utilsService.parseTokenDBToResponse(token);
      },
    );
    const ownedCollections = _.uniqBy(
      ownedTokens.map(token => ({
        collectionName: token.collectionName,
        collectionAddress: token.collectionAddress,
      })),
      "collectionAddress",
    );

    return {
      ownedCollections,
      ownedTokens,
      state: walletContent?.state ?? UpdateState.Partial,
    };
  }
}
