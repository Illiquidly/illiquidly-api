import {
  LCDClient,
  Coins,
  MnemonicKey,
  Wallet,
  MsgSend,
  MsgExecuteContract,
  isTxError,
  MsgStoreCode,
  MsgInstantiateContract,
  CreateTxOptions,
} from "@terra-money/terra.js";
import * as fs from "fs";
import Axios from "axios";
import { Network } from "./dto/network.dto";
import { chains } from "./chains";

// Wrapper for Query and Transaction objects (used to build a common Proxy on top of them)
class LCDClientWrapper {
  terra: LCDClient;
  wallet: Wallet;
  contractAddress: string;
  constructor(terra: LCDClient, wallet: Wallet, contractAddress: string) {
    this.terra = terra;
    this.wallet = wallet;
    this.contractAddress = contractAddress;
  }
  execute(msgName: string, msgArgs: any, otherArgs: any) {
    console.log("execute not implemented");
  }
}

/// Execute Msg Handler
/// Removes a lot of code overhead
class Transaction extends LCDClientWrapper {
  async post(msgs: any[]) {
    const postMsg = { msgs: msgs };

    const tx = await this.wallet.createAndSignTx(postMsg);
    return await this.terra.tx.broadcast(tx);
  }

  async execute(msgName: string, msgArgs: any, otherArgs: any = {}) {
    const msg = {
      [msgName]: {
        ...msgArgs,
      },
    };
    const execute = new MsgExecuteContract(
      this.wallet.key.accAddress, // sender
      this.contractAddress, // contract account address
      { ...msg }, // handle msg,
      otherArgs, // sent funds
    );
    const response = await this.post([execute]).catch((response: any) => {
      if (isTxError(response)) {
        throw new Error(
          `store code failed. code: ${response.code}, codespace: ${response.codespace}, raw_log: ${response.raw_log}`,
        );
      } else {
        console.log(response["response"]["data"]);
        throw new Error(`Transaction failed`);
      }
    });
    return response;
  }
  async executeSome(msgs: any[]) {
    const response = await this.post(msgs).catch((response: any) => {
      if (isTxError(response)) {
        throw new Error(
          `store code failed. code: ${response.code}, codespace: ${response.codespace}, raw_log: ${response.raw_log}`,
        );
      } else {
        console.log(response["response"]["data"]);
      }
    });
    return response;
  }
}
/// Query Msg Handler
/// Removes a lot of code overhead
class Query extends LCDClientWrapper {
  async execute(msgName: string, msgArgs: any) {
    const msg = { [msgName]: { ...msgArgs } };
    const response = await this.terra.wasm.contractQuery(this.contractAddress, msg);
    return response;
  }
}

// Internal
// Used to trick the TypeScript compiler into thinking all proxy methods exist
interface Interface {
  [key: string]: any;
}

/// Allows one to query and execute contracts without too much overhead
class Contract {
  execute: Interface;
  query: Interface;
  address: string;

  constructor(handler: Address, contractAddress: string) {
    this.execute = createWrapperProxy(
      new Transaction(handler.terra, handler.wallet, contractAddress),
    );
    this.query = createWrapperProxy(new Query(handler.terra, handler.wallet, contractAddress));
    this.address = contractAddress;
  }
}

/// Wrapper around a (LCDClient, Wallet) pair.
/// Stores every needed info in the same place and allows for easy contract creation/interaction
export class Address {
  terra: LCDClient;
  wallet: Wallet;

  constructor(mnemonic = "", network: Network) {
    this.terra = new LCDClient(chains[network]);
    const mk = new MnemonicKey({
      mnemonic: mnemonic,
    });
    this.wallet = this.terra.wallet(mk);
  }
  async post(msgs: any[]) {
    const postMsg = { msgs: msgs };
    const tx = await this.wallet.createAndSignTx(postMsg);
    return await this.terra.tx.broadcast(tx);
  }
  getAddress(): string {
    return this.wallet.key.accAddress;
  }
  getContract(contractAddress: string): Interface {
    return new Contract(this, contractAddress);
  }
  async send(address: string, coins: Coins.Input) {
    const send = new MsgSend(this.wallet.key.accAddress, address, coins);
    return await this.post([send]);
  }
  async uploadContract(binaryFile: string) {
    const storeCode = new MsgStoreCode(
      this.wallet.key.accAddress,
      fs.readFileSync(binaryFile).toString("base64"),
    );
    const storeCodeTxResult = await this.post([storeCode]);
    if (isTxError(storeCodeTxResult)) {
      throw new Error(
        `store code failed. code: ${storeCodeTxResult.code}, codespace: ${storeCodeTxResult.codespace}, raw_log: ${storeCodeTxResult.raw_log}`,
      );
    }
    const {
      store_code: { codeId },
    } = storeCodeTxResult.logs[0].eventsByType;
    return codeId;
  }
  async instantiateContract(codeId: number, initMsg: any) {
    const instantiate = new MsgInstantiateContract(
      this.wallet.key.accAddress,
      this.wallet.key.accAddress,
      codeId, // code ID
      initMsg,
      {}, // init coins,
      "initContract",
    );
    const instantiateTxResult = await this.post([instantiate]);

    if (isTxError(instantiateTxResult)) {
      throw new Error(
        `instantiate failed. code: ${instantiateTxResult.code}, codespace: ${instantiateTxResult.codespace}, raw_log: ${instantiateTxResult.raw_log}`,
      );
    }
  }

  async estimateFee(msgs: any[]) {
    const { data: gasPrices } = await Axios.get("https://phoenix-fcd.terra.dev/v1/txs/gas_prices");
    const txOptions: CreateTxOptions = {
      msgs,
      memo: "",
      gasPrices,
      gasAdjustment: 1.75,
    };
    const accountInfo = await this.terra.auth.accountInfo(this.wallet.key.accAddress);
    // Test raw estimate fee function with specified gas
    const rawFee = await this.terra.tx.estimateFee(
      [
        {
          sequenceNumber: accountInfo.getSequenceNumber(),
          publicKey: accountInfo.getPublicKey(),
        },
      ],
      txOptions,
    );
    return rawFee;
  }
}

/// Allows the messages to be called via methods instead of wrapped objects
function createWrapperProxy<T extends LCDClientWrapper>(wrapper: T): Interface {
  const handler = {
    get: function (target: T, prop: string, receiver: any) {
      if (!(prop in target))
        return function (args: any, otherArgs: any) {
          return target.execute(prop.toString(), args, otherArgs);
        };
      else return Reflect.get(target, prop);
    },
  };
  return new Proxy(wrapper, handler);
}
