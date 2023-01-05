import { Transform } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { Network } from "src/utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";

export class NotificationsQuery {
  network: Network;

  @IsAddress()
  user: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  limit?: number;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  offset?: number;
}

export class NotificationsRead {
  network: Network;

  @IsAddress()
  user: string;
}
