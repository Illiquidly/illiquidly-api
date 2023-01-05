import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { NftTransferService } from "../nft-transfer.service";
import { NFTTransferTransaction } from "../entities/nft-transfer.entity";
import { NFTTransferResponse } from "../dto/get-nft-transfer.dto";
import { UtilsService } from "../../utils-api/utils.service";
const pMap = require("p-map");

@Injectable()
export class NFTTransferResultInterceptor implements NestInterceptor {
  constructor(
    private readonly nftTransferService: NftTransferService,
    private readonly utilsService: UtilsService,
  ) {}

  async getAdditionalInfo(
    context: ExecutionContext,
    data: NFTTransferTransaction[],
  ): Promise<NFTTransferResponse[]> {
    return pMap(data, async (tx: NFTTransferTransaction): Promise<NFTTransferResponse> => {
      return this.nftTransferService.parseNFTTransferTransactionDBToResponse(tx);
    });
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    return next.handle().pipe(
      map(async res => {
        const { data, ...meta } = res;
        if (res?.data) {
          // First we get all the raffle Info needed (what arrives is only an object with an id)
          const parsedRaffles = await this.getAdditionalInfo(context, data);

          // Then we return the whole data
          return {
            data: parsedRaffles,
            ...meta,
          };
        } else if (Array.isArray(res)) {
          return this.getAdditionalInfo(context, res);
        } else {
          return await this.getAdditionalInfo(context, [res]);
        }
      }),
    );
  }
}
