import { TokenResponse } from "src/utils-api/dto/nft.dto";
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

export class NFTTransferResponse {
  id: number;

  network: Network;

  blockHeight: number;

  date: string;

  txHash: string;

  memo: string;

  sentAssets: {
    id: number;
    sender: string;
    recipient: string;
    cw721Token: TokenResponse;
  }[];
}
