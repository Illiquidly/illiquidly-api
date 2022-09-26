import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";

import { InjectRepository } from "@nestjs/typeorm";
import { Trade, CounterTrade, TradeNotification } from "./entities/trade.entity";

@Injectable()
export class TradeCrudService extends TypeOrmCrudService<Trade> {
  constructor(@InjectRepository(Trade) repo) {
    super(repo);
  }
}

@Injectable()
export class CounterTradeCrudService extends TypeOrmCrudService<CounterTrade> {
  constructor(@InjectRepository(CounterTrade) repo) {
    super(repo);
  }
}

@Injectable()
export class TradeNotificationCrudService extends TypeOrmCrudService<TradeNotification> {
  constructor(@InjectRepository(TradeNotification) repo) {
    super(repo);
  }
}
