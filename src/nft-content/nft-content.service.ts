import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import "dotenv/config";
import { NFTContentResponse, UpdateMode } from "./dto/get-nft-content.dto";
import { Network } from "../utils/blockchain/dto/network.dto";
import { NftContentQuerierService } from "./nft-content-querier.service";
import Redis from "ioredis";
import {
  UpdateState,
  WalletContent,
  WalletContentTransactions,
} from "./entities/nft-content.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { updateInteractedNfts } from "../utils/blockchain/fcdNftQuery";
import { RedisLock, RedisLockService } from "../utils/lock";

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
if (process.env.IDLE_UPDATE_INTERVAL == undefined) {
  process.env.IDLE_UPDATE_INTERVAL = "20000";
}
const IDLE_UPDATE_INTERVAL = parseInt(process.env.IDLE_UPDATE_INTERVAL);

@Injectable()
export class NftContentService {
  redisDB: Redis;

  readonly logger = new Logger(NftContentService.name);
  constructor(
    private readonly nftContentQuerierService: NftContentQuerierService,
    protected readonly lockService: RedisLockService,
    @InjectRepository(WalletContent) private walletContentRepository: Repository<WalletContent>,
  ) {}

  async findNfts(network: Network, address: string): Promise<NFTContentResponse> {
    const currentData: WalletContent = await this.walletContentRepository.findOne({
      relations: {
        ownedTokens: {
          metadata: {
            attributes: true,
          },
        },
      },
      where: {
        network,
        user: address,
      },
    });
    return this.nftContentQuerierService.mapWalletContentDBForResponse(network, currentData);
  }

  async update(network: Network, address: string, mode: UpdateMode): Promise<NFTContentResponse> {
    // First we get the current data
    let currentData: WalletContent = await this.walletContentRepository.findOne({
      relations: {
        ownedTokens: {
          metadata: {
            attributes: true,
          },
        },
      },
      where: {
        network,
        user: address,
      },
    });
    if (!currentData) {
      currentData = new WalletContent();
      currentData.network = network;
      currentData.user = address;
    }
    if (
      currentData?.lastUpdateStartTime &&
      Date.now() < +currentData?.lastUpdateStartTime + IDLE_UPDATE_INTERVAL
    ) {
      throw new ForbiddenException("Too much requests my girl");
    }

    if (mode == UpdateMode.FORCE_UPDATE) {
      currentData.reset();
    }

    // We update the saved data
    this._internalUpdate(network, address, currentData).catch(error =>
      this.logger.error("Error during update", error),
    );
    return await this.nftContentQuerierService.mapWalletContentDBForResponse(network, currentData);
  }

  @RedisLock(
    (_target, network, address) =>
      `${toNFTKey(network, address)}_updateLock_${process.env.DB_VERSION}`,
    UPDATE_DESPITE_LOCK_TIME,
    0,
    1,
  )
  async _internalUpdate(network: Network, address: string, data: WalletContent) {
    // And we now start the actual update
    await this.updateAddress(network, address, data);

    // We save the updated object to database for the last time
    await this.walletContentRepository.save([data]);
  }

  async sleep(ms: number) {
    const promise = new Promise(resolve => {
      setTimeout(resolve, ms);
    });
    return promise;
  }

  async updateAddress(network: Network, address: string, data: WalletContent) {
    // We setup a timeout for the query
    const hasTimedOut = { timeout: false };
    const timeout = setTimeout(async () => {
      hasTimedOut.timeout = true;
    }, QUERY_TIMEOUT);

    const willQueryBefore = data.state != UpdateState.Full;
    // We awnt ot prevent multiple updates, so we update the internals
    data.lastUpdateStartTime = Date.now();
    data.state = UpdateState.isUpdating;
    await this.walletContentRepository.save([data]);

    this.logger.log(`Update Triggered for ${address}`);

    const queryCallback = async (newContracts: string[], txSeen: WalletContentTransactions) => {
      if (!network || !address || !data) {
        return;
      }
      await this.updateOwnedTokens(network, address, newContracts, data, txSeen);
      data.state = UpdateState.isUpdating;
      await this.walletContentRepository.save([data]);
    };

    // The Terra fcd returns transactions oldest first
    // In order to query all transactions with this way of querying the chain, we use a three step query.
    // 1. We start by querying data in the possible interval that was left by older update tries
    // This means we want to query between the latests transactions queried and the oldest ones
    // || : means transactions that were already queried
    // -- : means transactions that were not queried already
    // <<--- newest transactions ********** oldest transactions ---->>
    // -------- |||||||| -------- ||||||||||||||----------
    // ******************* ^^^^ here ***********
    if (
      data.internalNewestTx != null &&
      data.internalOldestTx != null &&
      data.internalOldestTx < data.internalNewestTx
    ) {
      // Here we can query interval transactions
      await updateInteractedNfts(
        network,
        address,
        data.internalNewestTx,
        data.internalOldestTx,
        queryCallback,
        hasTimedOut,
      );
    }

    // 2. Then we query new transactions
    // This means we want to query between the latests transactions queried and the oldest ones
    // -------- |||||||| ---------
    // * ^^^^ here ***************
    // Then we query new transactions
    await updateInteractedNfts(
      network,
      address,
      null,
      data.externalNewestTx,
      queryCallback,
      hasTimedOut,
    );

    // 3. Finally, we want to query very olds transactions that were not queried before
    // We know there are some transactions left when the UpdateState has never reached the full state.
    // |||||||||||||||||| ----------------
    // ******************* ^^^^ here ***
    // Then we query new transactions
    // We then query old data if not finalized
    if (willQueryBefore) {
      await updateInteractedNfts(
        network,
        address,
        data.externalOldestTx,
        null,
        queryCallback,
        hasTimedOut,
      );
    }

    // Finally after querying a lot, we need to specify how the update has ended.
    // If any query has timed out, the query is not final, we still have potential data to query
    // If not, the query is final, we have queried all data so far so that's just perfect
    if (hasTimedOut.timeout) {
      data.state = UpdateState.Partial;
    } else {
      data.state = UpdateState.Full;
    }
    clearTimeout(timeout);
  }

  async updateOwnedTokens(
    network: Network,
    address: string,
    newContracts: string[],
    data: WalletContent,
    newTxs: WalletContentTransactions,
  ): Promise<void> {
    // First we update the tokens in the contract we have already seen
    await this.nftContentQuerierService.parseNFTSet(data, network, newContracts, address);

    // Then we update the transactions we've already seen
    this.updateSeenTransaction(data, newTxs);
  }
  updateSeenTransaction(currentData: WalletContent, newTxs: WalletContentTransactions): void {
    // If there is an interval, we init the interval data
    if (
      newTxs.oldestTx &&
      currentData.externalNewestTx &&
      newTxs.oldestTx > currentData.externalNewestTx
    ) {
      currentData.internalNewestTx = newTxs.oldestTx;
      currentData.internalOldestTx = currentData.externalNewestTx;
    }

    // We fill the internal hole first
    if (
      currentData.internalNewestTx &&
      currentData.internalOldestTx &&
      newTxs.newestTx &&
      newTxs.oldestTx &&
      currentData.internalNewestTx > newTxs.oldestTx &&
      newTxs.newestTx >= currentData.internalOldestTx
    ) {
      currentData.internalNewestTx = newTxs.oldestTx;
    }

    if (
      currentData.externalNewestTx == null ||
      (newTxs.newestTx && newTxs.newestTx > currentData.externalNewestTx)
    ) {
      currentData.externalNewestTx = newTxs.newestTx;
    }
    if (
      currentData.externalOldestTx == null ||
      (newTxs.oldestTx && newTxs.oldestTx < currentData.externalOldestTx)
    ) {
      currentData.externalOldestTx = newTxs.oldestTx;
    }
  }
}
