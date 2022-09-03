import { LCDClient, TxLog } from "@terra-money/terra.js";
import axios from "axios";
const pLimit = require("p-limit");
import { TokenInteracted } from "../../nft-content/dto/get-nft-content.dto";
import { addNftInfo, getNftInfo } from "../mysql_db_accessor";

var cloudscraper = require("cloudscraper");
const camelCaseObjectDeep = require("camelcase-object-deep");
var _ = require("lodash");

const limitNFT = pLimit(10);
const limitToken = pLimit(50);
const AXIOS_TIMEOUT = 10_000;

import { chains, fcds } from "./chains.js";
import { asyncAction } from "../js/asyncAction.js";
import { fromIPFSImageURLtoImageURL } from "./ipfs.js";
import { registeredNFTAddresses } from "./queryNFTInfo";
import { Network } from "./dto/network.dto";

function addFromWasmEvents(tx: any, nftsInteracted: any, chain_type: string) {
  for (let log of tx?.logs) {
    if (chain_type == "classic") {
      let parsedLog = new TxLog(log.msg_index, log.log, log.events);
      let from_contract = parsedLog.eventsByType.from_contract;
      if (from_contract?.action) {
        if (
          from_contract.action.includes("transfer_nft") ||
          from_contract.action.includes("send_nft") ||
          from_contract.action.includes("mint")
        ) {
          from_contract.contract_address.forEach(nftsInteracted.add, nftsInteracted);
        }
      }
    } else {
      let parsedLog = new TxLog(log.msg_index, log.log, log.events);
      let from_contract = parsedLog.eventsByType.wasm;
      if (from_contract?.action) {
        if (
          from_contract.action.includes("transfer_nft") ||
          from_contract.action.includes("send_nft") ||
          from_contract.action.includes("mint")
        ) {
          from_contract._contract_address.forEach(nftsInteracted.add, nftsInteracted);
        }
      }
    }
  }
  return nftsInteracted;
}

function getNftsFromTxList(txData: any, chain_type: string): [Set<string>, number, number] {
  var nftsInteracted: Set<string> = new Set();
  let lastTxIdSeen = 0;
  let newestTxIdSeen = 0;
  // In case we are using cloudscraper to get rid of cloudflare
  for (let tx of txData) {
    // We add NFTS interacted with
    nftsInteracted = addFromWasmEvents(tx, nftsInteracted, chain_type);

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

export async function updateInteractedNfts(
  network: Network,
  address: string,
  start: number | null,
  stop: number | null,
  callback: any,
  hasTimedOut: any = { timeout: false },
) {
  let query_next: boolean = true;
  let limit = 100;
  let offset: number = start ?? 0;
  let newestTxIdSeen: number | null = null;
  let lastTxIdSeen: number | null = null;
  while (query_next) {
    if (hasTimedOut.timeout) {
      return;
    }
    const source = axios.CancelToken.source();
    const axiosTimeout = setTimeout(() => {
      source.cancel();
    }, AXIOS_TIMEOUT);

    let [error, tx_data] = await asyncAction(
      cloudscraper.get(
        `${fcds[network]}/v1/txs?offset=${offset}&limit=${limit}&account=${address}`,
        { cancelToken: source.token },
      ),
    );

    clearTimeout(axiosTimeout);
    if (error) {
      console.log(error.toJSON());
    }
    if (tx_data == null) {
      break;
    }
    let responseData = JSON.parse(tx_data);

    let txToAnalyse = responseData.txs;

    // We analyse those transactions
    // We query the NFTs from the transaction result and messages
    let [newNfts, lastTxId, newestTxId] = getNftsFromTxList(txToAnalyse, network);
    // If it's the first time we query the fcd, we need to add recognized NFTs
    // This step is done because some minted NFTs don't get recognized in mint, the receiver address is not recorded in the events
    if (start == null && stop == null) {
      let registered = await registeredNFTAddresses(network);
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
      query_next = false;
    }
    if (newestTxIdSeen == null || newestTxId > newestTxIdSeen) {
      newestTxIdSeen = newestTxId;
    }
    if (lastTxIdSeen == null || lastTxId < lastTxIdSeen) {
      lastTxIdSeen = lastTxId;
    }
    // Stopping tests
    if (stop != null && stop > lastTxIdSeen) {
      query_next = false;
    }
  }

  return;
}

async function getOneTokenBatchFromNFT(
  network: Network,
  address: string,
  nft: string,
  start_after: string | undefined = undefined,
) {
  let lcdClient = new LCDClient(chains[network]);

  let [_error, tokenBatch] = await asyncAction(
    lcdClient.wasm.contractQuery(nft, {
      tokens: {
        owner: address,
        start_after: start_after,
        limit: 100,
      },
    }),
  );

  if (tokenBatch?.tokens) {
    let [infoError, tokenInfos] = await asyncAction(
      Promise.all(
        tokenBatch.tokens.map(async (id: string) =>
          (
            await limitToken
          )(() => getOneTokenInfo(network, nft, id)),
        ),
      ),
    );
    if (infoError) {
      console.log(infoError);
      return tokenBatch.tokens.map((token_id: any) => ({
        tokenId: token_id,
        nftInfo: {},
      }));
    }
    return tokenInfos;
  }
}

async function parseTokensFromOneNft(network: Network, address: string, nft: string) {
  let tokens: any;
  let start_after: string | undefined = undefined;
  let last_tokens: any;
  let allTokens: any = [];
  do {
    tokens = await getOneTokenBatchFromNFT(network, address, nft, start_after);
    if (tokens && tokens.length > 0) {
      start_after = tokens[tokens.length - 1].tokenId;
      allTokens = [...allTokens, ...tokens];
    }
    if (_.isEqual(last_tokens, tokens) && tokens) {
      // If we have the same response twice, we stop, it's not right
      tokens = undefined;
    }
    last_tokens = tokens;
  } while (tokens && tokens.length > 0);

  if (Object.keys(allTokens).length === 0) {
    return [];
  } else {
    return allTokens;
  }
}

async function getCachedNFTInfo(network: Network, nft: string) {
  let [_err, cachedInfo] = await asyncAction(getNftInfo(network, nft));

  if (cachedInfo?.[0]?.name) {
    return {
      name: cachedInfo[0]?.name,
      symbol: cachedInfo[0]?.symbol,
    };
  }

  // If there is no cached info, we get the distant info
  let [_lcdErr, newInfo] = await asyncAction(getDistantNftInfo(network, nft));

  if (newInfo) {
    await addNftInfo([
      {
        network: network,
        nftAddress: nft,
        name: newInfo.name,
        symbol: newInfo.symbol,
      },
    ]);
  }
  return newInfo;
}

async function getDistantNftInfo(network: Network, nft: string) {
  let lcdClient = new LCDClient(chains[network]);
  let [_error, nftInfo] = await asyncAction(
    lcdClient.wasm.contractQuery(nft, {
      contract_info: {},
    }),
  );
  return {
    name: nftInfo.name,
    symbol: nftInfo.symbol,
  };
}

async function getOneTokenInfo(network: Network, nft: string, id: string) {
  let lcdClient = new LCDClient(chains[network]);
  let [_error, tokenInfo] = await asyncAction(
    lcdClient.wasm.contractQuery(nft, {
      nft_info: { token_id: id },
    }),
  );

  return {
    tokenId: id,
    nftInfo: tokenInfo,
  };
}

// We limit the request concurrency to 10 elements
export async function parseNFTSet(
  network: Network,
  nfts: Set<string> | string[],
  address: string,
): Promise<TokenInteracted[]> {
  let nftsArray = Array.from(nfts);
  let [_error, nftsOwned] = await asyncAction(
    Promise.all(
      nftsArray.map(async nft => {
        return (await limitNFT)(() => parseTokensFromOneNft(network, address, nft));
      }),
    ),
  );

  let [_infoError, nftsInfo] = await asyncAction(
    Promise.all(
      nftsArray.map(async nft => {
        return (await limitNFT)(() => getCachedNFTInfo(network, nft));
      }),
    ),
  );

  return nftsOwned
    .map((nftContract: any[], i: number) => {
      return nftContract.map((token: any) => {
        let tokenNftInfo = camelCaseObjectDeep(token.nftInfo);
        return {
          tokenId: token.tokenId,
          contractAddress: nftsArray[i],
          collectionName: nftsInfo?.[i]?.name,
          allNftInfo: tokenNftInfo,
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
