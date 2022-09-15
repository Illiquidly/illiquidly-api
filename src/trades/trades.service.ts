import { Injectable, NotFoundException } from "@nestjs/common";
import { getCounterTradeInfo, getTradeInfo } from "../utils/blockchain/p2pTradeQuery";
import { asyncAction } from "../utils/js/asyncAction";
import {
  Coin,
  Collection,
  MultipleTradeResponse,
  QueryParameters,
  Trade,
  TradeInfo,
} from "./dto/getTrades.dto";
import { TradeDatabaseService } from "../database/trades/access";
import { Network } from "../utils/blockchain/dto/network.dto";
import { UtilsService } from "../utils-api/utils.service";
import { RawTokenInteracted } from "../nft-content/dto/get-nft-content.dto";
import { fromIPFSImageURLtoImageURL } from "../utils/blockchain/ipfs";
const camelCaseObjectDeep = require("camelcase-object-deep");
const pMap = require("p-map");

@Injectable()
export class TradesService {
  constructor(
    private readonly tradeDatabaseService: TradeDatabaseService,
    private readonly utilsService: UtilsService,
  ) {}

  async getMultipleTrades(params: QueryParameters): Promise<MultipleTradeResponse> {
    const [err, tradeInfo] = await asyncAction(this.tradeDatabaseService.getTrades(params));
    if (err || !tradeInfo.length) {
      console.log(err);
      throw new NotFoundException("Trades Not Found");
    }
    const offset = params?.["pagination.offset"];

    const [nbErr, tradeNumber] = await asyncAction(
      this.tradeDatabaseService.getTradeNumber(params),
    );

    if (nbErr) {
      console.log(nbErr);
      throw new NotFoundException("Error getting total number of Trades");
    }

    return {
      data: tradeInfo,
      nextOffset: offset ?? 0 + tradeInfo.length,
      totalNumber: tradeNumber,
    };
  }

  async getMultipleCounterTrades(params: QueryParameters): Promise<MultipleTradeResponse> {
    const [err, tradeInfo] = await asyncAction(this.tradeDatabaseService.getCounterTrades(params));
    if (err || !tradeInfo.length) {
      throw new NotFoundException("Counter Trades Not Found");
    }
    return tradeInfo;
  }

  async getSingleTrade(network: Network, tradeId: number): Promise<Trade> {
    const [, tradeInfo] = await asyncAction(this.tradeDatabaseService.getTrade(network, tradeId));

    if (tradeInfo) {
      tradeInfo.tradeInfo = await this.addInfoToTradeInfo(tradeInfo.tradeInfo);
      return tradeInfo;
    }

    // We try to query the trade on_chain directly :
    const [queryErr, distantTradeInfo] = await asyncAction(getTradeInfo(network, tradeId));
    if (queryErr) {
      throw new NotFoundException("Trade Not Found");
    }

    const newTradeInfo = {
      network,
      tradeId,
      counterId: undefined,
      tradeInfo: camelCaseObjectDeep(await this.addInfoToTradeInfo(distantTradeInfo)),
    };
    // We add it to the database
    await this.tradeDatabaseService.addToTradeDB([newTradeInfo]);
    return newTradeInfo;
  }

  async getSingleCounterTrade(
    network: Network,
    tradeId: number,
    counterId: number,
  ): Promise<Trade> {
    const [, counterTradeInfo] = await asyncAction(
      this.tradeDatabaseService.getCounterTrade(network, tradeId, counterId),
    );

    if (counterTradeInfo) {
      return counterTradeInfo;
    }
    // We try to query the counter_trade on_chain directly :
    const [queryErr, distantCounterTradeInfo] = await asyncAction(
      getCounterTradeInfo(network, tradeId, counterId),
    );
    if (queryErr) {
      throw new NotFoundException("Counter Trade Not Found");
    }

    const newCounterTradeInfo = {
      network,
      tradeId,
      counterId,
      tradeInfo: camelCaseObjectDeep(distantCounterTradeInfo),
    };
    // We add it to the database
    await this.tradeDatabaseService.addToCounterTradeDB([newCounterTradeInfo]);

    return newCounterTradeInfo;
  }

  async addInfoToTradeInfo(tradeInfo: TradeInfo): Promise<TradeInfo> {
    // We modify the tradeInfo lookingFor info. It merges nfts_wanted and tokens_wanted
    tradeInfo.additionalInfo.lookingFor = (tradeInfo.additionalInfo.tokensWanted ?? [])
      .map((token): Coin => {
        if (token.coin) {
          return {
            currency: token.coin.denom,
            amount: token.coin.amount,
          };
        } else {
          return {
            currency: token.cw20_coin.address,
            amount: token.cw20_coin.amount,
          };
        }
      })
      .concat(
        await pMap(
          tradeInfo.additionalInfo.nftsWanted ?? [],
          async (nft: string): Promise<Collection> =>
            // We get the collection name
            await this.utilsService.getCachedNFTContractInfo(tradeInfo.network, nft),
        ),
      );
    // We fetch metadata for the associated assets :
    tradeInfo.associatedAssets = await pMap(tradeInfo.associatedAssets, async asset => {
      if (asset.cw721Coin) {
        return await this.addCW721Info(tradeInfo, asset);
      } else {
        return asset;
      }
    });

    // We now do the same for the preview NFT
    if (tradeInfo?.additionalInfo?.tradePreview?.cw721Coin) {
      tradeInfo.additionalInfo.tradePreview = await this.addCW721Info(
        tradeInfo,
        tradeInfo.additionalInfo.tradePreview,
      );
    }

    return tradeInfo;
  }

  async addCW721Info(tradeInfo: TradeInfo, asset) {
    const address = asset.cw721Coin.address;
    const tokenId = asset.cw721Coin.tokenId;

    const collectionInfo = await this.utilsService.getCachedNFTContractInfo(
      tradeInfo.network,
      address,
    );
    const tokenInfo = await this.utilsService.nftInfo(tradeInfo.network, address, tokenId);

    console.log(tokenInfo);
    const returnToken: RawTokenInteracted = {
      tokenId,
      imageUrl: fromIPFSImageURLtoImageURL(tokenInfo?.extension?.image),
      name: tokenInfo?.extension?.name,
      attributes: tokenInfo?.extension?.attributes,
      description: tokenInfo?.extension?.description,
      traits: (tokenInfo?.extension?.attributes ?? []).map(
        ({ traitType, value }: { traitType: string; value: string }) => [traitType, value],
      ),
    };

    return {
      cw721Coin: {
        ...collectionInfo,
        ...returnToken,
      },
    };
  }
}
