import { Transform, Type } from "class-transformer";
import { IsNumber } from "class-validator";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";

export class TradeFavoriteMessage {
  network: Network;

  @IsAddress()
  user: string;

  @Type(() => Number)
  @IsNumber({}, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    } else {
      return [value];
    }
  })
  tradeId: number[];
}
