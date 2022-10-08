import { NFTCollection, TokenResponse } from "../../utils-api/dto/nft.dto";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";
import { UpdateState } from "../entities/nft-content.entity";

export class NFTContentResponse {
  ownedCollections?: NFTCollection[];
  ownedTokens: TokenResponse[];
  state: UpdateState;
}

export enum UpdateMode {
  UPDATE = "update",
  FORCE_UPDATE = "force_update",
}

export class UserId {
  network: Network;

  @IsAddress()
  address: string;
}

export class UpdateNFTWalletContent {
  network: Network;

  @IsAddress()
  address: string;

  mode: UpdateMode;
}
