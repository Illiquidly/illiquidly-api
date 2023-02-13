import { CW721Token } from "../../utils-api/entities/nft-info.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Network } from "../../utils/blockchain/dto/network.dto";

export enum UpdateState {
  Full,
  Partial,
  isUpdating,
}

@Entity()
export class NFTTransferTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  blockHeight: number;

  @Column()
  date: Date;

  @Column()
  txHash: string;

  @Column()
  memo: string;

  @OneToMany(() => NFTTransfer, transfer => transfer.tx, {
    cascade: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  sentAssets: NFTTransfer[];
}

@Entity()
export class NFTTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => NFTTransferTransaction, tx => tx.sentAssets)
  tx: NFTTransferTransaction;

  @Column()
  sender: string;

  @Column()
  recipient: string;

  @ManyToOne(() => CW721Token)
  @JoinColumn()
  cw721Token: CW721Token;
}
