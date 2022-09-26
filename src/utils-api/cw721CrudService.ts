import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";

import { InjectRepository } from "@nestjs/typeorm";
import { CW721Collection, CW721Token } from "./entities/nft-info.entity";

@Injectable()
export class CW721CollectionCrudService extends TypeOrmCrudService<CW721Collection> {
  constructor(@InjectRepository(CW721Collection) repo) {
    super(repo);
  }
}

@Injectable()
export class CW721TokenCrudService extends TypeOrmCrudService<CW721Token> {
  constructor(@InjectRepository(CW721Token) repo) {
    super(repo);
  }
}
