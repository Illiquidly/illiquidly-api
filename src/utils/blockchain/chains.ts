import settenConfig from "./setten-env";

export const chains: any = {
  devnet: {
    URL: "http://localhost:1317",
    chainId: "localterra",
  },
  testnet: {
    //URL: 'https://pisco-lcd.terra.dev/',
    URL: `https://lcd.pisco.terra.setten.io/${settenConfig.settenProject}?key=${settenConfig.settenKey}`,
    chainID: "pisco-1",
  },
  classic: {
    URL: "https://columbus-lcd.terra.dev",
    chainID: "columbus-5",
  },
  mainnet: {
    //URL: 'https://phoenix-lcd.terra.dev',
    URL: `https://lcd.phoenix.terra.setten.io/${settenConfig.settenProject}?key=${settenConfig.settenKey}`,
    chainID: "phoenix-1",
  },
};

export const contracts: any = {
  devnet : {
    p2pTrade: "",
  },
  testnet : {
    p2pTrade: "terra1cg8s5umfw8mhrv3xa7q7rxjpqwaj9gj9lvxzwwna3yr79m6ye5aqx6fq8h",
  },
  classic : {
    p2pTrade: "",
  },
  mainnet : {
    p2pTrade: "",
  }
}




export let fcds: any = {
  testnet: "https://pisco-fcd.terra.dev",
  classic: "https://columbus-fcd.terra.dev",
  mainnet: "https://phoenix-fcd.terra.dev",
};

export const registeredNftContracts: any = "https://assets.terra.money/cw721/contracts.json";
