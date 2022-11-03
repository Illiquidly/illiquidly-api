import { Inject, Injectable, Logger } from "@nestjs/common";
import "dotenv/config";
import { Network } from "../utils/blockchain/dto/network.dto";

import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigType } from "@nestjs/config";
import { RedLockService } from "../utils/lock.service";
import { NFTTransfer, NFTTransferTransaction } from "./entities/nft-transfer.entity";
import Redis from "ioredis";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import { TxInfo, TxLog } from "@terra-money/terra.js";
import { RawLCDQuery } from "../utils/blockchain/queryRawLCD.service";
import { nftTransferAPIConfig } from "../utils/configuration";
import { UtilsService } from "../utils-api/utils.service";
import { asyncAction } from "../utils/js/asyncAction";
import { NFTTransferResponse } from "./dto/get-nft-transfer.dto";
const pMap = require("p-map");
const _ = require("lodash");

@Injectable()
export class NftTransferService {
  nftTransferAPIConfig: ConfigType<typeof nftTransferAPIConfig>;
  readonly logger = new Logger(NftTransferService.name);

  constructor(
    @InjectRepository(NFTTransferTransaction)
    private nftTransferTransactionRepository: Repository<NFTTransferTransaction>,
    @Inject(nftTransferAPIConfig.KEY) transferConfig: ConfigType<typeof nftTransferAPIConfig>,
    private readonly redlockService: RedLockService,
    @InjectRedis("default-client") readonly redisDB: Redis,
    private readonly lcdTxQuery: RawLCDQuery,
    private readonly utilsService: UtilsService,
  ) {
    this.nftTransferAPIConfig = transferConfig;
  }

  async update(network: Network) {
    // We want to update all the transfers that happened since last time
    // This requires a lock on the update procedure

    // Filter callback

    const filterCallBack = async (transactions: TxInfo[]) => {
      // We filter the transactions that are not in the database for now
      const txFilter = await Promise.all(
        transactions.map(async (tx: any) => !(await this.hasTx(network, tx.txhash))),
      );
      return transactions.filter((_1: any, i: number) => txFilter[i]);
    };

    // Callback --> We need to treat every tx
    const callBack = async (transactions: TxInfo[]) => {
      const nftTransfers = await pMap(
        transactions,
        async (tx: TxInfo): Promise<NFTTransferTransaction> => {
          // 1. We verify the transaction was not already studied

          // 2. We study the transaction
          const transfers = await pMap(tx.logs, async (log: TxLog): Promise<NFTTransfer[]> => {
            // First we start by getting only the wasm event
            const wasmAttributes =
              log.events.filter(event => event.type == "wasm")?.[0]?.attributes ?? [];

            // We want to detect the following pattern :
            ///  _contract_address: nftAddress
            ///  'action': 'transfer_nft',
            ///  'sender': "sender",
            ///  "recipient": "recipient"
            ///  "token_id": tokenId

            // 1. we take all contract_address indexes
            const contractIndexes = wasmAttributes
              .map((attribute, index) => (attribute.key == "_contract_address" ? index : undefined))
              .filter(x => x != undefined);

            // 2. We map all matches to verify they match. And we save the object
            return await pMap(contractIndexes, async (index): Promise<NFTTransfer> => {
              // "action" == "transfer_nft"
              if (
                index + 1 >= wasmAttributes.length ||
                wasmAttributes[index + 1].key != "action" ||
                wasmAttributes[index + 1].value != "transfer_nft"
              ) {
                return;
              }
              // "sender" exists
              if (index + 2 >= wasmAttributes.length || wasmAttributes[index + 2].key != "sender") {
                return;
              }
              // "recipient" exists
              if (
                index + 3 >= wasmAttributes.length ||
                wasmAttributes[index + 3].key != "recipient"
              ) {
                return;
              }
              // "token_id" exists
              if (
                index + 4 >= wasmAttributes.length ||
                wasmAttributes[index + 4].key != "token_id"
              ) {
                return;
              }

              const nftAddress = wasmAttributes[index].value;
              const sender = wasmAttributes[index + 2].value;
              const recipient = wasmAttributes[index + 3].value;
              const tokenId = wasmAttributes[index + 4].value;

              // We create the nft object as well as the nft transfer object

              const [err, token] = await asyncAction(
                this.utilsService.nftTokenInfoFromDB(network, nftAddress, tokenId),
              );
              if (err) {
                return;
              }

              const transfer = new NFTTransfer();
              transfer.sender = sender;
              transfer.recipient = recipient;
              transfer.cw721Token = token;
              return transfer;
            });
          });
          if (!transfers.length) {
            return undefined;
          }
          return {
            id: null,
            network,
            blockHeight: tx.height,
            date: new Date(tx.timestamp),
            txHash: tx.txhash,
            memo: tx.tx.body.memo,
            sentAssets: _.compact(transfers.flat()),
          };
        },
      );

      const transfersToSave = _.compact(nftTransfers.flat());
      if (transfersToSave.length) {
        console.log(`Save in progress, ${transfersToSave.length} record to save...`);

        await this.nftTransferTransactionRepository.save(transfersToSave);
        /*
        await pMap(transfersToSave, async (tx) => {
          await this.nftTransferTransactionRepository.save(tx).catch((error) =>{
            console.log("problematic tx", tx, tx.sentAssets)
            throw error
          });
        })
        */
        console.log("Save done.");
      }
    };

    // OffsetCallBack --> We need to save the transaction hashes to a redis set and get the length of the hasset
    const offsetCallBack = async (transactions: TxInfo[]) => {
      const txHashes = transactions.map(tx => tx.txhash);
      if (txHashes.length) {
        await this.addTx(network, txHashes);
      }
      const nbTxs = await this.getHashSetCardinal(network);
      if (nbTxs == 0) {
        return undefined;
      }
      return nbTxs;
    };

    // 1. First we start by querying new transactions using the callback and the offsetcalback
    this.lcdTxQuery.getAllTxResults(
      network,
      [
        {
          key: "wasm.action",
          value: "transfer_nft",
        },
      ],
      offsetCallBack,
      filterCallBack,
      callBack,
    );
  }

  async reset(network: Network) {
    // We reset the redis Database
    await this.redisDB.del(this.getSetName(network));
    // We reset the mysql database
    await this.nftTransferTransactionRepository.query(
      "DROP TABLE nft_transfer_transaction,nft_transfer",
    );
  }
  getSetName(network: Network) {
    return `${this.nftTransferAPIConfig.TXHASH_SET_NAME}-${network}`;
  }

  async getHashSetCardinal(network: Network) {
    return await this.redisDB.scard(this.getSetName(network));
  }

  async hasTx(network: Network, txHash: string): Promise<boolean> {
    return (await this.redisDB.sismember(this.getSetName(network), txHash)) == 1;
  }

  async addTx(network: Network, txHashes: string[]) {
    return this.redisDB.sadd(this.getSetName(network), txHashes);
  }

  parseNFTTransferTransactionDBToResponse(tx: NFTTransferTransaction): NFTTransferResponse {
    return {
      id: tx.id,
      network: tx.network,
      blockHeight: tx.blockHeight,
      date: tx.date.toISOString(),
      txHash: tx.txHash,
      memo: tx.memo,
      sentAssets: tx.sentAssets.map(asset => ({
        id: asset.id,
        sender: asset.sender,
        recipient: asset.recipient,
        cw721Token: this.utilsService.parseTokenDBToResponse(asset.cw721Token),
      })),
    };
  }
}
