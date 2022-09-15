import { chains } from "./chains.js";
import { LCDClient } from "@terra-money/terra.js";
import _ from "lodash";

async function sendIndependentQuery(
  networkId: string,
  contractAddress: string,
  query: object,
): Promise<any> {
  const lcdClient = new LCDClient(chains[networkId]);

  return await lcdClient.wasm.contractQuery(contractAddress, query);
}

async function getAllNFTInfo(
  network: string,
  nftContractAddress: string,
  tokenId: string,
): Promise<any> {
  const nftInfo = await sendIndependentQuery(network, nftContractAddress, {
    all_nft_info: {
      token_id: tokenId,
    },
  });

  return nftInfo;
}

async function getNumTokens(network: string, nftContractAddress: string): Promise<any> {
  const nftInfo = await sendIndependentQuery(network, nftContractAddress, {
    num_tokens: {},
  });

  return nftInfo;
}

async function getTokens(
  network: string,
  contractAddress: string,
  limit?: number,
  startAfter?: string,
): Promise<string[]> {
  const { tokens } = await sendIndependentQuery(network, contractAddress, {
    all_tokens: {
      ...(limit ? { limit } : {}),
      ...(startAfter ? { start_after: startAfter } : {}),
    },
  });
  return tokens;
}

const getAllTokens = async (network: string, address: string, limit = 100) => {
  let startAfter: string | undefined;
  const response: string[][] = [];

  const fetchUserTokensPart = async () => {
    const result: string[] = await getTokens(network, address, limit, startAfter);

    response.push(result);

    startAfter = _.last(result);

    if (startAfter) {
      await fetchUserTokensPart();
    }
  };

  await fetchUserTokensPart();

  return response.flat();
};

export { getAllNFTInfo, getNumTokens, getAllTokens };
