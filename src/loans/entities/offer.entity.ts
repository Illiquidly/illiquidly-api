import { Network } from "../../utils/blockchain/dto/network.dto";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Coin, Loan, Terms } from "./loan.entity";
import { OfferState } from "../../utils/blockchain/dto/loan-info.dto";

@Entity()
export class Offer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column({ unique: true })
  globalOfferId: string;

  @Column()
  borrower: string;

  @Column()
  loanChainId: number;

  @Column()
  lender: string;

  @ManyToOne(() => Loan, loan => loan.offers)
  loan: Loan;

  @Column(() => Terms)
  terms: Terms;

  @Column({
    type: "enum",
    enum: OfferState,
  })
  state: OfferState;

  @Column({ type: "datetime" })
  listDate: Date;

  @Column(() => Coin)
  depositedFunds?: Coin;

  @Column({
    nullable: true,
  })
  comment?: string;
}
