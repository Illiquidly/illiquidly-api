import { Module } from "@nestjs/common";
import { RafflesService } from "./raffles.service";
import {
  RafflesController,
  RaffleNotificationController,
  RaffleFavoriteController,
} from "./raffles.controller";
import { UtilsService } from "../utils-api/utils.service";
import { UtilsModule } from "../utils-api/utils.module";
import { QueryLimitService } from "../utils/queryLimit.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "../utils/entities";
import {
  RaffleCrudService,
  RaffleFavoriteCrudService,
  RaffleNotificationCrudService,
} from "./raffleCrud.service";

@Module({
  imports: [UtilsModule, TypeOrmModule.forFeature(Entities)],
  controllers: [RafflesController, RaffleNotificationController, RaffleFavoriteController],
  providers: [
    RafflesService,
    UtilsService,
    QueryLimitService,
    RaffleCrudService,
    RaffleNotificationCrudService,
    RaffleFavoriteCrudService,
  ],
})
export class RafflesModule {}
