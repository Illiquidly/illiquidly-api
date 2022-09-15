import { initDB } from "../trades/structure";
import { createNFTInfoDB, flushNFTInfoDB } from "./structure";

const knexDB = initDB();

flushNFTInfoDB(knexDB)
  .then(() => createNFTInfoDB(knexDB))
  .then(async () => {
    console.log(await knexDB("nft_info").columnInfo());
  })
  .then(() => knexDB.destroy());
