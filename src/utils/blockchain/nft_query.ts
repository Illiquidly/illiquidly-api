import { registeredNftContracts } from "./chains.js";
import _ from "lodash";
import { Network } from "./dto/network.dto.js";
import { localNftList } from "./nft_list.js";
import axios from "axios";
import { sendIndependentQuery } from "./sendIndependentQuery.js";

export class BlockchainNFTQuery {
  sendQueryFunction: typeof sendIndependentQuery;
  constructor(sendQueryFunction: typeof sendIndependentQuery = sendIndependentQuery) {
    this.sendQueryFunction = sendQueryFunction;
  }

  async getContractInfo(network: string, nftContractAddress: string): Promise<any> {
    const nftInfo = await sendIndependentQuery(network, nftContractAddress, {
      contract_info: {},
    });

    return nftInfo;
  }

  async getAllNFTInfo(network: string, nftContractAddress: string, tokenId: string): Promise<any> {
    const nftInfo = await sendIndependentQuery(network, nftContractAddress, {
      all_nft_info: {
        token_id: tokenId,
      },
    });

    return nftInfo;
  }

  async getNumTokens(network: string, nftContractAddress: string): Promise<any> {
    const nftInfo = await sendIndependentQuery(network, nftContractAddress, {
      num_tokens: {},
    });

    return nftInfo;
  }

  async getUserTokens(
    network: string,
    contractAddress: string,
    userAddress: string,
    limit = 100,
    startAfter?: string,
  ): Promise<string[]> {
    const { tokens } = await sendIndependentQuery(network, contractAddress, {
      tokens: {
        owner: userAddress,
        ...(limit ? { limit } : {}),
        ...(startAfter ? { start_after: startAfter } : {}),
      },
    });
    return tokens;
  }

  async getTokens(
    network: string,
    contractAddress: string,
    limit?: number,
    startAfter?: string,
  ): Promise<string[]> {
    const { tokens } = await sendIndependentQuery(network, contractAddress, {
      all_tokens: {
        ...(limit ? { limit } : {}),
        ...(startAfter ? { start_after: startAfter } : {}),
      },
    });
    return tokens;
  }

  async getAllTokens(network: string, address: string, limit = 100) {
    let startAfter: string | undefined;
    const response: string[][] = [];

    const fetchUserTokensPart = async () => {
      const result: string[] = await this.getTokens(network, address, limit, startAfter);

      response.push(result);

      startAfter = _.last(result);

      if (startAfter) {
        await fetchUserTokensPart();
      }
    };

    await fetchUserTokensPart();

    return response.flat();
  }

  // This is an offchain query, but let's limit it nonetheless
  async getRegisteredNFTs(network: Network): Promise<any> {
    let knownNfts: any = {};

    if (localNftList[network]) {
      knownNfts = localNftList[network];
    }

    const remoteNftList = await axios.get(registeredNftContracts);

    if (remoteNftList?.data[network]) {
      knownNfts = {
        ...knownNfts,
        ...remoteNftList?.data[network],
      };
    }

    return knownNfts;
  }
}
