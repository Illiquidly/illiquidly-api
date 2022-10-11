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
import {
  CounterTrade,
  Trade,
  TradeFavorite,
  TradeInfoORM,
  TradeNotification,
  TradeNotificationStatus,
} from "./entities/trade.entity";
import { CW721Collection, ValuedCoin, ValuedCW20Coin } from "../utils-api/entities/nft-info.entity";
import { formatNiceLuna } from "../utils/js/parseCoin";
import { Asset, AssetResponse, Coin, CW20Coin, CW721Coin, RawCoin } from "../utils-api/dto/nft.dto";
const pMap = require("p-map");
const _  = require("lodash")

@Injectable()
export class TradesService {
  tradeQuery: BlockchainTradeQuery;
  nftQuery: BlockchainNFTQuery;
  constructor(
    @InjectRepository(Trade) private tradesRepository: Repository<Trade>,
    @InjectRepository(CounterTrade) private counterTradesRepository: Repository<CounterTrade>,
    @InjectRepository(CW721Collection) private collectionRepository: Repository<CW721Collection>,
    @InjectRepository(TradeNotification)
    private notificationRepository: Repository<TradeNotification>,
    @InjectRepository(TradeFavorite)
    private favoriteRepository: Repository<TradeFavorite>,
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
      counterTrades: [],
    };
  }

  async updateTradeAndCounterTrades(network: Network, tradeId: number) {
    const [, tradeInfo]: [any, Trade] = await asyncAction(
      this.tradesRepository.findOneBy({ tradeId, network }),
    );

    const tradeDBObject = await this.queryDistantTradeAndParseForDB(network, tradeId);
    // We save asyncronously to the database
    if (tradeInfo) {
      tradeDBObject.id = tradeInfo.id;
      tradeDBObject.counterTrades = tradeInfo.counterTrades;
    }
    await this.tradesRepository.save([tradeDBObject]);

    // Then we update every counterTrade associated with the trade in the database
    await pMap(tradeDBObject.counterTrades ?? [], async (counterTrade: CounterTrade) => {
      // We try to query the counter_trade on_chain directly :
      const [queryErr, distantCounterTradeInfo] = await asyncAction(
        this.tradeQuery.getCounterTradeInfo(network, tradeId, counterTrade.counterTradeId),
      );
      if (queryErr) {
        return;
      }

      // We save the new queried trade Info To the database
      counterTrade.tradeInfo = await this.mapDistantTradeToDB(network, distantCounterTradeInfo);

      // We save asyncronously to the database
      await this.counterTradesRepository.save([counterTrade]);
    });
  }

  async getTradeById(network: Network, tradeId: number): Promise<TradeResponse> {
    const [, tradeInfo]: [any, Trade] = await asyncAction(
      this.tradesRepository.findOneBy({ tradeId, network }),
    );
    const tradeDBObject = await this.queryDistantTradeAndParseForDB(network, tradeId);

    // We save asyncronously to the database
    if (tradeInfo) {
      tradeDBObject.id = tradeInfo.id;
      tradeDBObject.counterTrades = tradeInfo.counterTrades;
    }

    await this.tradesRepository.save([tradeDBObject]);
    // Now we return the database response
    return await this.parseTradeDBToResponse(network, tradeDBObject);
  }

  async getCounterTradeById(
    network: Network,
    tradeId: number,
    counterTradeId: number,
  ): Promise<CounterTradeResponse> {
    const [, counterTradeInfo] = await asyncAction(
      this.counterTradesRepository.findOneBy({ network, trade: { tradeId }, counterTradeId }),
    );

    // We try to query the counter_trade on_chain directly :
    const [queryErr, distantCounterTradeInfo] = await asyncAction(
      this.tradeQuery.getCounterTradeInfo(network, tradeId, counterTradeId),
    );
    if (queryErr) {
      throw new NotFoundException("Counter Trade Not Found");
    }

    // We save the new queried trade Info To the database
    const counterTradeDBObject: CounterTrade = {
      id: counterTradeInfo?.id,
      network,
      counterTradeId,
      tradeInfo: await this.mapDistantTradeToDB(network, distantCounterTradeInfo),
      trade: counterTradeInfo?.trade,
    };
    // If it's the first time we save this counter Trade, we need to link it to its Trade
    if (!counterTradeInfo?.trade) {
      // We query the database to look for the corresponding trade
      const [, tradeInfo] = await asyncAction(
        this.tradesRepository.findOneBy({ network, tradeId }),
      );
      if (tradeInfo) {
        // If it was already registered, we can simply save it
        counterTradeDBObject.trade = tradeInfo;
      } else {
        // If it was not in the database, we have to look else-where
        const tradeInfo = await this.queryDistantTradeAndParseForDB(network, tradeId);
        await this.tradesRepository.save([tradeInfo]);
        counterTradeDBObject.trade = tradeInfo;
      }
    }

    // We save asyncronously to the database
    await this.counterTradesRepository.save([counterTradeDBObject]);

    // Now we return the database response
    return await this.parseCounterTradeDBToResponse(network, counterTradeDBObject);
  }

  async mapDistantTradeToDB(
    network: Network,
    tradeInfo: BlockChainTradeInfo,
  ): Promise<TradeInfoORM> {
    // First we get the objects corresponding to the NFTs Wanted :

    return {
      id: null,
      owner: tradeInfo.owner,
      time: new Date(parseInt(tradeInfo.additionalInfo.time) / 1000000),
      lastCounterId: tradeInfo.lastCounterId,
      ownerComment: tradeInfo.additionalInfo.ownerComment?.comment,
      ownerCommentTime: tradeInfo.additionalInfo.ownerComment?.time
        ? new Date(parseInt(tradeInfo.additionalInfo.ownerComment?.time) / 1000000)
        : null,
      traderComment: tradeInfo.additionalInfo.traderComment?.comment,
      traderCommentTime: tradeInfo.additionalInfo.traderComment?.time
        ? new Date(parseInt(tradeInfo.additionalInfo.traderComment?.time) / 1000000)
        : null,
      state: tradeInfo.state,
      acceptedCounterTradeId: tradeInfo.acceptedInfo?.counterId,
      assetsWithdrawn: tradeInfo.assetsWithdrawn,
      // Difficult fields
      coinAssets: tradeInfo.associatedAssets
        .filter((asset: Asset) => !!asset.coin)
        .map((asset: Coin) => {
          const coin = new ValuedCoin();
          coin.id = null;
          coin.amount = asset.coin.amount;
          coin.denom = asset.coin.denom;
          coin.network = network;
          return coin;
        }),
      cw20Assets: await pMap(
        tradeInfo.associatedAssets.filter((asset: Asset) => !!asset.cw20Coin),
        async (asset: CW20Coin) => {
          const coin = new ValuedCW20Coin();
          coin.id = null;
          coin.amount = asset.cw20Coin.amount;
          coin.cw20Coin = await this.utilsService.CW20CoinInfo(network, asset.cw20Coin.address);
          return coin;
        },
      ),
      cw721Assets: await pMap(
        tradeInfo.associatedAssets.filter((asset: Asset) => !!asset.cw721Coin),
        async (asset: CW721Coin) => {
          const token = await this.utilsService.nftTokenInfoFromDB(
            network,
            asset.cw721Coin.address,
            asset.cw721Coin.tokenId,
          );
          return token;
        },
      ),
      cw1155Assets: JSON.stringify(
        tradeInfo.associatedAssets.filter((asset: Asset) => asset.cw1155Coin),
      ),

      whitelistedUsers: JSON.stringify(tradeInfo.whitelistedUsers),
      tokensWanted: JSON.stringify(tradeInfo.additionalInfo.tokensWanted),
      tradePreview: JSON.stringify(tradeInfo.additionalInfo.tradePreview),
    };
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

  private async parseTradeDBToResponseInfo(
    // T should extend TradeInfoORM and contain an nftsWanted field
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
    associatedAssets = associatedAssets.concat(
      (tradeInfo.cw721Assets ?? []).map(asset => {
        return {
          cw721Coin: this.utilsService.parseTokenDBToResponse(asset),
        };
      }),
    );
    associatedAssets = associatedAssets.concat(JSON.parse(tradeInfo.cw1155Assets) ?? []);
    // We don't want all the collections NFTs here, that's a bit heavy
    const tokensWanted = JSON.parse(tradeInfo.tokensWanted);
    let tradePreview = JSON.parse(tradeInfo.tradePreview);

    // And now we add the metadata do the same for the preview NFT
    if (tradePreview?.cw721Coin) {
      tradePreview = await this.addCW721Info(network, tradePreview);
    }

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

  async addCW721Info(network: Network, asset) {
    const address = asset.cw721Coin.address;
    const tokenId = asset.cw721Coin.tokenId;

    const tokenInfo = await this.utilsService.nftTokenInfo(network, address, tokenId);

    return {
      cw721Coin: {
        ...tokenInfo,
      },
    };
  }

  async readNotifications(network: Network, user: string) {
    await this.notificationRepository
      .createQueryBuilder()
      .update(TradeNotification)
      .set({ status: TradeNotificationStatus.read })
      .where("network = :network", { network })
      .andWhere("user = :user", { user })
      .execute();
  }

  async addFavoriteTrade(network: Network, user: string, tradeId: number[]) {
    let currentFavorite: TradeFavorite = await this.favoriteRepository.findOne({
      relations: {
        trades: true,
      },
      where: {
        network,
        user,
      },
    });

    if (!currentFavorite) {
      currentFavorite = {
        id: null,
        network,
        user,
        trades: [],
      };
    }
    // We query the trade informations
    const trades = await pMap(tradeId, async tradeId =>
      this.tradesRepository.findOneBy({ network, tradeId }),
    );
    console.log(_)
    currentFavorite.trades = _.uniqBy(currentFavorite.trades.concat(trades), (trade: Trade) => trade.id);

    // We save to the database
    this.favoriteRepository.save(currentFavorite);
    return currentFavorite
  }

  async setFavoriteTrade(network: Network, user: string, tradeId: number[]) {
    let currentFavorite: TradeFavorite = await this.favoriteRepository.findOne({
      relations: {
        trades: true,
      },
      where: {
        network,
        user,
      },
    });

    if (!currentFavorite) {
      currentFavorite = {
        id: null,
        network,
        user,
        trades: [],
      };
    }
    // We query the trade informations
    currentFavorite.trades = await pMap(_.uniq(tradeId), async tradeId =>
      this.tradesRepository.findOneBy({ network, tradeId }),
    );

    // We save to the database
    this.favoriteRepository.save(currentFavorite);
    return currentFavorite
  }

  async removeFavoriteTrade(network: Network, user: string, tradeId: number[]) {
    const currentFavorite: TradeFavorite = await this.favoriteRepository.findOne({
      relations: {
        trades: true,
      },
      where: {
        network,
        user,
      },
    });

    if (!currentFavorite) {
      return;
    }

    // We update the trades
    currentFavorite.trades = currentFavorite.trades.filter(
      trade => !tradeId.includes(trade.tradeId),
    );
    this.favoriteRepository.save(currentFavorite);
    return currentFavorite
  }
}
