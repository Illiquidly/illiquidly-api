import {
  CW721Token,
  ValuedCoin,
  ValuedCW20Coin,
} from "../../utils-api/entities/nft-info.entity";
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Network } from "../../utils/blockchain/dto/network.dto";


@Entity()
@Unique("UQ_TRADES", ["network", "raffleId"])
export class Raffle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  raffleId: number;

  @Column()
  owner: string;

  @ManyToOne(() => CW721Token)
  cw721Asset: CW721Token;

  @Column({ type: "text" })
  cw1155Asset: string;

  @ManyToOne(() => ValuedCW20Coin, { cascade: true, nullable: true})
  cw20TicketPrice?: ValuedCW20Coin;

  @ManyToOne(() => ValuedCoin, { cascade: true, nullable: true })
  coinTicketPrice?: ValuedCoin;

  @Column()
  numberOfTickets: number;

  @Column({
    nullable: true,
  })
  winner?: string;

  @Column({
    nullable: true,
  })
  randomness?: string;

  @Column({
    type: "date"
  })
  raffleStartTimestamp: Date;

  @Column()
  raffleDuration: number;

  @Column()
  raffleTimeout: number;

  @Column({
    nullable: true,
  })
  comment?: string;

  @Column({
    nullable: true,
  })
  maxParticipantNumber?: number

  @Column({
    nullable: true,
  })
  maxTicketPerAddress?: number;

  @ManyToMany(() => RaffleFavorite, favorite => favorite.raffles)
  raffleFavorites: RaffleFavorite[];
}

export enum RaffleNotificationType {
  raffleFinished = "raffle_finished",
}

export enum NotificationStatus {
  unread = "unread",
  read = "read",
}

@Entity()
export class RaffleNotification {
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
  raffleId: number;

  @Column({
    type: "enum",
    enum: RaffleNotificationType,
  })
  notificationType: RaffleNotificationType;

  @Column({
    type: "enum",
    enum: NotificationStatus,
    default: NotificationStatus.unread,
  })
  status?: NotificationStatus;
}

@Entity()
@Unique(["network", "user"])
export class RaffleFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  user: string;

  @ManyToMany(() => Raffle, raffle => raffle.raffleFavorites)
  @JoinTable()
  raffles:  Raffle[];
}