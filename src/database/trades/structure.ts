import knex, { Knex } from "knex";
import { TradeNotificationType } from "../../trades/dto/getTrades.dto";
import { Network } from "../../utils/blockchain/dto/network.dto";


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

function _createTradeInfo(table: any) {
  table.increments("id").primary();
  table.integer("last_counter_id");
  table.string("owner_comment");
  table.string("owner_comment_time");
  table.string("time");
  table.string("trader_comment");
  table.string("trader_comment_time");
  table.string("owner");
  table.string("state");
  table.boolean("assets_withdrawn");
  table.integer("accepted_counter_trade_id");
  table.string("associated_assets");
  table.string("whitelisted_users");
  table.string("nfts_wanted");
  table.text("whole_data");
}

async function createTradeDB(knexDB: Knex) {
  await knexDB.schema
    .createTable("trades", (table: any) => {
      _createTradeInfo(table);
      table.enu("network", Object.values(Network)).notNullable();
      table.integer("trade_id").notNullable();
      table.unique(["network", "trade_id"]);
    })
    .catch(() => console.log("Trade table exists already"));

  await knexDB.schema
    .createTable("counter-trades", (table: any) => {
      _createTradeInfo(table);
      table.enu("network", Object.values(Network)).notNullable();
      table.integer("trade_id").notNullable();
      table.integer("counter_id").notNullable();
      table.unique(["network", "trade_id", "counter_id"]);
    })
    .catch(() => console.log("Counter Trade table exists already"));
}

async function createNotificationDB(knexDB: Knex) {
  await knexDB.schema
    .createTable("notifications", (table: any) => {
      table.increments("id").primary();
      table.datetime("time");
      table.string("user");
      table.enu("network", Object.values(Network)).notNullable();
      table.integer("trade_id");
      table.integer("counter_id");
      table.enu("notification_type", Object.values(TradeNotificationType));
      table.enu("status", ["unread", "read"]);
    })
    .catch(() => console.log("Trade notification table exists already"));
}

async function flushNotificationDB(knexDB: Knex) {
  await knexDB.schema.dropTable("notifications").catch(() => {});
}

async function flushTradeDB(knexDB: Knex) {
  await knexDB.schema.dropTable("trades").catch(() => {});
  await knexDB.schema.dropTable("counter-trades").catch(() => {});
}

export { initDB, quitDB, createTradeDB, createNotificationDB, flushTradeDB, flushNotificationDB };
