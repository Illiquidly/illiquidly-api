import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";

import { InjectRepository } from "@nestjs/typeorm";
import { Raffle, RaffleFavorite, RaffleNotification } from "./entities/raffle.entity";
import { AbstractFilterToSelectCrudService } from "../trades/tradeCrud.service";

@Injectable()
export class RaffleCrudService extends AbstractFilterToSelectCrudService<Raffle> {
  constructor(@InjectRepository(Raffle) repo) {
    super(repo);
  }
}

@Injectable()
export class RaffleNotificationCrudService extends TypeOrmCrudService<RaffleNotification> {
  constructor(@InjectRepository(RaffleNotification) repo) {
    super(repo);
  }
}

@Injectable()
export class RaffleFavoriteCrudService extends TypeOrmCrudService<RaffleFavorite> {
  constructor(@InjectRepository(RaffleFavorite) repo) {
    super(repo);
  }
}
