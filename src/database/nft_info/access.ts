import { Injectable } from "@nestjs/common";
import { Knex } from "knex";
import { InjectKnex } from "nestjs-knex";
import { Network } from "src/utils/blockchain/dto/network.dto";
import { NftContractInfo } from "./dto/nftInfo.dto";

@Injectable()
export class NFTInfoService {
  constructor(@InjectKnex() private readonly knexDB: Knex) {}

  async addNftInfo(nftInfo: NftContractInfo[]) {
    return await this.knexDB("nft_info")
      .insert(
        nftInfo.map(nft => ({
          network: nft.network,
          nft_address: nft.collectionAddress,
          name: nft.collectionName,
          symbol: nft.symbol,
        })),
      )
      .onConflict()
      .merge(); // We erase if the data is already present
  }

  async getNftInfo(network: Network, nftAddress: string): Promise<NftContractInfo[]> {
    return (
      await this.knexDB("nft_info")
        .select("*")
        .where("network", network)
        .where("nft_address", nftAddress)
    ).map(info => ({
      network,
      collectionAddress: info.nft_address,
      collectionName: info.name,
      symbol: info.symbol,
    }));
  }

  async getNftInfoByName(network: string, nftName: string) {
    return (
      await this.knexDB("nft_info").select("*").where("network", network).where("name", nftName)
    ).map(info => ({
      nftAddress: info.nft_address,
      name: info.name,
      symbol: info.symbol,
    }));
  }

  async getNftInfoByPartialName(network: string, nftPartialName: string) {
    return (
      await this.knexDB("nft_info")
        .select("*")
        .where("network", network)
        .whereRaw("name like ?", `%${nftPartialName ?? ""}%`)
    ).map(info => ({
      nftAddress: info.nft_address,
      name: info.name,
      symbol: info.symbol,
    }));
  }

  async getAllNftInfo(network: string) {
    return (await this.knexDB("nft_info").select("*").where("network", network)).map(info => ({
      nftAddress: info.nft_address,
      name: info.name,
      symbol: info.symbol,
    }));
  }
}
