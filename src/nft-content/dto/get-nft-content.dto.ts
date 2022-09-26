import { ApiProperty } from "@nestjs/swagger";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { IsAddress } from "../../utils/nest/addressValidator";

export enum UpdateState {
  Full,
  Partial,
  isUpdating,
}

export class TxInterval {
  oldest: number | null;
  newest: number | null;
}
class TxQueried {
  external: TxInterval;
  internal: TxInterval;
}

export class NFTInteracted {
  collectionName: string;
  collectionAddress: string;
}

export class StoreContractsInteracted {
  interactedContracts: Set<string>;
  ownedTokens: StoredTokenInteracted[];
  state: UpdateState;
  txs: TxQueried;
}

export class NFTContentResponse {
  interactedContracts: string[];
  ownedCollections?: NFTInteracted[];
  ownedTokens: TokenInteracted[];
  state: UpdateState;
  txs: TxQueried;
}

class NFTAttribute {
  displayType?: string;
  traitType: string;
  value: string;
}

type Traits = [string, string];

export class RawTokenInteracted {
  tokenId: string;
  imageUrl?: string[] | string;
  name?: string;
  attributes?: NFTAttribute[];
  description?: string;
  @ApiProperty({
    type: "array",
    items: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 2,
      maxItems: 2,
    },
  })
  traits?: Traits[];
  otherNFTInfo?: any;
}

export class StoredTokenInteracted {
  tokenId: string;
  collectionAddress: string;
  allNFTInfo?: any;
}

export class TokenInteracted {
  tokenId: string;
  collectionName: string;
  collectionAddress: string;
  symbol?: string;
  imageUrl?: string[] | string;
  name?: string;
  attributes?: NFTAttribute[];
  description?: string;
  @ApiProperty({
    type: "array",
    items: {
      type: "array",
      items: {
        type: "string",
      },
      minItems: 2,
      maxItems: 2,
    },
  })
  traits?: Traits[];
  allNFTInfo?: any;
}

export class SerializableContractsInteracted {
  interactedContracts: string[];
  ownedCollections?: NFTInteracted[];
  ownedTokens: TokenInteracted[];
  state: UpdateState;
  txs: TxQueried;
}

export enum UpdateMode {
  UPDATE = "update",
  FORCE_UPDATE = "force_update",
}

export class GetNFTWalletContent {
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
