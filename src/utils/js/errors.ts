import { NotFoundException } from "@nestjs/common";
import { UpdateMode } from "../../nft-content/dto/get-nft-content.dto";
import { chains } from "../blockchain/chains";

export class NetworkError extends NotFoundException {
  constructor() {
    super(`The requested network doesn't exist. Accepted networks : ${Object.keys(chains)}`);
  }
}

export class WrongModeError extends NotFoundException {
  constructor() {
    super(`The requested patch mode doesn't exist. Accepted modes : ${Object.values(UpdateMode)}`);
  }
}