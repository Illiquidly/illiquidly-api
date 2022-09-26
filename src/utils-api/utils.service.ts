import { Injectable, NotFoundException } from "@nestjs/common";
import { Network } from "../utils/blockchain/dto/network.dto";

import { asyncAction } from "../utils/js/asyncAction";

import { BlockchainNFTQuery } from "../utils/blockchain/nft_query.js";

import { QueryLimitService } from "../utils/queryLimit.service";
import {
  CW20Coin,
  CW721Collection,
  CW721Token,
  CW721TokenAttribute,
  CW721TokenMetadata,
} from "./entities/nft-info.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { fromIPFSImageURLtoImageURL } from "../utils/blockchain/ipfs";
import { TokenInteracted } from "../nft-content/dto/get-nft-content.dto";
import { Attribute, BlockchainCW721Token } from "./dto/nft.dto";

export function toAllNFTInfoKey(network: string) {
  return `all_nft_info:${network}`;
}

export function toExistingTokenKey(network: string) {
  return `existing_tokens:${network}`;
}

@Injectable()
export class UtilsService {
  nftQuery: BlockchainNFTQuery;

  constructor(
    @InjectRepository(CW721Collection) private collectionRepository: Repository<CW721Collection>,
    @InjectRepository(CW20Coin) private tokenRepository: Repository<CW20Coin>,
    @InjectRepository(CW721Token) private NFTTokenRepository: Repository<CW721Token>,
    @InjectRepository(CW721TokenMetadata)
    private tokenMetadataRepository: Repository<CW721TokenMetadata>,
    private readonly queryLimitService: QueryLimitService,
  ) {
    this.nftQuery = new BlockchainNFTQuery(
      this.queryLimitService.sendIndependentQuery.bind(this.queryLimitService),
    );
  }

  async registeredNFTs(network: Network) {
    const [err, knownNfts] = await asyncAction(this.nftQuery.getRegisteredNFTs(network));

    if (!err) {
      // We save those nft information to the NFT db if there was no error
      Object.entries(knownNfts).forEach(async ([key]: [string, any]) => {
        const [, newCollection] = await asyncAction(this.nftQuery.newCW721Contract(network, key));
        if (newCollection) {
          await this.collectionRepository.save([newCollection]);
        }
      });
    }

    return knownNfts;
  }

  async registeredNFTAddresses(network: Network) {
    return Object.keys(await this.registeredNFTs(network));
  }

  async nftTokenInfoFromDB(network: Network, address: string, tokenId: string) {
    const [err, storedNFTInfo] = await asyncAction(
      this.NFTTokenRepository.createQueryBuilder("token")
        .leftJoinAndSelect("token.collection", "collection")
        .leftJoinAndSelect("token.metadata", "metadata")
        .leftJoinAndSelect("metadata.attributes", "attributes")
        .where("collection.collectionAddress = :address", { address })
        .where("token.tokenId = :tokenId", { tokenId })
        .getOne(),
    );

    if (!err && storedNFTInfo) {
      return storedNFTInfo;
    }

    // Else we query it from the lcd
    const [error, { info: distantNFTInfo }]: [any, { info: BlockchainCW721Token }] =
      await asyncAction(this.nftQuery.getAllNFTInfo(network, address, tokenId));
    if (error) {
      throw new NotFoundException("Token not found");
    }

    // We parse it to fit in the database
    const tokenDBObject: CW721Token = await this.parseDistantTokenToDB(tokenId, distantNFTInfo);
    // Save it in the database with its collection ?
    tokenDBObject.collection = await this.collectionInfo(network, address);
    await this.NFTTokenRepository.save([tokenDBObject]);
    return distantNFTInfo;
  }

  /// This function is used to load and cache Token info variables
  async nftTokenInfo(network: Network, address: string, tokenId: string) {
    const nftInfo = await this.nftTokenInfoFromDB(network, address, tokenId);
    return await this.parseTokenDBToResponse(nftInfo);
  }

  /// This function is used to load and cache NFT contract_info variables
  async collectionInfo(network: Network, collectionAddress: string): Promise<CW721Collection> {
    // First we see if the collection exists in the contract
    const [err, collection] = await asyncAction(
      this.collectionRepository.findOneBy({ network, collectionAddress }),
    );

    // If this info has been found in the database, we simply return it
    if (!err && collection) {
      return collection;
    }

    // Else we create a new Contract Info and save it to the database
    const [, newCollection] = await asyncAction(
      this.nftQuery.newCW721Contract(network, collectionAddress),
    );

    // We save the new collection or get the one that has be saved in the meanwhile while updating
    //
    if (newCollection) {
      return (
        await this.collectionRepository
          .save([newCollection])
          .catch(() => this.collectionRepository.findOneBy({ network, collectionAddress }))
      )[0];
    }

    // If there was an error when creating the collection object, we simply return empty info (with null collectionName)
    return {
      id: null,
      network,
      symbol: null,
      collectionAddress,
      collectionName: null,
      tokens: [],
    };
  }

  /// This function is used to load and cache NFT contract_info variables
  async CW20CoinInfo(network: Network, coinAddress: string): Promise<CW20Coin> {
    // First we see if the collection exists in the contract
    const [err, coin] = await asyncAction(this.tokenRepository.findOneBy({ network, coinAddress }));
    // If this info has been found in the database, we simply return it
    if (!err) {
      return coin;
    }

    // Else we create a new Contract Info and save it to the database
    const [, newToken] = await asyncAction(this.nftQuery.newCW20Contract(network, coinAddress));
    if (newToken) {
      await this.tokenRepository.save([newToken]);
      return newToken;
    }

    // If there was an error when creating the collection object, we simply return empty info (with null collectionName)
    return {
      id: null,
      network,
      coinAddress,
      coinName: null,
      symbol: null,
      decimals: null,
    };
  }

  async parseTokenDBToResponse(tokenInfo: CW721Token): Promise<Partial<TokenInteracted>> {
    return tokenInfo
      ? {
          tokenId: tokenInfo.tokenId,
          collectionName: tokenInfo.collection?.collectionName,
          collectionAddress: tokenInfo.collection?.collectionAddress,
          symbol: tokenInfo.collection?.symbol,
          imageUrl: fromIPFSImageURLtoImageURL(tokenInfo.metadata?.image),
          name: tokenInfo.metadata?.name,
          attributes: tokenInfo.metadata?.attributes,
          description: tokenInfo.metadata?.description,
          traits: (tokenInfo?.metadata?.attributes ?? []).map(
            ({ traitType, value }: { traitType: string; value: string }) => [traitType, value],
          ),
          allNFTInfo: tokenInfo.metadata,
        }
      : {};
  }

  async parseDistantTokenToDB(tokenId: string, tokenInfo: BlockchainCW721Token) {
    const dbTokenInfo = new CW721Token();
    const dbTokenInfoMetadata = new CW721TokenMetadata();
    dbTokenInfo.tokenId = tokenId;
    dbTokenInfo.metadata = dbTokenInfoMetadata;
    dbTokenInfo.allNftInfo = JSON.stringify(tokenInfo);

    dbTokenInfoMetadata.tokenUri = tokenInfo.tokenUri;
    dbTokenInfoMetadata.image = tokenInfo.extension?.image;
    dbTokenInfoMetadata.imageData = tokenInfo.extension?.imageData;
    dbTokenInfoMetadata.externalUrl = tokenInfo.extension?.externalUrl;
    dbTokenInfoMetadata.name = tokenInfo.extension?.name;
    dbTokenInfoMetadata.backgroundColor = tokenInfo.extension?.backgroundColor;
    dbTokenInfoMetadata.animationUrl = tokenInfo.extension?.animationUrl;
    dbTokenInfoMetadata.youtubeUrl = tokenInfo.extension?.youtubeUrl;
    dbTokenInfoMetadata.attributes = (tokenInfo.extension?.attributes ?? []).map(
      (attribute: Attribute) => {
        const dbAttribute = new CW721TokenAttribute();
        dbAttribute.displayType = attribute?.displayType;
        dbAttribute.traitType = attribute?.traitType;
        dbAttribute.value = attribute?.value;
        dbAttribute.metadata = dbTokenInfoMetadata;
        return dbAttribute;
      },
    );
    await this.tokenMetadataRepository.save([dbTokenInfoMetadata]);
    return dbTokenInfo;
  }
}
