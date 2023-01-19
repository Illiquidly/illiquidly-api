import { Injectable, NotFoundException } from "@nestjs/common";
import { asyncAction } from "../utils/js/asyncAction";
import { CounterTradeResponse, TradeResponse, TradeInfoResponse } from "./dto/getTrades.dto";
import { Network } from "../utils/blockchain/dto/network.dto";
import { UtilsService } from "../utils-api/utils.service";
import { QueryLimitService } from "../utils/queryLimit.service";
import { BlockchainTradeQuery } from "../utils/blockchain/p2pTradeQuery";
import { BlockchainNFTQuery } from "../utils/blockchain/nft_query";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BlockChainTradeInfo } from "../utils/blockchain/dto/trade-info.dto";
import { CounterTrade, Trade, TradeInfoORM } from "./entities/trade.entity";
import { CW721Collection, ValuedCoin, ValuedCW20Coin } from "../utils-api/entities/nft-info.entity";
import { formatNiceLuna } from "../utils/js/parseCoin";
import {
  Asset,
  AssetResponse,
  Coin,
  CW20Coin,
  CW721Coin,
  RawCoin,
  TokenResponse,
} from "../utils-api/dto/nft.dto";
const pMap = require("p-map");

@Injectable()
export class TradesService {
  tradeQuery: BlockchainTradeQuery;
  nftQuery: BlockchainNFTQuery;
  constructor(
    @InjectRepository(Trade) private tradesRepository: Repository<Trade>,
    @InjectRepository(CounterTrade) private counterTradesRepository: Repository<CounterTrade>,
    @InjectRepository(TradeInfoORM) private tradeInfoRepository: Repository<TradeInfoORM>,
    @InjectRepository(CW721Collection) private collectionRepository: Repository<CW721Collection>,
    private readonly utilsService: UtilsService,
    private readonly queryLimitService: QueryLimitService,
  ) {
    this.tradeQuery = new BlockchainTradeQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );

    this.nftQuery = new BlockchainNFTQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );
  }

  private async queryDistantTradeAndParseForDB(network: Network, tradeId: number): Promise<Trade> {
    // We try to query the trade on_chain directly :
    const [queryErr, distantTradeInfo]: [any, BlockChainTradeInfo] = await asyncAction(
      this.tradeQuery.getTradeInfo(network, tradeId),
    );
    if (queryErr) {
      throw new NotFoundException("Trade Not Found");
    }
    // We parse the new queried object for the database

    return {
      id: null,
      network,
      tradeId,
      tradeInfo: await this.mapDistantTradeToDB(network, distantTradeInfo),
      nftsWanted: await Promise.all(
        distantTradeInfo.additionalInfo.nftsWanted.map(
          async (collectionAddress): Promise<CW721Collection> => {
            // First we see if the collection exists in the contract
            const [err, collection] = await asyncAction(
              this.collectionRepository.findOneBy({ collectionAddress, network }),
            );
            if (!err && collection) {
              return collection;
            }
            const newCollection = await this.nftQuery.newCW721Contract(network, collectionAddress);
            await this.collectionRepository.save([newCollection]);
            return newCollection;
          },
        ),
      ),
      counterTrades: undefined,
      tradeFavorites: undefined,
    };
  }

  private async queryDistantCounterTradeAndParseForDB(
    network: Network,
    tradeId: number,
    counterTradeId: number,
  ): Promise<CounterTrade> {
    // We try to query the counter_trade on_chain directly :
    const [queryErr, distantCounterTradeInfo] = await asyncAction(
      this.tradeQuery.getCounterTradeInfo(network, tradeId, counterTradeId),
    );
    if (queryErr) {
      throw new NotFoundException("Counter Trade Not Found");
    }

    // We save the new queried trade Info To the database
    return {
      id: null,
      network,
      counterTradeId,
      tradeInfo: await this.mapDistantTradeToDB(network, distantCounterTradeInfo),
      trade: null,
    };
  }

  // When updating a trade directly from the Blockchain, you want to update their tradeInfo only
  async updateTrade(network: Network, tradeId: number) {
    const [, tradeInfo]: [any, Trade] = await asyncAction(
      this.tradesRepository.findOne({
        relations: { tradeInfo: true, counterTrades: true },
        where: { tradeId, network },
      }),
    );

    // We query the brand new on-chain info
    const tradeDBObject = await this.queryDistantTradeAndParseForDB(network, tradeId);
    // We assign the old id to the new object, to save it in place
    tradeDBObject.id = tradeInfo?.id;
    tradeDBObject.counterTrades = tradeInfo?.counterTrades ?? [];

    // We try to update the trade. If the trade already exists, we don't care
    // This is a workaround, because we don't have functionnal lock
    await asyncAction(this.tradesRepository.save(tradeDBObject));

    // We delete the old tradeInfo, or it cloggs the memory for nothing
    if (tradeInfo?.tradeInfo) {
      await this.tradeInfoRepository.remove(tradeInfo?.tradeInfo);
    }
    return tradeDBObject;
  }

  async updateTradeAndCounterTrades(network: Network, tradeId: number) {
    // We start by updating the trade.
    const tradeInfo = await this.updateTrade(network, tradeId);

    // Then we update every counterTrade associated with the trade in the database
    await pMap(tradeInfo.counterTrades, async (counterTrade: CounterTrade) =>
      asyncAction(this.updateCounterTrade(network, tradeId, counterTrade.counterTradeId)),
    );
  }

  async updateCounterTrade(
    network: Network,
    tradeId: number,
    counterTradeId: number,
  ): Promise<CounterTrade> {
    const [, counterTradeInfo] = await asyncAction(
      this.counterTradesRepository.findOne({
        relations: { tradeInfo: true, trade: true },
        where: { network, trade: { tradeId }, counterTradeId },
      }),
    );

    const counterTradeDBObject: CounterTrade = await this.queryDistantCounterTradeAndParseForDB(
      network,
      tradeId,
      counterTradeId,
    );

    // We assign the old id to the new object, to save it in place
    counterTradeDBObject.id = counterTradeInfo?.id;
    counterTradeDBObject.trade = counterTradeInfo?.trade;

    // We try to get the associated trade if it exists in the database
    if (!counterTradeDBObject?.trade) {
      // We query the database to look for the corresponding trade
      const [, tradeInfo] = await asyncAction(
        this.tradesRepository.findOneBy({ network, tradeId }),
      );
      if (tradeInfo) {
        // If it was already registered, we can simply save it
        counterTradeDBObject.trade = tradeInfo;
      } else {
        // If it was not in the database, we have to look else-where
        counterTradeDBObject.trade = await this.updateTrade(network, tradeId);
      }
    }
    await this.counterTradesRepository.save(counterTradeDBObject);
    return counterTradeDBObject;
  }

  async getTradeById(network: Network, tradeId: number): Promise<TradeResponse> {
    const tradeDBObject = await this.updateTrade(network, tradeId);
    return await this.parseTradeDBToResponse(network, tradeDBObject);
  }

  async getCounterTradeById(
    network: Network,
    tradeId: number,
    counterTradeId: number,
  ): Promise<CounterTradeResponse> {
    const counterTradeDBObject = await this.updateCounterTrade(network, tradeId, counterTradeId);
    // Now we return the database response
    return await this.parseCounterTradeDBToResponse(network, counterTradeDBObject);
  }

  async mapDistantTradeToDB(
    network: Network,
    tradeInfo: BlockChainTradeInfo,
    tradeInfoORM: TradeInfoORM = new TradeInfoORM(),
  ): Promise<TradeInfoORM> {
    // First we get the objects corresponding to the NFTs Wanted :

    tradeInfoORM.owner = tradeInfo.owner;
    tradeInfoORM.time = new Date(parseInt(tradeInfo.additionalInfo.time) / 1000000);
    tradeInfoORM.lastCounterId = tradeInfo.lastCounterId;
    tradeInfoORM.ownerComment = tradeInfo.additionalInfo.ownerComment?.comment;
    tradeInfoORM.ownerCommentTime = tradeInfo.additionalInfo.ownerComment?.time
      ? new Date(parseInt(tradeInfo.additionalInfo.ownerComment?.time) / 1000000)
      : null;
    (tradeInfoORM.traderComment = tradeInfo.additionalInfo.traderComment?.comment),
      (tradeInfoORM.traderCommentTime = tradeInfo.additionalInfo.traderComment?.time
        ? new Date(parseInt(tradeInfo.additionalInfo.traderComment?.time) / 1000000)
        : null);
    tradeInfoORM.state = tradeInfo.state;
    tradeInfoORM.acceptedCounterTradeId = tradeInfo.acceptedInfo?.counterId;
    tradeInfoORM.assetsWithdrawn = tradeInfo.assetsWithdrawn;
    // Difficult fields
    tradeInfoORM.coinAssets = tradeInfo.associatedAssets
      .filter((asset: Asset) => !!asset.coin)
      .map((asset: Coin) => {
        const coin = new ValuedCoin();
        coin.id = null;
        coin.amount = asset.coin.amount;
        coin.denom = asset.coin.denom;
        coin.network = network;
        return coin;
      });
    tradeInfoORM.cw20Assets = await pMap(
      tradeInfo.associatedAssets.filter((asset: Asset) => !!asset.cw20Coin),
      async (asset: CW20Coin) => {
        const coin = new ValuedCW20Coin();
        coin.id = null;
        coin.amount = asset.cw20Coin.amount;
        coin.cw20Coin = await this.utilsService.CW20CoinInfo(network, asset.cw20Coin.address);
        return coin;
      },
    );
    tradeInfoORM.cw721Assets = await pMap(
      tradeInfo.associatedAssets.filter((asset: Asset) => !!asset.cw721Coin),
      async (asset: CW721Coin) => {
        const token = await this.utilsService.nftTokenInfoFromDB(
          network,
          asset.cw721Coin.address,
          asset.cw721Coin.tokenId,
        );
        return token;
      },
    );
    tradeInfoORM.cw1155Assets = JSON.stringify(
      tradeInfo.associatedAssets.filter((asset: Asset) => asset.cw1155Coin),
    );

    tradeInfoORM.whitelistedUsers = JSON.stringify(tradeInfo.whitelistedUsers);
    tradeInfoORM.tokensWanted = JSON.stringify(tradeInfo.additionalInfo.tokensWanted);
    tradeInfoORM.tradePreview = JSON.stringify(tradeInfo.additionalInfo.tradePreview);
    return tradeInfoORM;
  }

  async parseTradeDBToResponse(network: Network, trade: Trade): Promise<TradeResponse> {
    const tradeInfo: TradeInfoResponse = await this.parseTradeDBToResponseInfo(
      network,
      trade.tradeInfo,
    );
    const nftsWanted = trade?.nftsWanted?.map(nft => {
      nft.tokens = undefined;
      return nft;
    });
    tradeInfo.additionalInfo.nftsWanted = nftsWanted;
    tradeInfo.additionalInfo.lookingFor = (tradeInfo.additionalInfo.tokensWanted ?? []).map(
      (token): RawCoin => {
        if (token.coin) {
          if (token.coin.denom == "uluna") {
            return formatNiceLuna(token.coin.amount);
          }
          return {
            currency: token.coin.denom,
            amount: token.coin.amount,
          };
        } else {
          return {
            currency: token.cw20Coin.address,
            amount: token.cw20Coin.amount,
          };
        }
      },
    );
    tradeInfo.additionalInfo.lookingFor = tradeInfo.additionalInfo.lookingFor.concat(nftsWanted);

    // We parse the tradeInfo :
    return {
      network,
      tradeId: trade.tradeId,
      id: trade.id,
      counterTrades: trade.counterTrades,
      tradeInfo: tradeInfo,
    };
  }

  async parseCounterTradeDBToResponse(
    network: Network,
    counterTrade: CounterTrade,
  ): Promise<CounterTradeResponse> {
    const tradeInfo: TradeInfoResponse = await this.parseTradeDBToResponseInfo(
      network,
      counterTrade.tradeInfo,
    );

    return {
      network,
      counterId: counterTrade.counterTradeId,
      id: counterTrade.id,
      trade: counterTrade.trade,
      tradeInfo,
    };
  }

  // Allows to parse a token preview (address, token_id) object to it's metadata
  async parseTokenPreview(
    network: Network,
    preview: string,
  ): Promise<{ cw721Coin: TokenResponse }> {
    let parsedPreview = JSON.parse(preview);

    // And now we add the metadata do the same for the preview NFT
    if (parsedPreview?.cw721Coin) {
      parsedPreview = await this.addCW721Info(network, parsedPreview);
    }
    return parsedPreview;
  }

  private async parseTradeDBToResponseInfo(
    network: Network,
    tradeInfo: TradeInfoORM,
  ): Promise<TradeInfoResponse> {
    // We fetch metadata for the associated assets :
    let associatedAssets: AssetResponse[] = (tradeInfo.coinAssets ?? []).map((coin: ValuedCoin) => {
      if (coin.denom != "uluna") {
        return {
          coin,
        };
      }
      const asset = formatNiceLuna(coin.amount);
      coin.amount = asset.amount;
      return {
        coin,
      };
    });
    associatedAssets = associatedAssets.concat(
      tradeInfo.cw20Assets ??
        [].map(cw20Coin => {
          return {
            cw20Coin,
          };
        }),
    );
    associatedAssets = associatedAssets.concat(pMap(
      tradeInfo.cw721Assets ?? [], async (asset) => {
        return {
          cw721Coin: await this.utilsService.parseTokenDBToResponse(asset),
        };
      }),
    );
    associatedAssets = associatedAssets.concat(JSON.parse(tradeInfo.cw1155Assets) ?? []);
    // We don't want all the collections NFTs here, that's a bit heavy
    const tokensWanted = JSON.parse(tradeInfo.tokensWanted);
    const tradePreview = await this.parseTokenPreview(network, tradeInfo.tradePreview);

    return {
      acceptedInfo: {
        counterId: tradeInfo.acceptedCounterTradeId,
      },
      assetsWithdrawn: tradeInfo.assetsWithdrawn,
      lastCounterId: tradeInfo.lastCounterId,
      associatedAssets,
      additionalInfo: {
        ownerComment: {
          comment: tradeInfo.ownerComment,
          time: tradeInfo?.ownerCommentTime?.toISOString(),
        },
        time: tradeInfo?.time?.toISOString(),
        tokensWanted,
        tradePreview,
        traderComment: {
          comment: tradeInfo.traderComment,
          time: tradeInfo?.traderCommentTime?.toISOString(),
        },
      },
      owner: tradeInfo.owner,
      state: tradeInfo.state,
      whitelistedUsers: JSON.parse(tradeInfo.whitelistedUsers),
    };
  }

  // We get the collection name

  async addCW721Info(network: Network, asset): Promise<{ cw721Coin: TokenResponse }> {
    const address = asset.cw721Coin.address;
    const tokenId = asset.cw721Coin.tokenId;

    const tokenInfo = await this.utilsService.nftTokenInfo(network, address, tokenId);
    return {
      cw721Coin: {
        ...tokenInfo,
      },
    };
  }
}
