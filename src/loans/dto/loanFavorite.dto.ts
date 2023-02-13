import { Type } from "class-transformer";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";
import { SimpleFavorite } from "../entities/loan.entity";

export class LoanFavoriteMessage {
  network: Network;

  @IsAddress()
  user: string;

  borrower: string;

  loanId: number;
}
