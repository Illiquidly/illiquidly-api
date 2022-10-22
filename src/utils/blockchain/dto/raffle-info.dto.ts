import { Asset } from "./trade-info.dto";

export class Randomness {
  randomness: number[];
  randomnessRound: number;
  randomnessOwner: string;
}

export class BlockChainRaffleInfo {
  owner: string;
  assets: Asset[];
  raffleTicketPrice: Asset;
  numberOfTickets: number;
  randomness?: Randomness;
  winner?: string;
  //is_cancelled: boolean; --> Shouldn't be used off the contract
  state: string;
  raffleOptions: {
    raffleStartTimestamp: number;
    raffleDuration: number;
    raffleTimeout: number;
    comment?: string;
    maxParticipantNumber?: number;
    maxTicketPerAddress?: number;
    rafflePreview: number;
  };
}

export class BlockChainRaffleResponse {
  raffleId: number;
  raffleState: string;
  raffleInfo: BlockChainRaffleInfo;
}
