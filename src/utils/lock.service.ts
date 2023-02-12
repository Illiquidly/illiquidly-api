import { Inject, Injectable } from "@nestjs/common";
import Redlock from "redlock";
import { ConfigType } from "@nestjs/config";
import { nftContentAPIConfig } from "./configuration.js";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { asyncAction } from "./js/asyncAction.js";

@Injectable()
export class RedLockService {
  redisLock: Redlock;
  nftContentAPIConfig: ConfigType<typeof nftContentAPIConfig>;

  constructor(
    @InjectRedis("lock") readonly redisDB: Redis,
    @Inject(nftContentAPIConfig.KEY) contentConfig: ConfigType<typeof nftContentAPIConfig>,
  ) {
    this.nftContentAPIConfig = contentConfig;
    this.redisLock = new Redlock([redisDB], { retryCount: 1 });
  }

  async acquireLock(lockString: string) {
    return this.redisLock.acquire([lockString], this.nftContentAPIConfig.UPDATE_DESPITE_LOCK_TIME, {
      retryCount: 5,
      retryDelay: 500,
    });
  }

  async doWithLock(lockString: string, callback: () => any) {
    const [err, lock] = await asyncAction(this.acquireLock(lockString));
    let error, response;
    try {
      [error, response] = await asyncAction(callback());
    } finally {
      await lock.release();
    }
    if (error) {
      throw error;
    } else {
      return response;
    }
  }
}
