import { Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Crud } from "@rewiko/crud";
import { contracts } from "../utils/blockchain/chains";
import { NetworkParam } from "../utils/blockchain/dto/network.dto";
import {
  CW721CollectionCrudService,
  CW721TokenInCounterTradeCrudService,
  CW721TokenInTradeCrudService,
} from "./cw721CrudService";
import { CW721CollectionDescription, TokenDescription } from "./dto/nft.dto";
import { CW721Collection, CW721Token } from "./entities/nft-info.entity";
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
export class CollectionsController {
  constructor(
    private readonly utilsService: UtilsService,
    public service: CW721CollectionCrudService,
  ) {}

  @Get("registered-nfts/:network/")
  async registeredNftsEntryPoint(@Param() params: NetworkParam) {
    return await this.utilsService.registeredNFTs(params.network);
  }

  @Patch("info/:network/:address")
  async NFTContractInfo(@Param() params: CW721CollectionDescription) {
    return await this.utilsService.collectionInfo(params.network, params.address);
  }

  @Patch("token-info/:network/:address/:tokenId")
  async nftInfo(@Param() params: TokenDescription) {
    return await this.utilsService.nftTokenInfo(params.network, params.address, params.tokenId);
  }
}

@ApiTags("CW721")
@Crud({
  model: {
    type: CW721Token,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      metadata: {
        eager: true,
        alias: "metadata_join",
      },
      "metadata.attributes": {
        eager: true,
        alias: "metadata_attributes_join",
      },
    },
  },
  routes: {
    getManyBase: {
      decorators: [],
      interceptors: [],
    },
    only: ["getManyBase"],
  },
})
@Controller("token-in-trade")
export class TradeTokensController {
  constructor(public service: CW721TokenInTradeCrudService) {}
}

@ApiTags("CW721")
@Crud({
  model: {
    type: CW721Token,
  },
  query: {
    limit: 10,
    sort: [],
    join: {
      metadata: {
        eager: true,
        alias: "metadata_join",
      },
      "metadata.attributes": {
        eager: true,
        alias: "metadata_attributes_join",
      },
    },
  },
  routes: {
    getManyBase: {
      decorators: [],
      interceptors: [],
    },
    only: ["getManyBase"],
  },
})
@Controller("token-in-counter-trade")
export class CounterTradeTokensController {
  constructor(public service: CW721TokenInCounterTradeCrudService) {}
}
