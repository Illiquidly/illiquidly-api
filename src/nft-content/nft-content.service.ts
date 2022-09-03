import { Injectable } from "@nestjs/common";
import "dotenv/config";
import { TokenInteracted, TxInterval, UpdateMode, UpdateState } from "./dto/get-nft-content.dto";
import {
  canUpdate,
  ContractsInteracted,
  defaultContractsApiStructure,
  getNFTContentFromDb,
  serialise,
  deserialise,
  SerializableContractsInteracted,
  saveNFTContentToDb,
  releaseUpdateLock,
} from "../utils/redis_db_accessor";
import { validateRequest } from "../utils/js/validateRequests";
import { Network } from "../utils/blockchain/dto/network.dto";
import { initNFTDB, quitNFTDB } from "../utils/mysql_db_accessor";
import { parseNFTSet, updateInteractedNfts } from "../utils/blockchain/queryNFTContent";

const _ = require("lodash");

function toNFTKey(network: string, address: string) {
  return `nft:${address}@${network}_${process.env.DB_VERSION!}`;
}

@Injectable()
export class NftContentService {
  async findNfts(network: Network, address: string): Promise<SerializableContractsInteracted> {
    validateRequest(network);

    // We get the db data
    let dbKey = toNFTKey(network, address);
    let currentData: ContractsInteracted = await getNFTContentFromDb(dbKey);

    return serialise(currentData);
  }

  async update(network: Network, address: string, mode: UpdateMode) {
    validateRequest(network, mode);

    // First we get the current data
    let currentData = await this.findNfts(network, address);

    let returnData = { ...currentData };
    if (mode == UpdateMode.UPDATE) {
      returnData.state = UpdateState.isUpdating;
    } else if (mode == UpdateMode.FORCE_UPDATE) {
      returnData = serialise(defaultContractsApiStructure());
      returnData.state = UpdateState.isUpdating;
    }
    //Then we process the updateFunction
    _internal_update(network, address, mode, deserialise(currentData));

    // And without waiting for the end of execution, we return the data
    return returnData;
  }
}

if (process.env.QUERY_TIMEOUT == undefined) {
  process.env.QUERY_TIMEOUT = "100000";
}
const QUERY_TIMEOUT = parseInt(process.env.QUERY_TIMEOUT);

async function _internal_update(
  network: Network,
  address: string,
  mode: UpdateMode,
  data: ContractsInteracted,
) {
  // Here we want to update the database

  let dbKey = toNFTKey(network, address);
  let lock = await canUpdate(dbKey);

  if (!lock) {
    return;
  }

  // We deal with timeouts and shit
  let hasTimedOut = { timeout: false };
  let timeout = setTimeout(async () => {
    hasTimedOut.timeout = true;
    console.log("has timed-out");
  }, QUERY_TIMEOUT);

  // We launch the actual update code

  // Force update restarts everything from scratch

  if (mode == UpdateMode.FORCE_UPDATE) {
    data = defaultContractsApiStructure();
  }

  await initNFTDB();
  data = await updateAddress(
    dbKey,
    network,
    address,
    { ...data },
    hasTimedOut,
    updateInteractedNfts,
    parseNFTSet,
  );
  await quitNFTDB();
  clearTimeout(timeout);

  // We save the updated object to db and release the Lock on the database
  await saveNFTContentToDb(dbKey, data);
  await releaseUpdateLock(lock);
}

async function updateAddress(
  dbKey: string,
  network: string,
  address: string,
  currentData: ContractsInteracted,
  hasTimedOut: any,
  queryNewInteractedContracts: any,
  parseTokenSet: typeof parseNFTSet,
) {
  const willQueryBefore = currentData.state != UpdateState.Full;
  // We update currentData to prevent multiple updates
  currentData.state = UpdateState.isUpdating;
  await saveNFTContentToDb(dbKey, currentData);

  const queryCallback = async (newContracts: Set<string>, txSeen: TxInterval) => {
    if (!network || !address || !currentData) {
      return;
    }
    currentData = await updateOwnedTokensAndSave(
      network,
      address,
      newContracts,
      { ...currentData },
      txSeen,
      parseTokenSet,
    );
    currentData.state = UpdateState.isUpdating;
    await saveNFTContentToDb(dbKey, currentData);
  };

  // We start by querying data in the possible interval (between the latests transactions queried and the oldest ones)
  if (
    currentData.txs.internal.newest != null &&
    currentData.txs.internal.oldest != null &&
    currentData.txs.internal.oldest < currentData.txs.internal.newest
  ) {
    //Here we can query interval transactions
    await queryNewInteractedContracts(
      network,
      address,
      currentData.txs.internal.newest,
      currentData.txs.internal.oldest,
      queryCallback,
      hasTimedOut,
    );
  }

  // Then we query new transactions
  await queryNewInteractedContracts(
    network,
    address,
    null,
    currentData.txs.external.newest,
    queryCallback,
    hasTimedOut,
  );

  // We then query old data if not finalized
  if (willQueryBefore) {
    await queryNewInteractedContracts(
      network,
      address,
      currentData.txs.external.oldest,
      null,
      queryCallback,
      hasTimedOut,
    );
  }

  if (hasTimedOut.timeout) {
    currentData.state = UpdateState.Partial;
  } else {
    currentData.state = UpdateState.Full;
  }

  return currentData;
}

async function updateOwnedTokensAndSave(
  network: string,
  address: string,
  newContracts: Set<string>,
  currentData: ContractsInteracted,
  newTxs: TxInterval,
  parseTokenSet: (n: string, c: Set<string>, a: string) => Promise<TokenInteracted[]>,
) {
  // We start by updating the NFT object
  if (newContracts.size) {
    const contracts: Set<string> = new Set(currentData.interactedContracts);
    // For new nft interactions, we update the owned nfts
    console.log("Querying NFT data from LCD");

    newContracts.forEach(token => contracts.add(token));
    currentData.interactedContracts = contracts;
    // We query what tokens are actually owned by the address

    const ownedTokens: TokenInteracted[] = await parseTokenSet(network, newContracts, address);

    // We update the owned tokens
    ownedTokens.forEach((token: TokenInteracted) => {
      // First we find if the token data already exists in the array
      let existingIndex = currentData.ownedTokens.findIndex(
        element =>
          element.tokenId == token.tokenId && element.contractAddress == token.contractAddress,
      );
      if (existingIndex == -1) {
        currentData.ownedTokens.push(token);
      } else {
        currentData.ownedTokens[existingIndex] = token;
      }
    });

    // We update the owned Contracts
    currentData.ownedCollections = _.uniqBy(
      currentData.ownedTokens.map(token => ({
        collectionName: token.collectionName,
        collectionAddress: token.contractAddress,
      })),
      "collectionAddress",
    );
  }

  // Then we update the transactions we've already seen
  updateSeenTransaction(currentData, newTxs);

  return currentData;
}
function updateSeenTransaction(currentData: ContractsInteracted, newTxs: TxInterval) {
  // If there is an interval, we init the interval data
  if (
    newTxs.oldest &&
    currentData.txs.external.newest &&
    newTxs.oldest > currentData.txs.external.newest
  ) {
    currentData.txs.internal.newest = newTxs.oldest;
    currentData.txs.internal.oldest = currentData.txs.external.newest;
  }

  // We fill the internal hole first
  if (
    currentData.txs.internal.newest &&
    currentData.txs.internal.oldest &&
    newTxs.newest &&
    newTxs.oldest &&
    currentData.txs.internal.newest > newTxs.oldest &&
    newTxs.newest >= currentData.txs.internal.oldest
  ) {
    currentData.txs.internal.newest = newTxs.oldest;
  }

  if (
    currentData.txs.external.newest == null ||
    (newTxs.newest && newTxs.newest > currentData.txs.external.newest)
  ) {
    currentData.txs.external.newest = newTxs.newest;
  }
  if (
    currentData.txs.external.oldest == null ||
    (newTxs.oldest && newTxs.oldest < currentData.txs.external.oldest)
  ) {
    currentData.txs.external.oldest = newTxs.oldest;
  }
}
