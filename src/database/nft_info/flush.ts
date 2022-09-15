import { initDB } from "../trades/structure";
import { createNFTInfoDB, flushNFTInfoDB } from "./structure";

const knexDB = initDB();

flushNFTInfoDB(knexDB)
  .then(async () => await createNFTInfoDB(knexDB))
  .then(async () => {
    console.log(await knexDB("nft_info").columnInfo());
  })
  .then(async () => await knexDB.destroy());
