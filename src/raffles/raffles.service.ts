import { Injectable, NotFoundException } from "@nestjs/common";
import { asyncAction } from "../utils/js/asyncAction";
import { Network } from "../utils/blockchain/dto/network.dto";
import { UtilsService } from "../utils-api/utils.service";
import { QueryLimitService } from "../utils/queryLimit.service";
import { BlockchainRaffleQuery } from "../utils/blockchain/raffleQuery";
import { BlockchainNFTQuery } from "../utils/blockchain/nft_query";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BlockChainTradeInfo } from "../utils/blockchain/dto/trade-info.dto";
import {
  Raffle,
  RaffleFavorite,
  RaffleNotification,
  NotificationStatus,
  Participant,
} from "./entities/raffle.entity";
import { CW721Collection, ValuedCoin, ValuedCW20Coin } from "../utils-api/entities/nft-info.entity";
import { formatNiceLuna } from "../utils/js/parseCoin";
import { Asset, AssetResponse, Coin, CW20Coin, CW721Coin, RawCoin } from "../utils-api/dto/nft.dto";
import {
  BlockChainRaffleInfo,
  BlockChainRaffleResponse,
} from "src/utils/blockchain/dto/raffle-info.dto";
import { RaffleInfoResponse, RaffleResponse, TicketPrice } from "./dto/getRaffles.dto";
const pMap = require("p-map");
const _ = require("lodash");

@Injectable()
export class RafflesService {
  raffleQuery: BlockchainRaffleQuery;
  nftQuery: BlockchainNFTQuery;
  constructor(
    @InjectRepository(Raffle) private rafflesRepository: Repository<Raffle>,
    @InjectRepository(RaffleNotification)
    private notificationRepository: Repository<RaffleNotification>,
    @InjectRepository(RaffleFavorite)
    private favoriteRepository: Repository<RaffleFavorite>,
    private readonly utilsService: UtilsService,
    private readonly queryLimitService: QueryLimitService,
  ) {
    this.raffleQuery = new BlockchainRaffleQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );

    this.nftQuery = new BlockchainNFTQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );
  }

  private async queryDistantRaffleAndParseForDB(
    network: Network,
    raffleId: number,
  ): Promise<Raffle> {
    // We try to query the raffle on_chain directly :
    const [queryErr, distantRaffleInfo]: [any, BlockChainRaffleResponse] = await asyncAction(
      this.raffleQuery.getRaffleInfo(network, raffleId),
    );
    if (queryErr) {
      throw new NotFoundException("Raffle Not Found");
    }
    // We parse the new queried object for the database

    return this.mapDistantRaffleToDB(network, distantRaffleInfo);
  }

  async updateRaffleAndParticipants(network: Network, raffleId: number): Promise<Raffle> {
    const [, raffleInfo]: [any, Raffle] = await asyncAction(
      this.rafflesRepository.findOne({
        relations: {
          participants: true,
        },
        where: { raffleId, network },
      }),
    );
    const raffleDBObject = await this.queryDistantRaffleAndParseForDB(network, raffleId);
    // We save  to the database
    if (raffleInfo) {
      raffleDBObject.id = raffleInfo?.id;
      raffleDBObject.participants = raffleInfo?.participants ?? [];
    }

    await this.addRaffleParticipantsToDB(network, raffleDBObject);
    await this.rafflesRepository.save([raffleDBObject]);

    // Then we update the participants of the raffle
    return raffleDBObject;
  }

  async getRaffleById(network: Network, raffleId: number): Promise<RaffleResponse> {
    const raffleDBObject = await this.updateRaffleAndParticipants(network, raffleId);
    return await this.parseRaffleDBToResponse(network, raffleDBObject);
  }

  async addRaffleParticipantsToDB(network, raffle: Raffle) {
    raffle.participants = raffle.participants ? raffle.participants : [];
    const nbRegisteredParticipants = _.sumBy(
      raffle.participants,
      (participant: Participant) => participant.ticketNumber,
    );
    const participants = await this.raffleQuery.getAllParticipants(
      network,
      raffle.raffleId,
      nbRegisteredParticipants ? nbRegisteredParticipants - 1 : null,
    );
    // First we count the number of participant occurence :
    const participantCounts = _.countBy(participants);

    (Object.entries(participantCounts) ?? []).forEach(([key, value]: [string, number]) => {
      //1. We search if the participant already exists in the currentParticipants array
      const existingParticipantObject: Participant[] = (raffle.participants ?? []).filter(
        (participant: Participant) => participant.user == key,
      );
      // 2. If it exists we update the number of tickets
      // ANd we update the timestamp at which the object was last updated
      if (existingParticipantObject.length != 0) {
        existingParticipantObject[0].ticketNumber += value;
        existingParticipantObject[0].updatedAt = new Date(Date.now());
      }
      //3. If it doesn't exists, we create a new
      else {
        const p = new Participant();
        p.user = key;
        p.ticketNumber = value;
        p.updatedAt = new Date(Date.now());
        raffle.participants.push(p);
      }
      return null;
    });
  }

  async mapDistantRaffleToDB(
    network: Network,
    raffleInfo: BlockChainRaffleResponse,
  ): Promise<Raffle> {
    let [cw20TicketPrice, coinTicketPrice] = [null, null];

    if (raffleInfo.raffleInfo.raffleTicketPrice.cw20Coin) {
      cw20TicketPrice = new ValuedCW20Coin();
      cw20TicketPrice.amount = raffleInfo.raffleInfo.raffleTicketPrice.cw20Coin.amount;
      cw20TicketPrice.cw20Coin = await this.utilsService.CW20CoinInfo(
        network,
        raffleInfo.raffleInfo.raffleTicketPrice.cw20Coin.address,
      );
    }

    if (raffleInfo.raffleInfo.raffleTicketPrice.coin) {
      coinTicketPrice = new ValuedCoin();
      coinTicketPrice.id = null;
      coinTicketPrice.amount = raffleInfo.raffleInfo.raffleTicketPrice.coin.amount;
      coinTicketPrice.denom = raffleInfo.raffleInfo.raffleTicketPrice.coin.denom;
      coinTicketPrice.network = network;
    }
    return {
      id: null,
      network,
      raffleId: raffleInfo.raffleId,
      owner: raffleInfo.raffleInfo.owner,
      state: raffleInfo.raffleState,
      cw721Assets: await pMap(
        raffleInfo.raffleInfo.assets.filter((asset: Asset) => !!asset.cw721Coin),
        async (asset: CW721Coin) => {
          const token = await this.utilsService.nftTokenInfoFromDB(
            network,
            asset.cw721Coin.address,
            asset.cw721Coin.tokenId,
          );
          return token;
        },
      ),
      cw1155Assets: raffleInfo.raffleInfo.assets.filter((asset: Asset) => asset.cw1155Coin),
      cw20TicketPrice,
      coinTicketPrice,
      numberOfTickets: raffleInfo.raffleInfo.numberOfTickets,
      winner: raffleInfo.raffleInfo.winner,
      randomnessOwner: raffleInfo.raffleInfo.randomness?.randomnessOwner,
      raffleStartDate: new Date(raffleInfo.raffleInfo.raffleOptions.raffleStartTimestamp / 1000000),
      raffleDuration: raffleInfo.raffleInfo.raffleOptions.raffleDuration,
      raffleTimeout: raffleInfo.raffleInfo.raffleOptions.raffleTimeout,
      comment: raffleInfo.raffleInfo.raffleOptions.comment,
      maxParticipantNumber: raffleInfo.raffleInfo.raffleOptions.maxParticipantNumber,
      maxTicketPerAddress: raffleInfo.raffleInfo.raffleOptions.maxTicketPerAddress,
      rafflePreview:
        raffleInfo.raffleInfo.assets[raffleInfo.raffleInfo.raffleOptions.rafflePreview],
      participants: null,
      raffleFavorites: null,
    };
  }

  async parseRaffleDBToResponse(network: Network, raffle: Raffle): Promise<RaffleResponse> {
    let raffleTicketPrice: TicketPrice;
    if (raffle.cw20TicketPrice) {
      raffleTicketPrice = {
        cw20Coin: {
          currency: raffle.cw20TicketPrice.cw20Coin.coinAddress,
          amount: raffle.cw20TicketPrice.amount,
        },
      };
    } else if (raffle.coinTicketPrice) {
      if (raffle.coinTicketPrice.denom == "uluna") {
        raffleTicketPrice = {
          coin: formatNiceLuna(raffle.coinTicketPrice.amount),
        };
      } else
        raffleTicketPrice = {
          coin: {
            currency: raffle.coinTicketPrice.denom,
            amount: raffle.coinTicketPrice.amount,
          },
        };
    } else {
      raffleTicketPrice = {};
    }

    console.log(raffle)

    const raffleInfo: RaffleInfoResponse = {
      id: raffle.id,
      owner: raffle.owner,
      allAssociatedAssets: (raffle.cw721Assets ?? [])
        .map(asset => {
          return {
            cw721Coin: this.utilsService.parseTokenDBToResponse(asset),
          };
        })
        .concat(raffle.cw1155Assets ?? []),
      raffleTicketPrice,
      numberOfTickets: raffle.numberOfTickets,
      randomnessOwner: raffle.randomnessOwner,
      winner: raffle.winner,
      state: raffle.state,
      raffleOptions: {
        raffleStartDate: raffle.raffleStartDate.toISOString(),
        raffleDuration: raffle.raffleDuration,
        raffleEndDate: raffle.raffleEndDate?.toISOString(),
        raffleTimeout: raffle.raffleTimeout,
        comment: raffle.comment,
        maxParticipantNumber: raffle.maxParticipantNumber,
        maxTicketPerAddress: raffle.maxTicketPerAddress,
        rafflePreview: raffle.rafflePreview.cw721Coin
          ? await this.addCW721Info(network, raffle.rafflePreview)
          : raffle.rafflePreview,
      },
    };

    // We parse the raffleInfo :
    return {
      network,
      raffleId: raffle.raffleId,
      id: raffle.id,
      participants: raffle.participants,
      raffleInfo,
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
      .update(RaffleNotification)
      .set({ status: NotificationStatus.read })
      .where("network = :network", { network })
      .andWhere("user = :user", { user })
      .execute();
  }

  async addFavoriteRaffle(network: Network, user: string, raffleId: number[]) {
    let currentFavorite: RaffleFavorite = await this.favoriteRepository.findOne({
      relations: {
        raffles: true,
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
        raffles: [],
      };
    }
    // We query the raffle informations
    const raffles = await pMap(raffleId, async raffleId =>
      this.rafflesRepository.findOneBy({ network, raffleId }),
    );

    currentFavorite.raffles = _.uniqBy(
      currentFavorite.raffles.concat(raffles),
      (raffle: Raffle) => raffle.id,
    );

    // We save to the database
    this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
  }

  async setFavoriteRaffle(network: Network, user: string, raffleId: number[]) {
    let currentFavorite: RaffleFavorite = await this.favoriteRepository.findOne({
      relations: {
        raffles: true,
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
        raffles: [],
      };
    }
    // We query the raffle informations
    currentFavorite.raffles = await pMap(_.uniq(raffleId), async raffleId =>
      this.rafflesRepository.findOneBy({ network, raffleId }),
    );

    // We save to the database
    this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
  }

  async removeFavoriteRaffle(network: Network, user: string, raffleId: number[]) {
    const currentFavorite: RaffleFavorite = await this.favoriteRepository.findOne({
      relations: {
        raffles: true,
      },
      where: {
        network,
        user,
      },
    });

    if (!currentFavorite) {
      return;
    }

    // We update the raffles
    currentFavorite.raffles = currentFavorite.raffles.filter(
      raffle => !raffleId.includes(raffle.raffleId),
    );
    this.favoriteRepository.save(currentFavorite);
    return currentFavorite;
  }
}
