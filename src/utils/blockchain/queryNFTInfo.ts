import axios from "axios";
import { Network } from "./dto/network.dto";
import { registeredNftContracts } from "./chains";
import { localNftList } from "./nft_list";

export async function getRegisteredNFTs(network: Network): Promise<any> {
  let knownNfts: any = {};

  if (localNftList[network]) {
    knownNfts = localNftList[network];
  }

  const remoteNftList = await axios.get(registeredNftContracts);

  if (remoteNftList?.data[network]) {
    knownNfts = {
      ...knownNfts,
      ...remoteNftList?.data[network],
    };
  }

  return knownNfts;
}
