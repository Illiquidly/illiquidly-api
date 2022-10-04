import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { InjectRedis } from "@liaoliaots/nestjs-redis";

@Injectable()
export class RedisLockService {
  public readonly uuid: string = RedisLockService.generateUuid();

  constructor(@InjectRedis("lock") private readonly client: Redis) {}

  private prefix(name: string): string {
    return `lock:${name}`;
  }

  private getClient(): Redis {
    return this.client;
  }

  /**
   * Generate a uuid for identify each distributed node
   */
  private static generateUuid(): string {
    let d = Date.now();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c: string) => {
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /**
   * Try to lock once
   * @param {string} name lock name
   * @param {number} [expire] milliseconds, TTL for the redis key
   * @returns {boolean} true: success, false: failed
   */
  public async lockOnce(name, expire) {
    const client = this.getClient();
    const result = await client.set(this.prefix(name), this.uuid, "PX", expire, "NX");
    return result !== null;
  }

  /**
   * Get a lock, automatically retrying if failed
   * @param {string} name lock name
   * @param {number} [retryInterval] milliseconds, the interval to retry if failed
   * @param {number} [maxRetryTimes] max times to retry
   */
  public async lock(
    name: string,
    expire = 60000,
    retryInterval = 100,
    maxRetryTimes = 36000,
  ): Promise<void> {
    let retryTimes = 0;
    while (true) {
      if (await this.lockOnce(name, expire)) {
        break;
      } else {
        await this.sleep(retryInterval);
        if (retryTimes >= maxRetryTimes) {
          throw new Error(`RedisLockService: locking ${name} timed out`);
        }
        retryTimes++;
      }
    }
  }

  /**
   * Unlock a lock by name
   * @param {string} name lock name
   */
  public async unlock(name) {
    const client = this.getClient();
    await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      this.prefix(name),
      this.uuid,
    );
  }

  /**
   * Set TTL for a lock
   * @param {string} name lock name
   * @param {number} milliseconds TTL
   */
  public async setTTL(name, milliseconds) {
    const client = this.getClient();
    await client.pexpire(this.prefix(name), milliseconds);
  }

  /**
   * @param {number} ms milliseconds, the sleep interval
   */
  public sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, Number(ms)));
  }
}
