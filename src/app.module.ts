import { Module } from "@nestjs/common";
import { NftContentModule } from "./nft-content/nft-content.module";
import { UtilsModule } from "./utils-api/utils.module";
import { TradesModule } from "./trades/trades.module";
import { KnexModule } from "nestjs-knex";
import { RedisModule } from "nestjs-redis";
import { RedisLockModule } from "nestjs-simple-redis-lock";
import { TypeOrmModule } from "@nestjs/typeorm";
import { typeOrmOptions } from "./utils/typeormOptions";

@Module({
  imports: [
    NftContentModule,
    UtilsModule,
    TradesModule,
    KnexModule.forRoot({
      config: {
        client: "mysql2",
        useNullAsDefault: true,
        connection: {
          host: "127.0.0.1",
          user: "illiquidly",
          password: "illiquidly",
          database: "ILLIQUIDLY",
        },
      },
    }),
    RedisModule.register({}),
    RedisLockModule,
    TypeOrmModule.forRoot({
      ...typeOrmOptions,
      type: "mysql",
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
