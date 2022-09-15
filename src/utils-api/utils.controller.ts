import { Controller, Get, Param } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { NetworkParam } from "../utils/blockchain/dto/network.dto";
import { NFTDescription, TokenDescription } from "./dto/nft.dto";
import { UtilsService } from "./utils.service";

@ApiTags("Utils")
@Controller("utils")
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Get("registered-nfts/:network/")
  async registeredNftsEntryPoint(@Param() params: NetworkParam) {
    return await this.utilsService.registeredNFTs(params.network);
  }

  @Get("nft-info/:network/:address/:tokenId")
  async nftInfo(@Param() params: TokenDescription) {
    return await this.utilsService.nftInfo(params.network, params.address, params.tokenId);
  }

  @Get("nft-info/:network/:address?")
  async allNftInfo(@Param() params: NFTDescription) {
    return await this.utilsService.allNFTInfo(params.network, params.address);
  }
}
