import { TxLog } from "@terra-money/terra.js";
import axios from "axios";
const cloudscraper = require("cloudscraper");
import { asyncAction } from "../js/asyncAction";
import { fcds } from "./chains";
import { Network } from "./dto/network.dto";
import { getRegisteredNFTs } from "./nft_query";
const AXIOS_TIMEOUT = 10_000;

function addFromWasmEvents(tx: any, nftsInteracted: Set<string>, network: Network) {
  for (const log of tx?.logs) {
    if (network == Network.classic) {
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
}

export function getNftsFromTxList(txData: any, network: Network): [Set<string>, number, number] {
  const nftsInteracted: Set<string> = new Set();
  let lastTxIdSeen = 0;
  let newestTxIdSeen = 0;
  // In case we are using cloudscraper to get rid of cloudflare
  for (const tx of txData) {
    // We add NFTS interacted with
    addFromWasmEvents(tx, nftsInteracted, network);

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
      console.error(error);
    }
    if (txData == null) {
      break;
    }
    const responseData = JSON.parse(txData);

    const txToAnalyse = responseData.txs;

    // We analyse those transactions
    // We query the NFTs from the transaction result and messages
    const [newNfts, lastTxId, newestTxId] = getNftsFromTxList(txToAnalyse, network);

    // If it's the first time we query the fcd, we need to add recognized NFTs
    // This step is done because some minted NFTs don't get recognized in mint, the receiver address is not recorded in the events
    if (start == null && stop == null) {
      const registered = await getRegisteredNFTs(network);
      Object.entries(registered).forEach(([nft]) => newNfts.add(nft));
    }

    // We add the new interacted NFTs to the list of contracts interacted with.
    // We call the callback function to use those new nfts.
    if (newNfts) {
      await callback(newNfts, {
        newestTx: newestTxIdSeen,
        oldestTx: lastTxIdSeen,
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
