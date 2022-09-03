import { IsEnum, IsOptional, IsString } from "class-validator";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";

export class TokenDescription {
  @IsEnum(Network)
  network: Network;

  @IsAddress()
  address: string;

  @IsString()
  tokenId: string;
}

export class NFTDescription {
  @IsEnum(Network)
  network: Network;

  @IsOptional()
  @IsAddress()
  address?: string;
}
