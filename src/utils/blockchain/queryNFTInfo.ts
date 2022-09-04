import axios from "axios";
import { Network } from "./dto/network.dto";
import { registeredNftContracts } from "./chains";
import { localNftList } from "./nft_list";
import { addNftInfo } from "../../database/nft_info/access";
import { Knex } from "knex";

export async function registeredNFTs(knexDB: Knex, network: string): Promise<string[]> {
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
    knexDB,
    Object.entries(knownNfts).map(([key, value]: [string, any]) => ({
      network,
      nftAddress: key,
      name: value.name,
      symbol: value.symbol,
    })),
  );

  return knownNfts;
}

export async function registeredNFTAddresses(knexDB: Knex, network: Network) {
  return Object.keys(await registeredNFTs(knexDB, network));
}
