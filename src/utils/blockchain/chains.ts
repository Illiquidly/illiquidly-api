import { Network } from "./dto/network.dto";
import settenConfig from "./setten-env";

export const chains: any = {
  devnet: {
    URL: "http://localhost:1317",
    chainId: "localterra",
  },
  testnet: {
    URL: "https://pisco-lcd.terra.dev/",
    chainID: "pisco-1",
    /*
    URL: `https://lcd.pisco.terra.setten.io/${settenConfig.settenProject}/?key=${settenConfig.settenKey}`,
    axiosObject: {
      baseURL: `https://lcd.pisco.terra.setten.io/${settenConfig.settenProject}`,
      params: {
        key: settenConfig.settenKey,
      },
    },
    */
  },
  classic: {
    URL: "https://columbus-lcd.terra.dev",
    chainID: "columbus-5",
  },
  mainnet: {
    URL: "https://phoenix-lcd.terra.dev",
    chainID: "phoenix-1",
    /*
    URL: `https://lcd.phoenix.terra.setten.io/${settenConfig.settenProject}/?key=${settenConfig.settenKey}`,
    axiosObject: {
      baseURL: `https://lcd.phoenix.terra.setten.io/${settenConfig.settenProject}`,
      params: {
        key: settenConfig.settenKey,
      },
    },
    */
  },
};

export interface Contracts {
  p2pTrade?: string;
  fee?: string;
  fee_distributor?: string;
  raffle?: string;
  loan?: string;
}

export type AllContracts = {
  [key in Network]: Contracts;
};

export const contracts: AllContracts = {
  devnet: {},
  testnet: {
    p2pTrade: "terra1405pwjpdl629uemdqaf57gf765ufv7y3e2xszch4y8zhhwczapwsse2eh0",
    fee: "terra1uh0vx5eh5tu49g5hw98r622m805vg533j3kjf8c2mtqhz6qfyyxqms5tmw",
    fee_distributor: "terra1dnlq6uxmmqn56uspjh9wecc5mcu56hq5ckvzd90tmfqfn36paa6sfr6llq",
    raffle: "terra1vmrf7z6yr34rgpkkv2yk0t28hdlfzwunql9ldusum9cc8ef272ksy6kjgz",
    loan: "terra1md0gr59dy0fuzf6qqllz550evqqamr0f0q38gcfy2cnrc70y2rtqduxpmq",
  },
  classic: {},
  mainnet: {
    p2pTrade: "terra1vvwcxnrhzvwjw7c0t7ks3pe0fvj82rcyrmpsejj22csg0rawpc9qs9fyv4",
    fee: "terra14j02llvrly27dzw9zqumfql9uw5ea3kl0f0wujp42p8uq7g8w67srcyfdw",
    fee_distributor: "terra1vjyhmjnj79xlzk2s3n6k06wxmg0h8djkq27cwvmduhq62qcqq4tq4ff3t8",
    raffle: "terra1655tux08qla5rsl7w55xwx9nu4km9wuguy90ghqjxmcuh0c3zksq6jae9v",
  },
};

export const fcds: any = {
  testnet: "https://pisco-fcd.terra.dev",
  classic: "https://columbus-fcd.terra.dev",
  mainnet: "https://phoenix-fcd.terra.dev",
};

export const ws: any = {
  devnet: "ws://localhost:26657/websocket",
  testnet: `wss://rpc.pisco.terra.setten.io/${settenConfig.settenProject}/websocket?key=${settenConfig.settenKey}`,
  mainnet: `wss://rpc.phoenix.terra.setten.io/${settenConfig.settenProject}/websocket?key=${settenConfig.settenKey}`,
};

export const registeredNftContracts: any = "https://assets.terra.money/cw721/contracts.json";
