import { Network } from "../../../utils/blockchain/dto/network.dto";

export class NftContractInfo {
  network: Network;
  collectionAddress: string;
  collectionName: string;
  symbol: string;
}
