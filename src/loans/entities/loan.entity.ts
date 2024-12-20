import { CW721Token } from "../../utils-api/entities/nft-info.entity";
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { TokenResponse } from "../../utils-api/dto/nft.dto";
import { Offer } from "./offer.entity";
import { LoanState } from "../../utils/blockchain/dto/loan-info.dto";

export class Coin {
  @Column({ nullable: true })
  denom: string;

  @Column({ nullable: true })
  amount: string;
}

export class Terms {
  @Column(() => Coin)
  principle: Coin;

  @Column({ nullable: true })
  interest: string;

  @Column({ nullable: true })
  durationInBlocks: number;
}

@Entity()
@Unique("UQ_LOAN", ["network", "borrower", "loanId"])
export class Loan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  borrower: string;

  @Column()
  loanId: number;

  @Column({
    type: "enum",
    enum: LoanState,
  })
  state: LoanState;

  @Column({
    type: "datetime",
  })
  listDate: Date;

  @Column()
  offerAmount: number;

  @ManyToMany(() => LoanFavorite, favorite => favorite.loans)
  loanFavorites: LoanFavorite[];

  @Column(() => Terms)
  terms?: Terms;

  @Column({ nullable: true })
  startBlock?: number;

  @Column({
    nullable: true,
  })
  comment?: string;

  activeOfferOfferId: string; // This column is not saved in the DB, it simply comes from the chain

  @OneToOne(() => Offer)
  @JoinColumn()
  activeOffer?: Offer;

  @OneToMany(() => Offer, offer => offer.loan)
  offers: Offer[];

  @ManyToMany(() => CW721Token)
  @JoinTable()
  cw721Assets: CW721Token[];

  @Column({ type: "json" })
  cw1155Assets: any[];

  @Column({ type: "text" })
  loanPreview: string;
}

export enum LoanNotificationType {
  newOffer = "new_offer",
  offerAccepted = "offer_accepted",
  loanAccepted = "loan_accepted",
  otherOfferAccepted = "other_offer_accepted",
  loanCancelled = "loan_cancelled",
  refuseOffer = "offer_refused",
}

export enum NotificationStatus {
  unread = "unread",
  read = "read",
}

@Unique("UQ_NOTIFICATION_TYPE", ["network", "user", "loanId", "notificationType", "status"])
@Entity()
export class LoanNotification {
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
  borrower: string;

  @Column()
  loanId: number;

  @Column({ type: "json", default: null })
  notificationPreview: { cw721Coin?: TokenResponse };

  @Column({
    type: "enum",
    enum: LoanNotificationType,
  })
  notificationType: LoanNotificationType;

  @Column()
  globalOfferId: string;

  @Column({
    type: "enum",
    enum: NotificationStatus,
    default: NotificationStatus.unread,
  })
  status?: NotificationStatus;
}

export class SimpleFavorite {
  borrower: string;
  loanId: number;
}

@Entity()
@Unique(["network", "user"])
export class LoanFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  user: string;

  @ManyToMany(() => Loan, loan => loan.loanFavorites)
  @JoinTable()
  loans: Loan[];
}
