import { LCDClient, TxLog } from "@terra-money/terra.js";
import axios from "axios";
import { TokenInteracted } from "./dto/get-nft-content.dto";

import { chains, fcds } from "../utils/blockchain/chains";
import { asyncAction } from "../utils/js/asyncAction.js";
import { fromIPFSImageURLtoImageURL } from "../utils/blockchain/ipfs";
import { Network } from "../utils/blockchain/dto/network.dto";
import { Injectable } from "@nestjs/common";
import { UtilsService } from "../utils-api/utils.service";
import { getAllNFTInfo } from "../utils/blockchain/nft_query";
const pLimit = require("p-limit");

const cloudscraper = require("cloudscraper");
const camelCaseObjectDeep = require("camelcase-object-deep");
const _ = require("lodash");

const limitNFT = pLimit(10);
const limitToken = pLimit(50);
const AXIOS_TIMEOUT = 10_000;

@Injectable()
export class NftContentQuerierService {
  constructor(private readonly utilsService: UtilsService) {}

  addFromWasmEvents(tx: any, nftsInteracted: any, chainType: string) {
    for (const log of tx?.logs) {
      if (chainType == "classic") {
        const parsedLog = new TxLog(log.msg_index, log.log, log.events);
        const fromContract = parsedLog.eventsByType.from_contract;
        if (fromContract?.action) {
          if (
            fromContract.action.includes("transfer_nft") ||
            fromContract.action.includes("send_nft") ||
            fromContract.action.includes("mint")
          ) {
            fromContract.contract_address.forEach(nftsInteracted.add, nftsInteracted);
          }
        }
      } else {
        const parsedLog = new TxLog(log.msg_index, log.log, log.events);
        const fromContract = parsedLog.eventsByType.wasm;
        if (fromContract?.action) {
          if (
            fromContract.action.includes("transfer_nft") ||
            fromContract.action.includes("send_nft") ||
            fromContract.action.includes("mint")
          ) {
            fromContract._contract_address.forEach(nftsInteracted.add, nftsInteracted);
          }
        }
      }
    }
    return nftsInteracted;
  }

  getNftsFromTxList(txData: any, chainType: string): [Set<string>, number, number] {
    let nftsInteracted: Set<string> = new Set();
    let lastTxIdSeen = 0;
    let newestTxIdSeen = 0;
    // In case we are using cloudscraper to get rid of cloudflare
    for (const tx of txData) {
      // We add NFTS interacted with
      nftsInteracted = this.addFromWasmEvents(tx, nftsInteracted, chainType);

      // We update the block and id info
      if (lastTxIdSeen === 0 || tx.id < lastTxIdSeen) {
        lastTxIdSeen = tx.id;
      }
      if (tx.id > newestTxIdSeen) {
        newestTxIdSeen = tx.id;
      }
    }
    return [nftsInteracted, lastTxIdSeen, newestTxIdSeen];
  }

  async updateInteractedNfts(
    network: Network,
    address: string,
    start: number | null,
    stop: number | null,
    callback: any,
    hasTimedOut: any = { timeout: false },
  ) {
    let queryNext = true;
    const limit = 100;
    let offset: number = start ?? 0;
    let newestTxIdSeen: number | null = null;
    let lastTxIdSeen: number | null = null;
    while (queryNext) {
      if (hasTimedOut.timeout) {
        return;
      }
      const source = axios.CancelToken.source();
      const axiosTimeout = setTimeout(() => {
        source.cancel();
      }, AXIOS_TIMEOUT);

      const [error, txData] = await asyncAction(
        cloudscraper.get(
          `${fcds[network]}/v1/txs?offset=${offset}&limit=${limit}&account=${address}`,
          { cancelToken: source.token },
        ),
      );

      clearTimeout(axiosTimeout);
      if (error) {
        console.log(error.toJSON());
      }
      if (txData == null) {
        break;
      }
      const responseData = JSON.parse(txData);

      const txToAnalyse = responseData.txs;

      // We analyse those transactions
      // We query the NFTs from the transaction result and messages
      const [newNfts, lastTxId, newestTxId] = this.getNftsFromTxList(txToAnalyse, network);
      // If it's the first time we query the fcd, we need to add recognized NFTs
      // This step is done because some minted NFTs don't get recognized in mint, the receiver address is not recorded in the events
      if (start == null && stop == null) {
        const registered = await this.utilsService.registeredNFTAddresses(network);
        registered.forEach(nft => newNfts.add(nft));
      }

      // We add the new interacted NFTs to the list of contracts interacted with.
      // We call the callback function to use those new nfts.
      if (newNfts && callback) {
        await callback(newNfts, {
          newest: newestTxIdSeen,
          oldest: lastTxIdSeen,
        });
      }

      // Finally we update the internal transaction logic, used to come back when there is an error or timeout
      if (lastTxId != 0) {
        offset = lastTxId;
      } else {
        queryNext = false;
      }
      if (newestTxIdSeen == null || newestTxId > newestTxIdSeen) {
        newestTxIdSeen = newestTxId;
      }
      if (lastTxIdSeen == null || lastTxId < lastTxIdSeen) {
        lastTxIdSeen = lastTxId;
      }
      // Stopping tests
      if (stop != null && stop > lastTxIdSeen) {
        queryNext = false;
      }
    }

    return;
  }

  async getOneTokenBatchFromNFT(
    network: Network,
    address: string,
    nft: string,
    startAfter: string | undefined = undefined,
  ) {
    const lcdClient = new LCDClient(chains[network]);

    const [, tokenBatch] = await asyncAction(
      lcdClient.wasm.contractQuery(nft, {
        tokens: {
          owner: address,
          startAfter,
          limit: 100,
        },
      }),
    );

    if (tokenBatch?.tokens) {
      const [infoError, tokenInfos] = await asyncAction(
        Promise.all(
          tokenBatch.tokens.map(async (id: string) => {
            const tokenInfo = (await limitToken)(async () => await getAllNFTInfo(network, nft, id));
            return tokenInfo.info;
          }),
        ),
      );
      if (infoError) {
        console.log(infoError);
        return tokenBatch.tokens.map((tokenId: any) => ({
          tokenId: tokenId,
          nftInfo: {},
        }));
      }
      return tokenInfos;
    }
  }

  async parseTokensFromOneNft(network: Network, address: string, nft: string) {
    let tokens: any;
    let startAfter: string | undefined;
    let lastTokens: any;
    let allTokens: any = [];
    do {
      tokens = await this.getOneTokenBatchFromNFT(network, address, nft, startAfter);
      if (tokens && tokens.length > 0) {
        startAfter = tokens[tokens.length - 1].tokenId;
        allTokens = [...allTokens, ...tokens];
      }
      if (_.isEqual(lastTokens, tokens) && tokens) {
        // If we have the same response twice, we stop, it's not right
        tokens = undefined;
      }
      lastTokens = tokens;
    } while (tokens && tokens.length > 0);

    if (Object.keys(allTokens).length === 0) {
      return [];
    } else {
      return allTokens;
    }
  }

  // We limit the request concurrency to 10 elements
  async parseNFTSet(
    network: Network,
    nfts: Set<string> | string[],
    address: string,
  ): Promise<TokenInteracted[]> {
    const nftsArray = Array.from(nfts);
    const [, nftsOwned] = await asyncAction(
      Promise.all(
        nftsArray.map(async nft => {
          return (await limitNFT)(
            async () => await this.parseTokensFromOneNft(network, address, nft),
          );
        }),
      ),
    );

    const [, nftsInfo] = await asyncAction(
      Promise.all(
        nftsArray.map(async nft => {
          return (await limitNFT)(
            async () => await this.utilsService.getCachedNFTContractInfo(network, nft),
          );
        }),
      ),
    );

    return (nftsOwned ?? [])
      .map((nftContract: any[], i: number) => {
        return nftContract.map((token: any): TokenInteracted => {
          const tokenNftInfo = camelCaseObjectDeep(token.nftInfo);
          return {
            tokenId: token.tokenId,
            collectionAddress: nftsArray[i],
            collectionName: nftsInfo?.[i]?.collectionName,
            symbol: nftsInfo?.[i]?.symbol,
            allNFTInfo: tokenNftInfo,
            imageUrl: fromIPFSImageURLtoImageURL(tokenNftInfo?.extension?.image),
            description: tokenNftInfo?.extension?.description,
            name: tokenNftInfo?.extension?.name,
            attributes: tokenNftInfo?.extension?.attributes,
            traits: (tokenNftInfo?.extension?.attributes ?? []).map(
              ({ traitType, value }: { traitType: string; value: string }) => [traitType, value],
            ),
          };
        });
      })
      .flat();
  }
}
