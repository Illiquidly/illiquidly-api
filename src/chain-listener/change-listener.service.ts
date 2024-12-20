import { Network } from "../utils/blockchain/dto/network.dto";
import Redis from "ioredis";
import { QueueMessage } from "./websocket-listener.service";
import { sleep } from "../utils/js/sleep";
import { Logger } from "@nestjs/common";

export abstract class ChangeListenerService {
  redisHashSetName: string;

  readonly logger = new Logger(ChangeListenerService.name);
  constructor(
    readonly redisSubscriber: Redis,
    readonly redisDB: Redis,
    queueName: string,
    queueMessage: string,
    redisHashSetName: string,
  ) {
    this.redisHashSetName = redisHashSetName;
    // We subsribe to the redis reg-sub channel
    this.redisSubscriber.subscribe(queueName, (err: any) => {
      if (err) {
        // Just like other commands, subscribe() can fail for some reasons,
        // ex network issues.
        this.logger.error("Failed to subscribe: %s", err.message);
      } else {
        // `count` represents the number of channels this client are currently subscribed to.
        this.logger.log(
          `Subscribed successfully! This client is currently subscribed to the ${redisHashSetName} channel.`,
        );
      }
    });

    const isAlreadyQuerying = {};
    this.redisSubscriber.on("message", async (channel, message) => {
      if (channel == queueName) {
        const parsedMessage: QueueMessage = JSON.parse(message);
        if (parsedMessage.message == queueMessage && !isAlreadyQuerying[parsedMessage.network]) {
          /*
          this.logger.log(
            `New Trade Message Received by ${redisHashSetName}`,
            new Date().toLocaleString(),
          );
          */
          isAlreadyQuerying[parsedMessage.network] = true;
          // We await 2 seconds for the fcd to update
          await sleep(2000);
          await this.queryNewTransaction(parsedMessage.network);
          isAlreadyQuerying[parsedMessage.network] = false;
        }
      }
    });
  }

  getSetName(network: Network) {
    return `${this.redisHashSetName}-${network}`;
  }

  async getHashSetCardinal(network: Network) {
    return await this.redisDB.scard(this.getSetName(network));
  }

  async hasTx(network: Network, txHash: string): Promise<boolean> {
    return (await this.redisDB.sismember(this.getSetName(network), txHash)) == 1;
  }

  abstract queryNewTransaction(network: Network);
}
