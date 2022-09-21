import { createNotificationDB, createTradeDB, flushNotificationDB, flushTradeDB, initDB } from "./structure";

const knexDB = initDB();

flushTradeDB(knexDB)
  .then(async () => await flushNotificationDB(knexDB))
  .then(async () => await createTradeDB(knexDB))
  .then(async () => await createNotificationDB(knexDB))
  .then(async () => {
    console.log(await knexDB("nft_info").columnInfo());
  })
  .then(async () => await knexDB.destroy());

