import { Injectable, NotFoundException } from "@nestjs/common";
import { Network } from "../utils/blockchain/dto/network.dto";
import { validateRequest } from "../utils/js/validateRequests";

import { asyncAction } from "../utils/js/asyncAction";
import { getJSONFromDb, saveJSONToDb } from "../utils/redis_db_accessor";

import { BlockchainNFTQuery } from "../utils/blockchain/nft_query.js";

import { RedisService } from "nestjs-redis";
import Redis from "ioredis";
import { NFTInfoService } from "../database/nft_info/access";
import { NftContractInfo } from "../database/nft_info/dto/nftInfo.dto";
import { QueryLimitService } from "../utils/queryLimit.service";
import { BlockchainTradeQuery } from "../utils/blockchain/p2pTradeQuery";

export function toAllNFTInfoKey(network: string) {
  return `all_nft_info:${network}`;
}

export function toExistingTokenKey(network: string) {
  return `existing_tokens:${network}`;
}

@Injectable()
export class UtilsService {
  redisDB: Redis;
  nftQuery: BlockchainNFTQuery;

  constructor(
    private readonly redisService: RedisService,
    private readonly nftInfoService: NFTInfoService,
    private readonly queryLimitService: QueryLimitService,
  ) {
    this.redisDB = redisService.getClient();
    this.nftQuery = new BlockchainNFTQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );
  }

  async registeredNFTs(network: Network) {
    const [err, knownNfts] = await asyncAction(this.nftQuery.getRegisteredNFTs(network));

    if (!err) {
      // We save those nft information to the NFT db if there was no error
      await this.nftInfoService.addNftInfo(
        Object.entries(knownNfts).map(([key, value]: [string, any]) => ({
          network,
          collectionAddress: key,
          collectionName: value.name,
          symbol: value.symbol,
        })),
      );
    }
    return knownNfts;
  }

  async registeredNFTAddresses(network: Network) {
    return Object.keys(await this.registeredNFTs(network));
  }

  async getCachedNFTContractInfo(network: Network, nft: string): Promise<NftContractInfo> {
    const [err, cachedInfo] = await asyncAction(this.nftInfoService.getNftInfo(network, nft));

    if (!err && cachedInfo?.[0]) {
      return cachedInfo[0];
    }

    // If there is no cached info, we get the distant info
    const [lcdErr, newInfo] = await asyncAction(this.nftQuery.getContractInfo(network, nft));
    if (lcdErr) {
      throw new NotFoundException("Collection not found");
    }

    const newInfoToSave = {
      network,
      collectionAddress: nft,
      collectionName: newInfo.name,
      symbol: newInfo.symbol,
    };
    await this.nftInfoService.addNftInfo([newInfoToSave]);

    return newInfoToSave;
  }

  async nftInfo(network: Network, address: string, tokenId: string) {
    validateRequest(network);

    const allNFTInfoKey = toAllNFTInfoKey(network);

    const [, allNFTInfo] = await asyncAction(getJSONFromDb(this.redisDB, allNFTInfoKey));

    // If the nftInfo was saved in the db, we return it directly
    if (allNFTInfo?.[address]?.[tokenId]) {
      return allNFTInfo[address][tokenId];
    }

    // Else we query it from the lcd
    const [error, nftInfo] = await asyncAction(
      this.nftQuery.getAllNFTInfo(network, address, tokenId),
    );
    if (error) {
      throw new NotFoundException("Token not found");
    }

    this._internalUpdateNftInfo(allNFTInfo, network, address, tokenId, nftInfo);
    // We return

    return nftInfo.info;
  }

  async allNFTInfo(network: Network, address?: string) {
    validateRequest(network);

    const allNFTInfoKey = toAllNFTInfoKey(network);

    const dbContent = await getJSONFromDb(this.redisDB, allNFTInfoKey);
    let returnObject: any;
    if (address) {
      returnObject = dbContent?.[address] ?? {};
    } else {
      returnObject = dbContent ?? {};
    }

    // We add the contract Info from that NFT
    const [, nftContractInfo] = await asyncAction(this.getCachedNFTContractInfo(network, address));
    returnObject = {
      ...returnObject,
      nftContractInfo,
    };

    return returnObject;
  }

  async _internalUpdateNftInfo(
    allNFTInfo: any,
    network: string,
    address: string,
    tokenId: string,
    nftInfo: any,
  ) {
    // We save all the token info from a contract in a single array
    const allNFTInfoKey = toAllNFTInfoKey(network);
    const existingNFTKey = toExistingTokenKey(network);
    if (!allNFTInfo) {
      allNFTInfo = {};
    }
    if (!allNFTInfo[address]) {
      allNFTInfo[address] = {};
    }
    allNFTInfo[address][tokenId] = nftInfo.info;
    await saveJSONToDb(this.redisDB, allNFTInfoKey, allNFTInfo);
    // We save all tokens names from a contract in a single array
    let [, allTokens] = await asyncAction(getJSONFromDb(this.redisDB, existingNFTKey));
    if (!allTokens) {
      allTokens = {};
    }
    if (!allTokens[address]) {
      allTokens[address] = [];
    }
    allTokens[address].push(tokenId);
    await saveJSONToDb(this.redisDB, existingNFTKey, allTokens);
  }
}
