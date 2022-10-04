export class Coin {
  denom: string;
  amount: string;
}

export class CW20Coin {
  address: string;
  amount: string;
}

export class CW721Coin {
  address: string;
  tokenId: string;
}

export class CW1155Coin {
  address: string;
  tokenId: string;
  value: string;
}

export class Asset {
  coin: Coin;
  cw20Coin: CW20Coin;
  cw721Coin: CW721Coin;
  cw1155Coin: CW1155Coin;
}

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
    tradePreview?: any;
    traderComment?: {
      comment: string;
      time: string;
    };
  };
  acceptedInfo?: any; // TODO correct this type
  assetsWithdrawn: boolean;
}
