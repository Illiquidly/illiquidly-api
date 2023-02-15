import { Network } from "./dto/network.dto.js";
import { Injectable } from "@nestjs/common";
import { QueryLimitService } from "../queryLimit.service.js";

@Injectable()
export class RawLCDQuery {
  constructor(private readonly queryLimitService: QueryLimitService) {}

  async sendIndependentQuery(
    networkId: string,
    contractAddress: string,
    query: object,
  ): Promise<any> {
    return this.queryLimitService.sendIndependentQuery(networkId, contractAddress, query);
  }

  async getBlockHeight(network: Network) {
    const blockInfo = await this.queryLimitService.getBlockHeight(network);
    return blockInfo.block.header.height;
  }

  async getOneTxResult(network: Network, events: any[], offset: number | undefined) {
    return this.queryLimitService.sendEventsSearchQuery(network, {
      events,
      "pagination.limit": "100",
      "pagination.offset": offset?.toString() ?? "0",
      "pagination.reverse": "true",
    });
  }

  async getAllTxResults(
    network: Network,
    events: any[],
    offsetCallback: (txs: any[]) => Promise<number>,
    filterCallBack: (txs: any[]) => Promise<any>,
    callback: (txs: any[]) => Promise<void> = async () => undefined,
  ) {
    let total = undefined;
    let offset = await offsetCallback([]);

    /*
    const test = JSON.parse(fs.readFileSync("test.json"));
    callback(test.txs);
    return;
    */

    do {
      const transactions = await this.getOneTxResult(network, events, offset);

      if (!transactions.txs) {
        console.error("Couldn't query transactions", transactions);
      }

      const filteredTransactions = await filterCallBack(transactions.txs);
      // We treat the transactions in the callback
      await callback(filteredTransactions);

      // We query the next offset
      offset = await offsetCallback(filteredTransactions);
      total = transactions.pagination.total;
      console.log(offset, total);
      //fs.writeFileSync("test.json", JSON.stringify(transactions));
    } while (offset < total);
  }
}
