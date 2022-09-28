import {
  CW1155Collection,
  CW1155Token,
  CW20Coin,
  CW721Collection,
  CW721Token,
  CW721TokenAttribute,
  CW721TokenMetadata,
  ValuedCoin,
  ValuedCW20Coin,
} from "../utils-api/entities/nft-info.entity";
import {
  CounterTrade,
  Trade,
  TradeInfoORM,
  TradeNotification,
} from "../trades/entities/trade.entity";
import { WalletContent } from "../nft-content/entities/nft-content.entity";

export default [
  Trade,
  CounterTrade,
  TradeInfoORM,
  TradeNotification,
  ValuedCoin,
  CW20Coin,
  ValuedCW20Coin,
  CW721Collection,
  CW721Token,
  CW721TokenMetadata,
  CW721TokenAttribute,
  CW1155Collection,
  CW1155Token,
  WalletContent,
];
