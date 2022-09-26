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

export class Attribute {
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
    attributes: Attribute[];
    backgroundColor?: string;
    animationUrl?: string;
    youtubeUrl?: string;
  };
}
