import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Raffle } from "../../raffles/entities/raffle.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { HttpCachingChain, HttpChainClient, fetchBeacon, ChainedBeacon } from "./beacon";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { chains, contracts } from "../../utils/blockchain/chains";
import { Network } from "../../utils/blockchain/dto/network.dto";
import { Address } from "../../utils/blockchain/terra_utils";
import { signingTerraConfig } from "../../utils/configuration";
import { ConfigType } from "@nestjs/config";
import { asyncAction } from "../../utils/js/asyncAction";
import { RafflesService } from "../../raffles/raffles.service";
const pMap = require("p-map");

@Injectable()
export class RandomnessProviderService {
  signingTerraConfig: ConfigType<typeof signingTerraConfig>;
  private readonly logger = new Logger(RandomnessProviderService.name);

  constructor(
    @InjectRepository(Raffle) private rafflesRepository: Repository<Raffle>,
    private readonly rafflesService: RafflesService,
    @Inject(signingTerraConfig.KEY) queueConfig: ConfigType<typeof signingTerraConfig>,
  ) {
    this.signingTerraConfig = queueConfig;
  }

  async getBeacon(): Promise<ChainedBeacon> {
    const chainHash = "8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce"; // (hex encoded)
    const publicKey =
      "868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31"; // (hex encoded)

    const options = {
      disableBeaconVerification: false, // `true` disables checking of signatures on beacons - faster but insecure!!!
      noCache: true, // `true` disables caching when retrieving beacons for some providers
      chainVerificationParams: { chainHash, publicKey }, // these are optional, but recommended! They are compared for parity against the `/info` output of a given node
    };

    // if you want to connect to a single chain to grab the latest beacon you can simply do the following
    const chain = new HttpCachingChain("https://api.drand.sh", options);
    const client = new HttpChainClient(chain, options);
    return fetchBeacon(client);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async provideRandomness() {
    // 1. We query all raffles with a closed status and no randomness in the database

    const closedRaffles: {
      raffle_id: string,
      network: Network
    }[] = await this.rafflesRepository
      .createQueryBuilder("raffle")
      .select("raffle.raffle_id, raffle.network ")
      .where("state = 'closed' AND randomness_owner IS NULL")
      .innerJoin("raffle.participants","participants")
      .distinct(true)
      .getRawMany()

    const nbRaffles = closedRaffles.length;

    // 2. We look for the latests randomness
    if (!nbRaffles) {
      this.logger.log("No randomness to provide, sorry :/");
      return;
    }

    const beacon = await this.getBeacon();

    pMap(Object.keys(chains), async (network: Network) => {
      if (!this.signingTerraConfig[network] || this.signingTerraConfig[network] == "") {
        return;
      }
      const mnemonic = this.signingTerraConfig[network];
      const handler = new Address(mnemonic, network);

      const updateMessages = closedRaffles
        .filter(raffle => raffle.network == network)
        .map(raffle => {
          const executeMsg = {
            update_randomness: {
              raffle_id: raffle.raffle_id,
              randomness: {
                round: beacon.round,
                signature: Buffer.from(beacon.signature, "hex").toString("base64"),
                previous_signature: Buffer.from(beacon.previous_signature, "hex").toString(
                  "base64",
                ),
              },
            },
          };
          return new MsgExecuteContract(
            handler.wallet.key.accAddress, // sender
            contracts[network].raffle, // contract account address
            executeMsg, // handle msg,
          );
        });
      if (updateMessages.length) {
        const [error, response] = await asyncAction(handler.post(updateMessages));
        if (error) {
          this.logger.error(error);

          // If there is an error, we need to update the raffle
          return pMap(closedRaffles, (raffle)=>{
            return this.rafflesService.updateRaffleAndParticipants(network, raffle.raffle_id)

          })
        }
        this.logger.log(`Posted transaction for raffle randomness : ${JSON.stringify(response)}`);
      }
    });
  }
}
