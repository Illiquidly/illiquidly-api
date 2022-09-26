import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
} from "typeorm";
import { Network } from "../../utils/blockchain/dto/network.dto";

@Entity()
export class ValuedCoin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  denom: string;

  @Column()
  amount: number;
}

@Entity()
@Unique(["network", "coinAddress"])
export class CW20Coin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  coinAddress: string;

  @Column()
  coinName: string;

  @Column()
  symbol: string;

  @Column()
  decimals: string;
}

@Entity()
export class ValuedCW20Coin {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CW20Coin)
  cw20Coin: CW20Coin;

  @Column()
  amount: number;
}

@Entity()
@Unique(["network", "collectionAddress"])
export class CW721Collection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @PrimaryColumn({ name: "collection_address" })
  collectionAddress: string;

  @Column({ name: "collection_name", default: "" })
  collectionName: string;

  @Column({ default: "" })
  symbol: string;

  @OneToMany(() => CW721Token, token => token.collection, { cascade: true })
  tokens: Relation<CW721Token>[];
}

@Entity()
@Unique(["network", "collectionAddress"])
export class CW1155Collection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: Network,
  })
  network: Network;

  @Column()
  collectionAddress: string;

  @Column()
  collectionName: string;

  @Column()
  symbol: string;

  @OneToMany(() => CW1155Token, token => token.collection)
  tokens: CW1155Token[];
}

@Entity()
@Unique(["tokenId", "collection"])
export class CW721Token {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "token_id" })
  tokenId: string;

  @ManyToOne(() => CW721Collection, nft => nft.tokens)
  collection: CW721Collection;

  @OneToOne(() => CW721TokenMetadata, {
    cascade: true,
  })
  @JoinColumn()
  metadata: Relation<CW721TokenMetadata>;

  @Column({ type: "text" })
  allNftInfo: string;
}

@Entity()
export class CW721TokenMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", name: "token_uri", nullable: true })
  tokenUri: string;

  @Column({ type: "text", nullable: true })
  image: string;

  @Column({ type: "text", nullable: true })
  imageData: string;

  @Column({ type: "text", nullable: true })
  externalUrl: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text", nullable: true })
  name: string;

  @Column({ type: "text", nullable: true })
  backgroundColor: string;

  @Column({ type: "text", nullable: true })
  animationUrl: string;

  @Column({ type: "text", nullable: true })
  youtubeUrl: string;

  @OneToMany(() => CW721TokenAttribute, attribute => attribute.metadata, {
    cascade: true,
  })
  @JoinColumn()
  attributes: Relation<CW721TokenAttribute>[];
}

@Entity()
export class CW721TokenAttribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  displayType: string;

  @Column()
  traitType: string;

  @Column()
  value: string;

  @ManyToOne(() => CW721TokenMetadata, metadata => metadata.attributes, {
    onDelete: "CASCADE",
  })
  metadata: Relation<CW721TokenMetadata>;
}

@Entity()
export class CW1155Token {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tokenId: string;

  @Column()
  amount: number;

  @ManyToOne(() => CW1155Collection, collection => collection.tokens)
  collection: CW1155Collection;
}
