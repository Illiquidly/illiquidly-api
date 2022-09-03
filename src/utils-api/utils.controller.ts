import { Controller, Get, Param } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { NetworkParam } from "../utils/blockchain/dto/network.dto";
import { NFTDescription, TokenDescription } from "./dto/nft.dto";
import { UtilsService } from "./utils.service";

@ApiTags("Utils")
@Controller("utils")
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Get("registered_nfts/:network/")
  async registeredNfts(@Param() params: NetworkParam) {
    return this.utilsService.registeredNfts(params.network);
  }

  @Get("nft_info/:network/:address/:tokenId")
  async nftInfo(@Param() params: TokenDescription) {
    return this.utilsService.nftInfo(params.network, params.address, params.tokenId);
  }

  @Get("nft_info/:network/:address?")
  async allNftInfo(@Param() params: NFTDescription) {
    return this.utilsService.allNFTInfo(params.network, params.address);
  }
}
