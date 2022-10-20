import { Asset } from "./trade-info.dto";

export class Randomness{
  randomness: number[];
  randomnessRound: number;
  randomnessOwner:string;
}

export class BlockChainRaffleInfo {

  owner: string;
  asset: Asset;
  raffleTicketPrice: Asset;
  numberOfTickets: number;
  randomness?: Randomness;  
  winner?: string;
  associatedAssets: Asset[];
  state: string;
  raffleOptions: {
    raffleStartTimestamp: number;
    raffleDuration: number;
    raffleTimeout: number;
    comment?: string;
    maxParticipantNumber?: number;
    maxTicketPerAddress?: number;
  }
}
