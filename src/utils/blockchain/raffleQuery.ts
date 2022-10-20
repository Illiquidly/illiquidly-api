import "dotenv/config";
import { LCDClient } from "@terra-money/terra.js";
import { chains, contracts } from "./chains";
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
    const terra = new LCDClient(chains[network]);
    return camelCaseObjectDeep(
      await terra.wasm.contractQuery(contracts[network].raffle, {
        raffle_info: {
          raffle_id: raffleId
        },
      }),
    );
  }
}
