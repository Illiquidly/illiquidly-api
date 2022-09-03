import { Injectable } from "@nestjs/common";
import { Network } from "../utils/blockchain/dto/network.dto";
import { validateRequest } from "../utils/js/validateRequests";

import { registeredNFTs } from "../utils/blockchain/queryNFTInfo";
import { asyncAction } from "../utils/js/asyncAction";
import { getJSONFromDb, saveJSONToDb } from "../utils/redis_db_accessor";

import { getAllNFTInfo } from "../utils/blockchain/nft_query.js";
import { sendBackError } from "../utils/js/sendBackError";

export function toAllNFTInfoKey(network: string) {
  return `all_nft_info:${network}`;
}

export function toExistingTokenKey(network: string) {
  return `existing_tokens:${network}`;
}

@Injectable()
export class UtilsService {
  async registeredNfts(network: Network) {
    validateRequest(network);

    return await registeredNFTs(network);
  }

  async nftInfo(network: Network, address: string, tokenId: string) {
    validateRequest(network);

    const allNFTInfoKey = toAllNFTInfoKey(network);

    let [_, allNFTInfo] = await asyncAction(getJSONFromDb(allNFTInfoKey));

    // If the nftInfo was saved in the db, we return it directly
    if (allNFTInfo?.[address]?.[tokenId]) {
      return allNFTInfo[address][tokenId];
    }

    // Else we query it from the lcd
    const [error, nftInfo] = await asyncAction(getAllNFTInfo(network, address, tokenId));
    if (error) {
      return await sendBackError(error);
    }

    this._internalUpdateNftInfo(allNFTInfo, network, address, tokenId, nftInfo);
    // We return
    return nftInfo.info;
  }

  async allNFTInfo(network: Network, address?: string) {
    validateRequest(network);

    const allNFTInfoKey = toAllNFTInfoKey(network);

    console.log(allNFTInfoKey);
    let dbContent = await getJSONFromDb(allNFTInfoKey);
    console.log(dbContent);
    let returnObject: any;
    if (address) {
      returnObject = dbContent?.[address] ?? {};
    } else {
      returnObject = dbContent ?? {};
    }

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
    await saveJSONToDb(allNFTInfoKey, allNFTInfo);
    console.log(allNFTInfoKey);
    // We save all tokens names from a contract in a single array
    let [__, allTokens] = await asyncAction(getJSONFromDb(existingNFTKey));
    if (!allTokens) {
      allTokens = {};
    }
    if (!allTokens[address]) {
      allTokens[address] = [];
    }
    allTokens[address].push(tokenId);
    await saveJSONToDb(existingNFTKey, allTokens);
  }
}
