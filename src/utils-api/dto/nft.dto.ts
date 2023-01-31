import { ApiProperty } from "@nestjs/swagger";
import { Network } from "../../utils/blockchain/dto/network.dto";

export class TokenDescription {
  network: Network;
  address: string;
  tokenId: string;
}

export class CW721CollectionDescription {
  network: Network;
  address: string;
}

export class NFTAttribute {
  displayType?: string;
  traitType: string;
  value: string;
}

export class BlockchainCW721Token {
  tokenUri?: string;
  extension: {
    image?: string;
    imageData?: string;
    externalUrl?: string;
    description?: string;
    name?: string;
    attributes: NFTAttribute[];
    backgroundColor?: string;
    animationUrl?: string;
    youtubeUrl?: string;
  };
}

export class TokenResponse {
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

type Traits = [string, string];

export class AssetResponse {
  coin?: CoinResponse;
  cw20Coin?: Cw20Response;
  cw721Coin?: TokenResponse;
  cw1155Coin?: CW1155Coin;
}

export interface RawCoin {
  currency?: string;
  amount?: string;
  rawAmount?: string;
}

export type Asset = Coin & CW20Coin & CW721Coin & CW1155Coin;

export class Coin {
  coin: {
    denom: string;
    amount: string;
  };
}
export class CW20Coin {
  cw20Coin: {
    address: string;
    amount: string;
  };
}
export class CW721Coin {
  cw721Coin: {
    address: string;
    tokenId: string;
  };
}
export class CW1155Coin {
  cw1155Coin: {
    address: string;
    tokenId: string;
    value: string;
  };
}

export class CoinResponse {
  denom: string;
  amount: string;
}

export class Cw20Response {
  address: string;
  amount: string;
}

export class NFTCollection {
  collectionName: string;
  collectionAddress: string;
}
