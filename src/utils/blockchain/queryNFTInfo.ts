import axios from "axios";
import { Network } from "./dto/network.dto";
import { registeredNftContracts } from "./chains";
import { localNftList } from "./nft_list";
import { addNftInfo } from "../mysql_db_accessor";

export async function registeredNFTs(network: string): Promise<string[]> {
  let knownNfts: any = {};

  if (localNftList[network]) {
    knownNfts = localNftList[network];
  }

  let remoteNftList = await axios.get(registeredNftContracts);

  if (remoteNftList?.data[network]) {
    knownNfts = {
      ...knownNfts,
      ...remoteNftList?.data[network],
    };
  }

  // We save those nft information to the NFT db
  await addNftInfo(
    Object.entries(knownNfts).map(([key, value]: [string, any]) => ({
      network,
      nftAddress: key,
      name: value.name,
      symbol: value.symbol,
    })),
  );

  return knownNfts;
}

export async function registeredNFTAddresses(network: Network) {
  return Object.keys(await registeredNFTs(network));
}
