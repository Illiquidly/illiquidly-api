import { Transform } from "class-transformer";

import { IsInt } from "class-validator";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { AssetResponse, RawCoin } from "../../utils-api/dto/nft.dto";
import { Participant } from "../entities/raffle.entity";

export class SingleRaffleParameters {
  network: Network;

  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  raffleId: number;
}

export class TicketPrice {
  coin?: RawCoin;
  cw20Coin?: RawCoin;
}

export class RaffleOptionsResponse {
  raffleStartDate: string;
  raffleDuration: number;
  raffleEndDate: string;
  raffleTimeout: number;
  comment?: string;
  maxParticipantNumber?: number;
  maxTicketPerAddress?: number;
  rafflePreview: AssetResponse;
}

export class RaffleInfoResponse {
  id: number;
  owner: string;
  allAssociatedAssets: AssetResponse[];
  raffleTicketPrice: TicketPrice;
  numberOfTickets: number;
  randomnessOwner?: string;
  winner?: string;
  state: string;
  raffleOptions: RaffleOptionsResponse;
}

export class RaffleResponse {
  network: Network;
  raffleId: number;
  id: number;
  participants: Participant[];
  raffleInfo: RaffleInfoResponse;
}
