import "dotenv/config";
import { contracts } from "./chains";
import { Network } from "./dto/network.dto";
import { sendIndependentQuery } from "./sendIndependentQuery";
import { BlockChainRaffleInfo } from "./dto/raffle-info.dto";
const camelCaseObjectDeep = require("camelcase-object-deep");

export class BlockchainRaffleQuery {
  sendQueryFunction: typeof sendIndependentQuery;
  constructor(sendQueryFunction: typeof sendIndependentQuery = sendIndependentQuery) {
    this.sendQueryFunction = sendQueryFunction;
  }

  async getRaffleInfo(network: Network, raffleId: number): Promise<BlockChainRaffleInfo> {
    return camelCaseObjectDeep(
      await sendIndependentQuery(network, contracts[network].raffle, {
        raffle_info: {
          raffle_id: raffleId,
        },
      }),
    );
  }

  async getParticipants(
    network: Network,
    raffleId: number,
    startAfter = null,
    limit = 30,
  ): Promise<string[]> {
    return camelCaseObjectDeep(
      await sendIndependentQuery(network, contracts[network].raffle, {
        all_tickets: {
          raffle_id: raffleId,
          start_after: startAfter,
          limit,
        },
      }),
    );
  }

  async getAllParticipants(
    network: Network,
    raffleId: number,
    startAfter = null,
  ): Promise<string[]> {
    let allParticipants = [];
    let nQueried = 0;
    do {
      const newParticipants = await this.getParticipants(network, raffleId, startAfter, 100);
      nQueried = newParticipants.length;
      startAfter += nQueried;
      allParticipants = allParticipants.concat(newParticipants);
    } while (nQueried);

    return allParticipants;
  }
}
