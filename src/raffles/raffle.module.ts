import { Module } from "@nestjs/common";
import { RafflesService } from "./raffles.service";
import {
  RafflesController,
  RaffleNotificationController,
  RaffleFavoriteController,
} from "./raffles.controller";
import { UtilsModule } from "../utils-api/utils.module";
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

    RaffleCrudService,
    RaffleNotificationCrudService,
    RaffleFavoriteCrudService,
  ],
  exports: [RafflesService],
})
export class RafflesModule {}
