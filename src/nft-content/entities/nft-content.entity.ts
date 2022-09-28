import { CW721Token } from "../../utils-api/entities/nft-info.entity";
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from "typeorm";
import { Network } from "../../utils/blockchain/dto/network.dto";

export enum UpdateState {
  Full,
  Partial,
  isUpdating,
}

@Entity()
@Unique(["network", "user"])
export class WalletContent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  user: string;

  @ManyToMany(() => CW721Token)
  @JoinTable()
  ownedTokens: CW721Token[];

  @Column({
    type: "enum",
    enum: UpdateState,
    default: UpdateState.isUpdating,
  })
  state: UpdateState;

  @Column({ nullable: true, type:"bigint" })
  externalOldestTx: number;

  @Column({ nullable: true, type:"bigint" })
  externalNewestTx: number;

  @Column({ nullable: true, type:"bigint" })
  internalOldestTx: number;

  @Column({ nullable: true, type:"bigint" })
  internalNewestTx: number;

  @Column({ nullable: true, type:"bigint"})
  lastUpdateStartTime: number;

  reset() {
    this.ownedTokens = [];
    this.state = UpdateState.isUpdating;
    this.externalNewestTx = null;
    this.externalOldestTx = null;
    this.internalOldestTx = null;
    this.internalNewestTx = null;
  }
}

export class WalletContentTransactions {
  oldestTx: number;
  newestTx: number;
}
