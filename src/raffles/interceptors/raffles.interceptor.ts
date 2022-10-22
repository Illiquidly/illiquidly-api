import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { RafflesService } from "../raffles.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Raffle } from "../entities/raffle.entity";
import { Repository } from "typeorm";
import { RaffleResponse } from "../dto/getRaffles.dto";
const pMap = require("p-map");

@Injectable()
export class RaffleResultInterceptor implements NestInterceptor {
  constructor(
    private readonly rafflesService: RafflesService,
    @InjectRepository(Raffle) private rafflesRepository: Repository<Raffle>,
  ) {}

  async getRaffleInfo(context: ExecutionContext, data: Raffle[]): Promise<RaffleResponse[]> {
    return pMap(
      data,
      async (raffle: Raffle): Promise<RaffleResponse> =>
        this.rafflesService.parseRaffleDBToResponse(raffle.network, raffle),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          // First we get all the raffle Info needed (what arrives is only an object with an id)
          const parsedRaffles = await this.getRaffleInfo(context, data);

          // Then we return the whole data
          return {
            data: parsedRaffles,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return this.getRaffleInfo(context, res);
        } else {
          return await this.getRaffleInfo(context, [res]);
        }
      }),
    );
  }
}
