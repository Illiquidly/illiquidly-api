import knex, { Knex } from "knex";

async function createNFTInfoDB(knexDB: Knex) {
  await knexDB.schema
    .createTable("nft_info", (table: any) => {
      table.increments("id").primary();
      table.string("network");
      table.string("nft_address");
      table.string("name");
      table.string("symbol");
      table.unique(["network", "nft_address"]);
    })
    .catch(() => console.log("NFT Info table exists already"));
}

async function flushNFTInfoDB(knexDB: Knex) {
  await knexDB.schema.dropTable("token_info").catch(() => {});
  await knexDB.schema.dropTable("nft_info").catch(() => {});
}

export { createNFTInfoDB, flushNFTInfoDB };
