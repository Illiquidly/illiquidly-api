import { TxLog } from "@terra-money/terra.js";
import axios from "axios";
import { NFTContentResponse } from "./dto/get-nft-content.dto";

import { fcds } from "../utils/blockchain/chains";
import { asyncAction } from "../utils/js/asyncAction.js";
import { fromIPFSImageURLtoImageURL } from "../utils/blockchain/ipfs";
import { Network } from "../utils/blockchain/dto/network.dto";
import { Injectable } from "@nestjs/common";
import { UtilsService } from "../utils-api/utils.service";
import { BlockchainNFTQuery } from "../utils/blockchain/nft_query";
import { QueryLimitService } from "../utils/queryLimit.service";
import { UpdateState, WalletContent } from "./entities/nft-content.entity";
import { TokenResponse } from "../utils-api/dto/nft.dto";
import { getNftsFromTxList } from "../utils/blockchain/fcdNftQuery";
import { CW721Token } from "src/utils-api/entities/nft-info.entity";

const cloudscraper = require("cloudscraper");
const camelCaseObjectDeep = require("camelcase-object-deep");
const _ = require("lodash");
const pMap = require("p-map");

@Injectable()
export class NftContentQuerierService {
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
    const [err, tokenInfos]: [any, CW721Token[]] = await asyncAction(
      pMap(tokenBatch, async (id: string) => {
        const [inner_err, tokenInfo] = await asyncAction(
          this.utilsService.nftTokenInfoFromDB(network, nft, id),
        );
        return tokenInfo;
      }),
    );
    return tokenInfos;
  }

  async parseTokensFromOneNft(network: Network, address: string, nft: string): Promise<CW721Token[]> {
    let tokens: CW721Token[];
    let startAfter: string | undefined;
    let lastTokens: CW721Token[];
    let allTokens: CW721Token[] = [];
    do {
      lastTokens = tokens;
      tokens = await this.getOneTokenBatchFromNFT(network, address, nft, startAfter);
      console.log("tokens queried 1", tokens)

      tokens = _.compact(tokens);
      // If some tokens have been queried, we prepare the next token iteration
      console.log("tokens queried", tokens)
      if (tokens && tokens.length > 0) {
        startAfter = tokens[tokens.length - 1].tokenId;
        allTokens = allTokens.concat(tokens);
      }
      // We query the blockchain up until : 
      // 1. We have the same result twice  
      // OR
      // 2. The query returns no result
    } while (!_.isEqual(lastTokens, tokens) && tokens.length > 0);
   return allTokens
  }

  // We update the tokens associated with all the new nfts that were encountered in the last transactions 
  async parseNFTSet(data: WalletContent, network: Network, nfts: string[], address: string): Promise<void> {
    await pMap(nfts, async (collectionAddress: string) => {
      // We first remove all tokens associated with the collection
      data.ownedTokens = data?.ownedTokens?.filter(
        token => {
          return token.collection.collectionAddress != collectionAddress
        },
      ) ?? [];

      // We then add all the tokens associated from the address
      let newNfts = await this.parseTokensFromOneNft(network, address, collectionAddress);
      data.ownedTokens = data.ownedTokens.concat(_.compact(newNfts))
    });
  }

  async mapWalletContentDBForResponse(
    network: Network,
    walletContent: WalletContent,
  ): Promise<NFTContentResponse> {

    const ownedTokens: TokenResponse[] = await pMap(walletContent?.ownedTokens ?? [], async token => {
      const tokenNftInfo = camelCaseObjectDeep(token.metadata);
      return {
        tokenId: token.tokenId,
        collectionAddress: token.collection.collectionAddress,
        collectionName: token.collection.collectionName,
        symbol:  token.collection.symbol,
        allNFTInfo: token?.allNFTInfo,
        imageUrl: fromIPFSImageURLtoImageURL(tokenNftInfo?.image),
        description: tokenNftInfo?.description,
        name: tokenNftInfo?.name,
        attributes: tokenNftInfo?.attributes,
        traits: (tokenNftInfo?.attributes ?? []).map(
          ({ traitType, value }: { traitType: string; value: string }) => [traitType, value],
        ),
      };
    });
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
