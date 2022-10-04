import { Module, DynamicModule } from "@nestjs/common";
import { RedisLockService } from "./redisLock.service";

@Module({
  imports: [],
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class RedisLockModule {
  static register(): DynamicModule {
    return {
      module: RedisLockModule,
      providers: [],
    };
  }
}
