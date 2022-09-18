import { chains } from "./chains.js";
import { LCDClient } from "@terra-money/terra.js";

export async function sendIndependentQuery(
  networkId: string,
  contractAddress: string,
  query: object,
): Promise<any> {
  const lcdClient = new LCDClient(chains[networkId]);
  return await lcdClient.wasm.contractQuery(contractAddress, query);
}
