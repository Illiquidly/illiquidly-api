import "dotenv/config";
import { LCDClient } from "@terra-money/terra.js";
import { chains, contracts } from "./chains";
import { Network } from "./dto/network.dto";
import { sendIndependentQuery } from "./sendIndependentQuery";

export class BlockchainTradeQuery {
  sendQueryFunction: typeof sendIndependentQuery;
  constructor(sendQueryFunction: typeof sendIndependentQuery = sendIndependentQuery) {
    this.sendQueryFunction = sendQueryFunction;
  }

  async getTradeInfo(network: Network, tradeId: number): Promise<any> {
    const terra = new LCDClient(chains[network]);
    return await terra.wasm.contractQuery(contracts[network].p2pTrade, {
      trade_info: {
        trade_id: tradeId,
      },
    });
  }

  async getCounterTradeInfo(network: Network, tradeId: number, counterId: number): Promise<any> {
    const terra = new LCDClient(chains[network]);
    return await terra.wasm.contractQuery(contracts[network].p2pTrade, {
      counter_trade_info: {
        trade_id: tradeId,
        counter_id: counterId,
      },
    });
  }
}
