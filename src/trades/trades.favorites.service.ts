import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Network } from "../utils/blockchain/dto/network.dto";
import { Repository } from "typeorm";
import { Trade, TradeFavorite } from "./entities/trade.entity";
const pMap = require("p-map");
const _ = require("lodash");

@Injectable()
export class TradeFavoritesService {
  constructor(
    @InjectRepository(Trade) private tradesRepository: Repository<Trade>,
    @InjectRepository(TradeFavorite)
    private favoriteRepository: Repository<TradeFavorite>,
  ) {}
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
    currentFavorite.trades = _.uniqBy(
      currentFavorite.trades.concat(trades),
      (trade: Trade) => trade.id,
    );

    // We save to the database
    await this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
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
    await this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
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
    await this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
  }
}
