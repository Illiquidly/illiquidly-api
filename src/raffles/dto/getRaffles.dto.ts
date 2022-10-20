import { Transform } from "class-transformer";

import { IsInt } from "class-validator";
import { Network } from "../../utils/blockchain/dto/network.dto";

export class SingleRaffleParameters {
  network: Network;

  @IsInt()
  @Transform(({ value }) => Number.parseInt(value))
  raffleId: number;
}
