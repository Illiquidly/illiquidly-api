import { NetworkError, WrongModeError } from "./errors";
import { chains } from "../blockchain/chains";
import { UpdateMode } from "../../nft-content/dto/get-nft-content.dto";
import { Network } from "../blockchain/dto/network.dto";

export function validateRequest(network: Network, mode?: UpdateMode) {
  if (chains[network] == undefined) {
    throw new NetworkError();
  }
  if (mode && mode != UpdateMode.UPDATE && mode != UpdateMode.FORCE_UPDATE) {
    throw new WrongModeError();
  }
}
