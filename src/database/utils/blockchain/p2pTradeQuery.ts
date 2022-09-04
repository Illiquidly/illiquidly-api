import "dotenv/config";
import { LCDClient } from "@terra-money/terra.js";
import { chains, contracts } from "./chains.js";

export enum Network {
  mainnet = "mainnet",
  testnet = "testnet",
  devnet = "devnet",
  classic = "classic",
}

async function getTradeInfo(network: Network, tradeId: number): Promise<any> {
  let terra = new LCDClient(chains[network]);
  return terra.wasm.contractQuery(contracts[network].p2pTrade, {
    trade_info: {
      trade_id: tradeId,
    },
  });
}

async function getCounterTradeInfo(
  network: Network,
  tradeId: number,
  counterId: number,
): Promise<any> {
  let terra = new LCDClient(chains[network]);
  return terra.wasm.contractQuery(contracts[network].p2pTrade, {
    counter_trade_info: {
      trade_id: tradeId,
      counter_id: counterId,
    },
  });
}

export { getTradeInfo, getCounterTradeInfo };
