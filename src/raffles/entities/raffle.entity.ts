import { CW721Token, ValuedCoin, ValuedCW20Coin } from "../../utils-api/entities/nft-info.entity";
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

@Entity()
@Unique("UQ_PARTICIPATION_PER_TRADE", ["raffleId", "user"])
export class Participant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  raffleId: string;

  @Column()
  user: string;

  @Column()
  ticketNumber: number;

  @Column({ type: "datetime", nullable: true })
  updatedAt?: Date;

  @ManyToOne(() => Raffle, raffle => raffle.participants)
  raffle: Relation<Raffle>;
}

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
  state: string;

  @Column()
  owner: string;

  @ManyToMany(() => CW721Token)
  @JoinTable()
  cw721Assets: CW721Token[];

  @Column({ type: "json" })
  cw1155Assets: any[];

  @OneToOne(() => ValuedCW20Coin, { cascade: true, nullable: true })
  @JoinColumn()
  cw20TicketPrice?: ValuedCW20Coin;

  @OneToOne(() => ValuedCoin, { cascade: true, nullable: true })
  @JoinColumn()
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
  randomnessOwner?: string;

  @Column({
    type: "datetime",
  })
  raffleStartDate: Date;

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
  maxParticipantNumber?: number;

  @Column({
    nullable: true,
  })
  maxTicketPerAddress?: number;

  @Column({ type: "json" })
  rafflePreview: any;

  @OneToMany(() => Participant, participant => participant.raffle, {
    cascade: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  participants: Participant[];

  @ManyToMany(() => RaffleFavorite, favorite => favorite.raffles)
  @JoinTable()
  raffleFavorites: RaffleFavorite[];
}

export enum RaffleNotificationType {
  newTicketBought = "new_ticket_bought",
  raffleFinished = "raffle_finished",
}

export enum NotificationStatus {
  unread = "unread",
  read = "read",
}

@Unique("UQ_NOTIFICATION_TYPE", ["network", "user", "raffleId", "notificationType", "status"])
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

  @Column({ type: "json", default: null })
  notificationPreview: { cw721Coin?: TokenResponse };

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
  raffles: Raffle[];
}
