import { Network } from "./dto/network.dto";
import settenConfig from "./setten-env";

export const chains: any = {
  devnet: {
    URL: "http://localhost:1317",
    chainId: "localterra",
  },
  testnet: {
    URL: "https://pisco-lcd.terra.dev/",
    //URL: `https://lcd.pisco.terra.setten.io/${settenConfig.settenProject}?key=${settenConfig.settenKey}`,
    chainID: "pisco-1",
    /*axiosObject: {
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
    // URL: 'https://phoenix-lcd.terra.dev',
    URL: `https://lcd.phoenix.terra.setten.io/${settenConfig.settenProject}?key=${settenConfig.settenKey}`,
    chainID: "phoenix-1",
    axiosObject: {
      baseURL: `https://lcd.phoenix.terra.setten.io/${settenConfig.settenProject}`,
      params: {
        key: settenConfig.settenKey,
      },
    },
  },
};

export interface Contracts {
  p2pTrade?: string;
  fee?: string;
  fee_distributor?: string;
}

export type AllContracts = {
  [key in Network]: Contracts;
};

export const contracts: AllContracts = {
  devnet: {
    p2pTrade: "terra14dcwvg4zplrc28g5q3802n2mmnp3fsp2yh7mn7gkxssnrjqp4ycq676kqf",
  },
  testnet: {
	p2pTrade: "terra1d3xtfkumcxl6225mhfvgwjt0sql30x5yc0hrap2qdfwfs762aj5sa2we47",
    fee: "terra1f0u8h08a8eyvyg770tkcln6l78080kafrmnlw0f5qd89qcydqv6s0y0wcc",
    fee_distributor: "terra1atf60kd7ckyry2e3mn0txzamjvlhne0fesf6y7zqtj3tf9w5qd9sm03l2j"
  },
  classic: {},
  mainnet: {},
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
