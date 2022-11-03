import { Controller, Get, Patch, Param, Injectable } from "@nestjs/common";
import { NftTransferService } from "./nft-transfer.service";
import { Crud } from "@rewiko/crud";
import { IsEnum } from "class-validator";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Network, NetworkParam } from "../utils/blockchain/dto/network.dto";
import { NFTTransferTransaction } from "./entities/nft-transfer.entity";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NFTTransferResultInterceptor } from "./interceptors/nft-transfer.interceptor";

@Injectable()
export class NftTransferCrudService extends TypeOrmCrudService<NFTTransferTransaction> {
  constructor(@InjectRepository(NFTTransferTransaction) repo: Repository<NFTTransferTransaction>) {
    super(repo);
  }
}

@ApiTags("NFT Transfer API")
@Crud({
  model: {
    type: NFTTransferTransaction,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      sentAssets: {
        eager: true,
      },
      "sentAssets.cw721Token": {
        eager: true,
        alias: "cw721Token_join",
      },
      "sentAssets.cw721Token.collection": {
        eager: true,
        alias: "cw721Token_collection_join",
      },
      "sentAssets.cw721Token.metadata": {
        eager: true,
        alias: "cw721Token_metadata_join",
      },
      "sentAssets.cw721Token.metadata.attributes": {
        eager: true,
        alias: "cw721Token_metadata_attributes_join",
      },
    },
  },
  routes: {
    getOneBase: {
      decorators: [],
      interceptors: [NFTTransferResultInterceptor],
    },
    getManyBase: {
      decorators: [],
      interceptors: [NFTTransferResultInterceptor],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("nft-transfer-transactions")
export class NftTransferController {
  constructor(
    private readonly nftTransferService: NftTransferService,
    public service: NftTransferCrudService,
  ) {}

  @Patch("update/:network/")
  async update(@Param() params: NetworkParam) {
    return this.nftTransferService.update(params.network);
  }
  /*
  @Patch("reset/:network/")
  async reset(@Param() params: NetworkParam) {
    return this.nftTransferService.reset(params.network);
  }
  */
}
