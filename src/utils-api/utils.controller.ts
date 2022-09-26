import { Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Crud } from "@rewiko/crud";
import { contracts } from "../utils/blockchain/chains";
import { NetworkParam } from "../utils/blockchain/dto/network.dto";
import { CW721CollectionCrudService } from "./cw721CrudService";
import { CW721CollectionDescription, TokenDescription } from "./dto/nft.dto";
import { CW721Collection } from "./entities/nft-info.entity";
import { UtilsService } from "./utils.service";

@ApiTags("Utils")
@Controller("utils")
export class UtilsController {
  @Get("illiquidlabs-contracts")
  contract() {
    return contracts;
  }
}

@ApiTags("CW721")
@Crud({
  model: {
    type: CW721Collection,
  },
  query: {
    limit: 10,
    sort: [],
  },
  routes: {
    getOneBase: {
      decorators: [],
      interceptors: [],
    },
    getManyBase: {
      decorators: [],
      interceptors: [],
    },
    only: ["getOneBase", "getManyBase"],
  },
})
@Controller("collections")
export class TradesController {
  constructor(
    private readonly utilsService: UtilsService,
    public service: CW721CollectionCrudService,
  ) {}

  @Get("registered-nfts/:network/")
  async registeredNftsEntryPoint(@Param() params: NetworkParam) {
    return await this.utilsService.registeredNFTs(params.network);
  }

  @Patch("/:network/:address")
  async NFTContractInfo(@Param() params: CW721CollectionDescription) {
    return await this.utilsService.collectionInfo(params.network, params.address);
  }

  @Patch("/:network/:address/:tokenId")
  async nftInfo(@Param() params: TokenDescription) {
    return await this.utilsService.nftTokenInfo(params.network, params.address, params.tokenId);
  }
}
