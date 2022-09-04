import knex, { Knex } from "knex";

const tradeDBKnexArgs = {
  client: "mysql2",
  connection: {
    host: "127.0.0.1",
    user: "illiquidly",
    password: "illiquidly",
    database: "ILLIQUIDLY",
  },
};

function initDB() {
  return knex(tradeDBKnexArgs);
}

async function quitDB(db: Knex) {
  return await db.destroy();
}

export { initDB, quitDB };
