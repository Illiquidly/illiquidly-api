import {
  CW721Collection,
  CW721Token,
  ValuedCoin,
  ValuedCW20Coin,
} from "../../utils-api/entities/nft-info.entity";
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from "typeorm";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { TokenResponse } from "src/utils-api/dto/nft.dto";

// TODO table.text("whole_data");
@Entity()
export class TradeInfoORM {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  lastCounterId?: number;

  @Column()
  owner: string;

  @Column({
    nullable: true,
  })
  ownerComment: string;

  @Column({
    nullable: true,
    type: "datetime",
  })
  ownerCommentTime: Date;

  @Column({ type: "datetime" })
  time: Date;

  @Column({
    nullable: true,
  })
  traderComment: string;

  @Column({
    nullable: true,
    type: "datetime",
  })
  traderCommentTime: Date;

  @Column()
  state: string;

  @Column()
  assetsWithdrawn: boolean;

  @Column({
    nullable: true,
  })
  acceptedCounterTradeId: number;

  @ManyToMany(() => CW721Token)
  @JoinTable()
  cw721Assets: CW721Token[];

  @Column({ type: "text" })
  cw1155Assets: string;

  @ManyToMany(() => ValuedCW20Coin, { cascade: true })
  @JoinTable()
  cw20Assets: ValuedCW20Coin[];

  @ManyToMany(() => ValuedCoin, { cascade: true })
  @JoinTable()
  coinAssets: ValuedCoin[];

  @Column({ type: "text" })
  whitelistedUsers: string;

  @Column({ type: "text" })
  tokensWanted: string;

  @Column({ type: "text" })
  tradePreview: string;

  @OneToOne(() => Trade, trade => trade.tradeInfo)
  trade?: Relation<Trade>;

  @OneToOne(() => CounterTrade, counter => counter.tradeInfo)
  counterTrade?: Relation<CounterTrade>;
}

export class RawAsset {
  cw721Coin?: TokenResponse;
  cw20Coin?: ValuedCW20Coin;
  coin?: ValuedCoin;
}

@Entity()
@Unique("UQ_TRADES", ["network", "tradeId"])
export class Trade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  tradeId: number;

  @ManyToMany(() => TradeFavorite, favorite => favorite.trades)
  tradeFavorites: TradeFavorite[];

  @JoinTable()
  @ManyToMany(() => CW721Collection)
  nftsWanted: CW721Collection[];

  @OneToOne(() => TradeInfoORM, tradeInfo => tradeInfo.trade, {
    cascade: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "UQ_TRADES" })
  tradeInfo: TradeInfoORM;

  @OneToMany(() => CounterTrade, counterTrade => counterTrade.trade)
  counterTrades: CounterTrade[];
}

@Entity()
@Unique("UQ_COUNTER_TRADES", ["network", "trade", "counterTradeId"])
export class CounterTrade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @ManyToOne(() => Trade, trade => trade.counterTrades)
  trade: Trade;

  @Column()
  counterTradeId: number;

  @OneToOne(() => TradeInfoORM, tradeInfo => tradeInfo.counterTrade, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    cascade: true,
  })
  @JoinColumn({ name: "UQ_COUNTER_TRADES" })
  tradeInfo: TradeInfoORM;
}

export enum TradeNotificationType {
  newCounterTrade = "new_counter_trade",
  counterTradeReview = "counter_trade_review",
  counterTradeAccepted = "counter_trade_accepted",
  otherCounterTradeAccepted = "other_counter_trade_accepted",
  tradeCancelled = "trade_cancelled",
  refuseCounterTrade = "counter_trade_refused",
}

export enum TradeNotificationStatus {
  unread = "unread",
  read = "read",
}

@Entity()
export class TradeNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column({ type: "datetime" })
  time: string;

  @Column()
  user: string;

  @Column()
  tradeId: number;

  @Column({ type: "json" })
  notificationPreview: {cw721Coin?: TokenResponse}

  @Column()
  counterTradeId: number;

  @Column({
    type: "enum",
    enum: TradeNotificationType,
  })
  notificationType: TradeNotificationType;

  @Column({
    type: "enum",
    enum: TradeNotificationStatus,
    default: TradeNotificationStatus.unread,
  })
  status?: TradeNotificationStatus;
}

@Entity()
@Unique(["network", "user"])
export class TradeFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  user: string;

  @ManyToMany(() => Trade, trade => trade.tradeFavorites)
  @JoinTable()
  trades: Trade[];
}
