import { Controller, Get, Patch, Param } from "@nestjs/common";
import { NftContentService } from "./nft-content.service";
import { UserId, UpdateNFTWalletContent, NFTContentResponse } from "./dto/get-nft-content.dto";
import { IsEnum } from "class-validator";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Network } from "../utils/blockchain/dto/network.dto";

@ApiTags("NFT Content API")
@Controller("nft-content")
export class NftContentController {
  constructor(private readonly nftContentService: NftContentService) {}

  @Get(":network/:address")
  @IsEnum(Network)
  @ApiResponse({
    status: 200,
    type: () => NFTContentResponse,
    description: "Returns the content of a wallet",
  })
  async findNfts(@Param() params: UserId): Promise<NFTContentResponse> {
    // Need to validate that network enum
    return await this.nftContentService.findNfts(params.network, params.address);
  }

  @Patch(":network/:address/:mode")
  async update(@Param() params: UpdateNFTWalletContent) {
    return this.nftContentService.update(params.network, params.address, params.mode);
  }
}
