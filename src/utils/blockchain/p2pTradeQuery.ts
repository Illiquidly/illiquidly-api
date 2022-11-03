import "dotenv/config";
import { contracts } from "./chains";
import { Network } from "./dto/network.dto";
import { sendIndependentQuery } from "./sendIndependentQuery";
import { BlockChainTradeInfo } from "./dto/trade-info.dto";
const camelCaseObjectDeep = require("camelcase-object-deep");

export class BlockchainTradeQuery {
  sendQueryFunction: typeof sendIndependentQuery;
  constructor(sendQueryFunction: typeof sendIndependentQuery = sendIndependentQuery) {
    this.sendQueryFunction = sendQueryFunction;
  }

  async getTradeInfo(network: Network, tradeId: number): Promise<BlockChainTradeInfo> {
    return camelCaseObjectDeep(
      await this.sendQueryFunction(network, contracts[network].p2pTrade, {
        trade_info: {
          trade_id: tradeId,
        },
      }),
    );
  }

  async getCounterTradeInfo(network: Network, tradeId: number, counterId: number): Promise<any> {
    return camelCaseObjectDeep(
      await this.sendQueryFunction(network, contracts[network].p2pTrade, {
        counter_trade_info: {
          trade_id: tradeId,
          counter_id: counterId,
        },
      }),
    );
  }
}
