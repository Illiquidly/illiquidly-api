import { Injectable } from "@nestjs/common";
import { waitForSignals } from "wait-for-signals";
import { chains } from "./blockchain/chains.js";
import { BlockInfo, LCDClient } from "@terra-money/terra.js";
import PQueue from "p-queue";

@Injectable()
export class QueryLimitService {
  queue: PQueue;
  constructor() {
    /// We limit the requests to :
    /// 10 simultaneous requests
    /// 1 requests every consecutive 0.111 seconds (setten limits to 100/ 10 secs + cloudflare limits the requests that are too sudden)

    this.queue = new PQueue({ concurrency: 10, interval: 111, intervalCap: 1 }); //100req/10s
  }

  private async internalAddToQueue(func: () => Promise<any>): Promise<[any, void]> {
    const collector = waitForSignals({ count: 1 });
    const payload = {
      data: null,
    };

    this.queue.add(async () => {
      payload.data = await func().catch(error => error);
      await collector.signal();
    });
    return Promise.all([payload, collector.promise]);
  }

  private async addToQueue(func: () => Promise<any>) {
    const result = await this.internalAddToQueue(func);

    // We verify the number of elements in the queue
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
    console.log("One Contract LCD QUERY");
    const lcdClient = new LCDClient(chains[networkId]);
    return this.addToQueue(() => lcdClient.wasm.contractQuery(contractAddress, query));
  }

  async sendEventsSearchQuery(networkId: string, query: any): Promise<any> {
    console.log("One LCD QUERY");
    const lcdClient = new LCDClient(chains[networkId]);
    console.log(query);
    return this.addToQueue(() => lcdClient.tx.search(query));
  }

  async getBlockHeight(networkId: string): Promise<BlockInfo> {
    const lcdClient = new LCDClient(chains[networkId]);
    return this.addToQueue(() => lcdClient.tendermint.blockInfo());
  }
}
