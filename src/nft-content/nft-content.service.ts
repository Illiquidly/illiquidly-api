import { Injectable } from "@nestjs/common";
import "dotenv/config";
import {
  NFTContentResponse,
  StoreContractsInteracted,
  StoredTokenInteracted,
  TokenInteracted,
  TxInterval,
  UpdateMode,
  UpdateState,
} from "./dto/get-nft-content.dto";
import {
  canUpdate,
  defaultContractsApiStructure,
  getNFTContentFromDb,
  saveNFTContentToDb,
} from "../utils/redis_db_accessor";
import { Network } from "../utils/blockchain/dto/network.dto";
import { NftContentQuerierService } from "./nft-content-querier.service";
import { RedisService } from "nestjs-redis";
import Redis from "ioredis";
import { RedisLock, RedisLockService } from "nestjs-simple-redis-lock";

function toNFTKey(network: string, address: string) {
  return `nft:${address}@${network}_${process.env.DB_VERSION}`;
}

if (process.env.QUERY_TIMEOUT == undefined) {
  process.env.QUERY_TIMEOUT = "100000";
}
const QUERY_TIMEOUT = parseInt(process.env.QUERY_TIMEOUT);
if (process.env.UPDATE_DESPITE_LOCK_TIME == undefined) {
  process.env.UPDATE_DESPITE_LOCK_TIME = "120000";
}
const UPDATE_DESPITE_LOCK_TIME = parseInt(process.env.UPDATE_DESPITE_LOCK_TIME);

@Injectable()
export class NftContentService {
  redisDB: Redis;

  constructor(
    private readonly nftContentQuerierService: NftContentQuerierService,
    private readonly redisService: RedisService,
    protected readonly lockService: RedisLockService,
  ) {
    this.redisDB = redisService.getClient();
  }

  async _internalGetNfts(network: Network, address: string): Promise<StoreContractsInteracted> {
    // We get the db data
    const dbKey = toNFTKey(network, address);
    return await getNFTContentFromDb(this.redisDB, dbKey);
  }

  async findNfts(network: Network, address: string): Promise<NFTContentResponse> {
    const currentData: StoreContractsInteracted = await this._internalGetNfts(network, address);
    console.log("current", currentData);
    return this.nftContentQuerierService.mapForResponse(network, currentData);
  }

  async update(network: Network, address: string, mode: UpdateMode): Promise<NFTContentResponse> {
    // First we get the current data
    const currentData = await this._internalGetNfts(network, address);

    let returnData = { ...currentData };
    if (mode == UpdateMode.UPDATE) {
      returnData.state = UpdateState.isUpdating;
    } else if (mode == UpdateMode.FORCE_UPDATE) {
      returnData = defaultContractsApiStructure();
      returnData.state = UpdateState.isUpdating;
    }
    // Then we process the updateFunction
    this._internalUpdate(network, address, mode, currentData);

    // And without waiting for the end of execution, we return the data
    return this.nftContentQuerierService.mapForResponse(network, returnData);
  }

  @RedisLock(
    (_target, network, address) =>
      `${toNFTKey(network, address)}_updateLock_${process.env.DB_VERSION}`,
    UPDATE_DESPITE_LOCK_TIME,
    0,
    1,
  )
  async _internalUpdate(
    network: Network,
    address: string,
    mode: UpdateMode,
    data: StoreContractsInteracted,
  ) {
    // Here we want to update the database

    const dbKey = toNFTKey(network, address);
    // We make sure we can update
    await canUpdate(this.redisDB, dbKey);

    // We deal with timeouts and shit
    const hasTimedOut = { timeout: false };
    const timeout = setTimeout(async () => {
      hasTimedOut.timeout = true;
      console.log("has timed-out");
    }, QUERY_TIMEOUT);

    // We launch the actual update code
    // Force update restarts everything from scratch

    if (mode == UpdateMode.FORCE_UPDATE) {
      data = defaultContractsApiStructure();
    }
    console.log("start update");
    data = await this.updateAddress(
      dbKey,
      network,
      address,
      { ...data },
      hasTimedOut,
      this.nftContentQuerierService.updateInteractedNfts.bind(this.nftContentQuerierService),
      this.nftContentQuerierService.parseNFTSet.bind(this.nftContentQuerierService),
    );
    clearTimeout(timeout);

    // We save the updated object to db and release the Lock on the database
    await saveNFTContentToDb(this.redisDB, dbKey, data);
  }

  async updateAddress(
    dbKey: string,
    network: string,
    address: string,
    currentData: StoreContractsInteracted,
    hasTimedOut: any,
    queryNewInteractedContracts: any,
    parseTokenSet: typeof this.nftContentQuerierService.parseNFTSet,
  ) {
    const willQueryBefore = currentData.state != UpdateState.Full;
    // We update currentData to prevent multiple updates
    currentData.state = UpdateState.isUpdating;
    await saveNFTContentToDb(this.redisDB, dbKey, currentData);

    const queryCallback = async (newContracts: Set<string>, txSeen: TxInterval) => {
      if (!network || !address || !currentData) {
        return;
      }
      currentData = await this.updateOwnedTokensAndSave(
        network,
        address,
        newContracts,
        { ...currentData },
        txSeen,
        parseTokenSet,
      );
      currentData.state = UpdateState.isUpdating;
      await saveNFTContentToDb(this.redisDB, dbKey, currentData);
    };

    // We start by querying data in the possible interval (between the latests transactions queried and the oldest ones)
    if (
      currentData.txs.internal.newest != null &&
      currentData.txs.internal.oldest != null &&
      currentData.txs.internal.oldest < currentData.txs.internal.newest
    ) {
      // Here we can query interval transactions
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

  async updateOwnedTokensAndSave(
    network: string,
    address: string,
    newContracts: Set<string>,
    currentData: StoreContractsInteracted,
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

      const ownedTokens: StoredTokenInteracted[] = await parseTokenSet(
        network,
        newContracts,
        address,
      );
      console.log("owned Tokens", ownedTokens);

      // We update the owned tokens
      ownedTokens.forEach((token: StoredTokenInteracted) => {
        // First we find if the token data already exists in the array
        const existingIndex = currentData.ownedTokens.findIndex(
          element =>
            element.tokenId == token.tokenId &&
            element.collectionAddress == token.collectionAddress,
        );
        if (existingIndex == -1) {
          currentData.ownedTokens.push(token);
        } else {
          currentData.ownedTokens[existingIndex] = token;
        }
      });
    }

    // Then we update the transactions we've already seen
    this.updateSeenTransaction(currentData, newTxs);

    return currentData;
  }
  updateSeenTransaction(currentData: StoreContractsInteracted, newTxs: TxInterval) {
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
}
