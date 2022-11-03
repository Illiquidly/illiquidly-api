import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { NftContentModule } from "./nft-content/nft-content.module";
import { UtilsModule } from "./utils-api/utils.module";
import { TradesModule } from "./trades/trades.module";
import { KnexModule } from "nestjs-knex";
import { RedisModule } from "@liaoliaots/nestjs-redis";
import { TypeOrmModule } from "@nestjs/typeorm";
import { typeOrmOptions } from "./utils/typeormOptions";
import { ChainListenerModule } from "./chain-listener/chain-listener.module";
import { AppLoggerMiddleware } from "./utils/request-logger";
import { RafflesModule } from "./raffles/raffle.module";
import { ScheduleModule } from "@nestjs/schedule";
import { NftTransferModule } from "./nft-transfers/nft-transfer.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NftContentModule,
    UtilsModule,
    TradesModule,
    RafflesModule,
    ChainListenerModule,
    NftTransferModule,
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
    RedisModule.forRoot({
      config: [
        { namespace: "lock" },
        { namespace: "default-client" },
        { namespace: "trade-subscriber" },
        { namespace: "trade-notification-subscriber" },
        { namespace: "raffle-subscriber" },
        { namespace: "raffle-notification-subscriber" },
        { namespace: "trade-publisher" },
      ],
    }),
    TypeOrmModule.forRoot({
      ...typeOrmOptions,
      type: "mysql",
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes("*");
  }
}
