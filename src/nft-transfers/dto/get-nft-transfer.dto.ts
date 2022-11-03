import { Network } from "../../utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";

export enum UpdateMode {
  UPDATE = "update",
  FORCE_UPDATE = "force_update",
}

export class UpdateNFTWalletContent {
  network: Network;

  @IsAddress()
  address: string;

  mode: UpdateMode;
}
