import { Injectable, NotFoundException } from "@nestjs/common";
import { Network } from "../utils/blockchain/dto/network.dto";

import { asyncAction } from "../utils/js/asyncAction";

import { BlockchainNFTQuery, getRegisteredNFTs } from "../utils/blockchain/nft_query.js";

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

import { BlockchainCW721Token, NFTAttribute, TokenResponse } from "./dto/nft.dto";
import { ChangingNFTs } from "./NftWithRegularUpdates";
const _ = require("lodash");

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
    const [err, knownNfts] = await asyncAction(getRegisteredNFTs(network));

    if (!err) {
      // We save those nft information to the NFT db if there was no error
      Object.entries(knownNfts).forEach(async ([key]: [string, any]) => {
        const [, newCollection] = await asyncAction(this.nftQuery.newCW721Contract(network, key));
        if (newCollection) {
          await asyncAction(this.collectionRepository.save([newCollection]));
        }
      });
    }

    return knownNfts;
  }

  async registeredNFTAddresses(network: Network) {
    return Object.keys(await this.registeredNFTs(network));
  }

  async nftTokenInfoFromDB(
    network: Network,
    address: string,
    tokenId: string,
  ): Promise<CW721Token> {
    // First we see if the collection exists in the contract
    const [err, nftInfo] = await asyncAction(this.findOneTokenInDB(network, address, tokenId));

    // If this info has been found in the database and they have a collection Name we simply return it
    if (!err && nftInfo) {
      return nftInfo;
    }

    // Else we create a new Contract Info and save it to the database
    const [newErr, newNFTInfo] = await asyncAction(
      this.saveNewTokenInfo(network, address, tokenId),
    );

    // If there is no error, we return the saved object
    if (!newErr) {
      return newNFTInfo;
    }

    // If there is an error, we try to query the information one more time from the database (that may happen when the api saves two info at a time)
    const [storedErr, storedNFTInfo] = await asyncAction(
      this.findOneTokenInDB(network, address, tokenId),
    );

    return storedNFTInfo;
  }

  /// This function is used to load and cache Token info variables
  async nftTokenInfo(network: Network, address: string, tokenId: string): Promise<TokenResponse> {
    const nftInfo = await this.nftTokenInfoFromDB(network, address, tokenId);
    return this.parseTokenDBToResponse(nftInfo);
  }

  async findOneTokenInDB(network: Network, address: string, tokenId: string): Promise<CW721Token> {
    return this.NFTTokenRepository.findOne({
      relations: {
        collection: true,
        metadata: {
          attributes: true,
        },
      },
      where: {
        tokenId,
        collection: {
          collectionAddress: address,
        },
      },
    });
  }

  async saveNewTokenInfo(network: Network, address: string, tokenId: string): Promise<CW721Token> {
    // Else we query it from the lcd
    const [error, { info: distantNFTInfo }]: [any, { info: BlockchainCW721Token }] =
      await asyncAction(this.nftQuery.getAllNFTInfo(network, address, tokenId));

    if (error || !distantNFTInfo) {
      throw new NotFoundException("Error when querying the token info");
    }

    // We parse it to fit in the database
    const tokenDBObject: CW721Token = await this.parseDistantTokenToDB(tokenId, distantNFTInfo);
    // Save it in the database with its collection ?
    tokenDBObject.collection = await this.collectionInfo(network, address);
    // We want to keep allNftInfo for general filtering
    const allNftInfo = _.cloneDeep(tokenDBObject);
    allNftInfo.metadata.attributes = allNftInfo.metadata.attributes.map(
      (attribute: CW721TokenAttribute) => {
        attribute.metadata = null;
        return attribute;
      },
    );

    tokenDBObject.allNftInfo = JSON.stringify(allNftInfo);
    // We try to save the record
    try {
      return await this.NFTTokenRepository.save(tokenDBObject);
    } catch (err) {
      // Else, we save it in the database
      await this.NFTTokenRepository.update(
        { tokenId, collectionId: tokenDBObject.collection.id },
        tokenDBObject,
      );
      return tokenDBObject;
    }
  }

  async findOneCollectionInDB(
    network: Network,
    collectionAddress: string,
  ): Promise<CW721Collection> {
    return this.collectionRepository.findOneBy({ network, collectionAddress });
  }

  async saveNewCollectionInfo(
    network: Network,
    collectionAddress: string,
    oldCollection: CW721Collection,
  ): Promise<CW721Collection> {
    // Else we create a new Contract Info and save it to the database
    const [error, newCollection] = await asyncAction(
      this.nftQuery.newCW721Contract(network, collectionAddress),
    );

    if (newCollection) {
      newCollection.id = oldCollection?.id;
      return this.collectionRepository.save(newCollection);
    } else {
      throw error;
    }
  }

  /// This function is used to load and cache NFT contract_info variables
  async collectionInfo(network: Network, collectionAddress: string): Promise<CW721Collection> {
    // First we see if the collection exists in the contract
    const [err, collection] = await asyncAction(
      this.findOneCollectionInDB(network, collectionAddress),
    );

    // If this info has been found in the database and they have a collection Name we simply return it
    if (!err && collection?.collectionName && collection?.collectionName != "") {
      return collection;
    }

    // Else we create a new Contract Info and save it to the database
    const [newErr, newCollection] = await asyncAction(
      this.saveNewCollectionInfo(network, collectionAddress, collection),
    );

    // If there is no error, we return the saved object
    if (!newErr) {
      return newCollection;
    }

    // If there is an error, we try to query the information one more time from the database (that may happen when the api saves two info at a time)
    const [storedErr, storedCollection] = await asyncAction(
      this.findOneCollectionInDB(network, collectionAddress),
    );

    if (!storedErr) {
      return storedCollection;
    }

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

  async updateMetadataForChangingNFTs(
    network: Network,
    tokenInfo: CW721Token,
  ): Promise<CW721Token> {
    // We only update for specific NFT addresses
    if (ChangingNFTs.includes(tokenInfo.collection.collectionAddress)) {
      return this.saveNewTokenInfo(
        network,
        tokenInfo.collection.collectionAddress,
        tokenInfo.tokenId,
      );
    }
    return tokenInfo;
  }

  parseTokenDBToResponse(tokenInfo: CW721Token): TokenResponse {
    return {
      tokenId: tokenInfo?.tokenId,
      collectionName: _.truncate(tokenInfo?.collection?.collectionName, { length: 28 }),
      collectionAddress: tokenInfo?.collection?.collectionAddress,
      symbol: tokenInfo?.collection?.symbol,
      imageUrl: fromIPFSImageURLtoImageURL(tokenInfo?.metadata?.image),
      name: _.truncate(tokenInfo?.metadata?.name, { length: 28 }),
      attributes: tokenInfo?.metadata?.attributes,
      description: tokenInfo?.metadata?.description,
      traits: (tokenInfo?.metadata?.attributes ?? []).map(
        ({ traitType, value }: { traitType: string; value: string }) => [traitType, value],
      ),
      allNFTInfo: tokenInfo?.allNftInfo,
    };
  }

  async parseDistantTokenToDB(tokenId: string, tokenInfo: BlockchainCW721Token) {
    const dbTokenInfo = new CW721Token();
    const dbTokenInfoMetadata = new CW721TokenMetadata();
    dbTokenInfo.tokenId = tokenId;
    dbTokenInfo.metadata = dbTokenInfoMetadata;

    dbTokenInfoMetadata.tokenUri = tokenInfo.tokenUri;
    dbTokenInfoMetadata.image = tokenInfo.extension?.image;
    dbTokenInfoMetadata.imageData = tokenInfo.extension?.imageData;
    dbTokenInfoMetadata.externalUrl = tokenInfo.extension?.externalUrl;
    dbTokenInfoMetadata.name = tokenInfo.extension?.name;
    dbTokenInfoMetadata.backgroundColor = tokenInfo.extension?.backgroundColor;
    dbTokenInfoMetadata.animationUrl = tokenInfo.extension?.animationUrl;
    dbTokenInfoMetadata.youtubeUrl = tokenInfo.extension?.youtubeUrl;
    dbTokenInfoMetadata.attributes = (tokenInfo.extension?.attributes ?? []).map(
      (attribute: NFTAttribute) => {
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

  async nftsInTrade(network: Network) {
    // We want to get all Tokens that appeared in the trade
    return await this.NFTTokenRepository.createQueryBuilder("token")
      .innerJoin(
        "trade_info_orm_cw721_assets_cw721_token",
        "token_join",
        "token_join.cw721_token_id = token.id",
      )
      .innerJoin("trade_info_orm", "tradeInfo", "tradeInfo.id = token_join.trade_info_orm_id")
      //and their metadata
      .leftJoinAndSelect("token.collection", "collection")
      .leftJoinAndSelect("token.metadata", "metadata")
      .leftJoinAndSelect("metadata.attributes", "attributes")
      .where("collection.network = :network", { network })
      .limit(10)
      .getMany();
    //.map(this.parseTokenDBToResponse)
  }
}
