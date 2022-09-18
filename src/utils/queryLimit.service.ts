import { Injectable } from "@nestjs/common";
const { default: PQueue } = require("p-queue");
import { waitForSignals } from "wait-for-signals";
import { asyncAction } from "./js/asyncAction";
import { chains } from "./blockchain/chains.js";
import { LCDClient } from "@terra-money/terra.js";

@Injectable()
export class QueryLimitService {
  queue;
  constructor() {
    this.queue = new PQueue({ concurrency: 10, interval: 10000000, intervalCap: 100 }); //100req/10s
  }

  private async internalAddToQueue(func: () => Promise<any>): Promise<[any, void]> {
    const collector = waitForSignals({ count: 1 });
    const payload = {
      data: null,
    };

    this.queue.add(async () => {
      payload.data = await func().catch(error => {
        error;
      });
      await collector.signal();
    });
    return Promise.all([payload, collector.promise]);
  }

  private async addToQueue(func: () => Promise<any>) {
    const result = await this.internalAddToQueue(func);
    if (result[0].error) {
      throw result[0].error;
    }
    return result[0].data;
  }

  async sendIndependentQuery(
    networkId: string,
    contractAddress: string,
    query: object,
  ): Promise<any> {
    const lcdClient = new LCDClient(chains[networkId]);

    return this.addToQueue(() => lcdClient.wasm.contractQuery(contractAddress, query));
  }
}
