import { Inject, Injectable } from "@nestjs/common";
import { asyncAction } from "../../utils/js/asyncAction";

import { Network } from "../../utils/blockchain/dto/network.dto";
import Axios from "axios";
import { chains, contracts } from "../../utils/blockchain/chains";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { TxLog } from "@terra-money/terra.js";
import { CW721TokenAttribute } from "../../utils-api/entities/nft-info.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { redisQueueConfig } from "../../utils/configuration";
import { ConfigType } from "@nestjs/config";
import { ChangeListenerService } from "../change-listener.service";
import { LoanNotification, LoanNotificationType } from "../../loans/entities/loan.entity";
import { Offer } from "../../loans/entities/offer.entity";
import { LoansService } from "../../loans/loans.service";
import { UtilsService } from "../../utils-api/utils.service";
const pMap = require("p-map");
const DATE_FORMAT = require("dateformat");

@Injectable()
export class LoanNotificationChangesService extends ChangeListenerService {
  constructor(
    @InjectRedis("loan-notification-subscriber") readonly redisSubscriber: Redis,
    @InjectRedis("default-client") readonly redisDB: Redis,
    @InjectRepository(LoanNotification)
    private loanNotificationRepository: Repository<LoanNotification>,
    @InjectRepository(Offer) private offersRepository: Repository<Offer>,
    private readonly loansService: LoansService,
    private readonly utilsService: UtilsService,
    @Inject(redisQueueConfig.KEY) queueConfig: ConfigType<typeof redisQueueConfig>,
  ) {
    super(
      redisSubscriber,
      redisDB,
      queueConfig.CONTRACT_UPDATE_QUEUE_NAME,
      queueConfig.TRIGGER_LOAN_QUERY_MSG,
      queueConfig.REDIS_LOAN_NOTIFICATION_TXHASH_SET,
    );
  }

  private async createNotification(network: Network, borrower: string, loanId: number, tx: any) {
    const notification: LoanNotification = new LoanNotification();
    notification.network = network;
    notification.time = DATE_FORMAT(tx.timestamp, "yyyy-mm-dd HH:MM:ss");
    const loan = await this.loansService.updateLoan(network, borrower, loanId);
    notification.borrower = borrower;
    notification.loanId = loanId;
    notification.notificationPreview =
      (await this.utilsService.parseTokenPreview(network, loan.loanPreview)) ?? {};
    // We need to make sure we don't send the Metadata back with the attribute
    notification.notificationPreview.cw721Coin.attributes =
      notification.notificationPreview.cw721Coin.attributes.map(
        (attribute: CW721TokenAttribute) => {
          attribute.metadata = null;
          return attribute;
        },
      );
    return notification;
  }

  async queryNewTransaction(network: Network) {
    const lcd = Axios.create(
      chains[network].axiosObject ?? {
        baseURL: chains[network].URL,
      },
    );

    // We loop query the lcd for new transactions on the p2p loan contract from the last one registered, until there is no tx left
    let txToAnalyse = [];
    do {
      // We start querying after we left off
      const offset = await this.getHashSetCardinal(network);
      const [err, response] = await asyncAction(
        lcd.get("/cosmos/tx/v1beta1/txs", {
          params: {
            events: `wasm._contract_address='${contracts[network].loan}'`,
            "pagination.offset": offset,
          },
        }),
      );
      // If we get no lcd tx result
      if (err) {
        this.logger.error(err);
        return;
      }

      // We start by querying only new transactions (We do this in two steps, as the filter function doesn't wait for async results)
      const txFilter = await Promise.all(
        response.data.tx_responses.map(async (tx: any) => !(await this.hasTx(network, tx.txhash))),
      );
      txToAnalyse = response.data.tx_responses.filter((_: any, i: number) => txFilter[i]);
      // Then we iterate over the transactions and get the action it refers to and the necessary information
      const notifications: LoanNotification[] = [];

      await pMap(txToAnalyse, async (tx: any) => {
        await pMap(
          tx.logs,
          async (log: any) => {
            const txLog = new TxLog(log.msg_index, log.log, log.events);
            const contractEvents = txLog.eventsByType.wasm;
            if (contractEvents?.action?.[0] == "make_offer") {
              // If there is a new offer, we notify the owner of the loan
              const loanId = parseInt(contractEvents.loan_id[0]);
              const borrower = contractEvents.borrower[0];
              const notification = await this.createNotification(network, borrower, loanId, tx);
              notification.user = borrower;
              notification.globalOfferId = contractEvents.global_offer_id[0];
              notification.notificationType = LoanNotificationType.newOffer;
              notifications.push(notification);
            } else if (contractEvents?.action?.[0] == "refuse_offer") {
              // If an offer was refused, we notify the owner of the offer
              const loanId = parseInt(contractEvents.loan_id[0]);
              const borrower = contractEvents.borrower[0];
              const notification = await this.createNotification(network, borrower, loanId, tx);
              notification.user = contractEvents.lender[0];
              notification.globalOfferId = contractEvents.global_offer_id[0];
              notification.notificationType = LoanNotificationType.refuseOffer;
              notifications.push(notification);
            } else if (contractEvents?.action?.[0] == "start_loan") {
              const loanId = parseInt(contractEvents.loan_id[0]);
              const borrower = contractEvents.borrower[0];
              const globalOfferId = contractEvents.global_offer_id[0];
              const notification = await this.createNotification(network, borrower, loanId, tx);
              notification.globalOfferId = globalOfferId;

              // This one can have two different notification type :
              // 1. If the offer is accepted by the borrower
              if (contractEvents?.action_type?.[0] == "accept_offer") {
                notification.user = contractEvents.lender[0];
                notification.notificationType = LoanNotificationType.offerAccepted;
              }
              // 2. If the loan is accepted by the lender
              if (contractEvents?.action_type?.[0] == "accept_loan") {
                notification.user = contractEvents.borrower[0];
                notification.notificationType = LoanNotificationType.loanAccepted;
              }
              notifications.push(notification);

              // But we also notify all the other potential lenders that their offer is cancelled
              const offers: Offer[] = await this.offersRepository
                .createQueryBuilder("offer")
                .innerJoinAndSelect("offer.loan", "loan")
                .where("offer.network = :network", { network })
                .andWhere("loan.borrower = :borrower", { borrower })
                .andWhere("loan.loanId = :loanId", { loanId })
                .getMany();

              notifications.concat(
                await pMap(
                  offers.filter(offer => offer.globalOfferId != globalOfferId),
                  async (offer: Offer) => {
                    const notification = await this.createNotification(
                      network,
                      borrower,
                      loanId,
                      tx,
                    );
                    notification.user = offer.lender;
                    notification.globalOfferId = offer.globalOfferId;
                    notification.notificationType = LoanNotificationType.otherOfferAccepted;
                    return notification;
                  },
                ),
              );
            } else if (contractEvents?.action?.[0] == "withdraw_collateral") {
              // If a loan was cancelled, we notify the owner of all the offers
              const loanId = parseInt(contractEvents.loan_id[0]);
              const borrower = contractEvents.borrower[0];

              const offers: Offer[] = await this.offersRepository
                .createQueryBuilder("offer")
                .innerJoinAndSelect("offer.loan", "loan")
                .where("offer.network = :network", { network })
                .andWhere("loan.borrower = :borrower", { borrower })
                .andWhere("loan.loanId = :loanId", { loanId })
                .getMany();

              notifications.concat(
                await pMap(offers, async (offer: Offer) => {
                  const notification = await this.createNotification(network, borrower, loanId, tx);
                  notification.user = offer.lender;
                  notification.globalOfferId = offer.globalOfferId;
                  notification.notificationType = LoanNotificationType.loanCancelled;
                  return notification;
                }),
              );
            }
          },
          // No concurrency because we are querying the local db
        );
      });
      this.loanNotificationRepository.save(notifications);

      // We add the transaction hashes to the redis set :
      const txHashes = response.data.tx_responses.map((tx: any) => tx.txhash);
      if (txHashes.length) {
        await this.redisDB.sadd(
          this.getSetName(network),
          response.data.tx_responses.map((tx: any) => tx.txhash),
        );
      }

      // If no transactions queried were a analyzed, we return
    } while (txToAnalyse.length);
  }
}
