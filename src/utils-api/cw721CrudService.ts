import { Injectable } from "@nestjs/common";
import { TypeOrmCrudService } from "@rewiko/crud-typeorm";

import { InjectRepository } from "@nestjs/typeorm";
import { CW721Collection, CW721Token } from "./entities/nft-info.entity";

import { CrudRequestOptions, Override } from "@rewiko/crud";
import { ParsedRequestParams } from "@rewiko/crud-request";
import { Repository, SelectQueryBuilder } from "typeorm";


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

export class CW721TokenInContractTypeOrmCrudService extends TypeOrmCrudService<CW721Token> {
  
  constructor(@InjectRepository(CW721Token) repo: Repository<CW721Token>) {
    super(repo);
  }

  @Override()
   public async createBuilder(
    parsed: ParsedRequestParams,
    options: CrudRequestOptions,
    many = true,
    withDeleted = false,
  ): Promise<SelectQueryBuilder<CW721Token>> {
    const builder = await super.createBuilder(parsed, options, many, withDeleted);
     // We add the builder join
    builder
      .innerJoin(
        "trade_info_orm_cw721_assets_cw721_token",
        "token_join",
        `token_join.cw721_token_id = ${this.alias}.id`,
      )
      .innerJoin("trade_info_orm", "tradeInfo", "tradeInfo.id = token_join.trade_info_orm_id")
      //and their metadata
      .leftJoinAndSelect(`${this.alias}.collection`, "token_collection")
      return builder
   }
}

export class CW721TokenInTradeCrudService extends CW721TokenInContractTypeOrmCrudService {

  @Override()
   public async createBuilder(
    parsed: ParsedRequestParams,
    options: CrudRequestOptions,
    many = true,
    withDeleted = false,
  ): Promise<SelectQueryBuilder<CW721Token>> {
    const builder = await super.createBuilder(parsed, options, many, withDeleted);
      // We add the trade join
      builder.innerJoin("tradeInfo.trade", "trade")
      return builder
   }
}

export class CW721TokenInCounterTradeCrudService extends CW721TokenInContractTypeOrmCrudService {



  @Override()
   public async createBuilder(
    parsed: ParsedRequestParams,
    options: CrudRequestOptions,
    many = true,
    withDeleted = false,
  ): Promise<SelectQueryBuilder<CW721Token>> {
    const builder = await super.createBuilder(parsed, options, many, withDeleted);
      // We add the trade join
      builder.innerJoin("tradeInfo.counterTrade", "counterTrade")
      return builder
   }
}