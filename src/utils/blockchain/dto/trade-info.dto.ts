import { Asset, Coin, Collection } from "../../../trades/dto/getTrades.dto";

export class BlockChainTradeInfo {
  owner: string;
  associatedAssets: Asset[];
  state: string;
  lastCounterId?: number;
  whitelistedUsers: string[];
  additionalInfo: {
    ownerComment: {
      comment: string;
      time: string;
    };
    time: string;
    nftsWanted: string[];
    tokensWanted: Asset[];
    lookingFor?: Array<Partial<Collection> & Coin>;
    tradePreview?: any;
    traderComment?: {
      comment: string;
      time: string;
    };
  };
  acceptedInfo?: any; // TODO correct this type
  assetsWithdrawn: boolean;
}
