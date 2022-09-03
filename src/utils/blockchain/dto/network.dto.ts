import { IsEnum } from "class-validator";

export enum Network {
  mainnet = "mainnet",
  testnet = "testnet",
  devnet = "devnet",
  classic = "classic",
}

export class NetworkParam {
  @IsEnum(Network)
  network: Network;
}
