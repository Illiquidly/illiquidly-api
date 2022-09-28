import axios from "axios";

const url = "http://localhost:3000/trades";

import { RequestQueryBuilder, CondOperator } from "@rewiko/crud-request";

const qb = RequestQueryBuilder.create();

// is actually the same as:

const networkType = "testnet";
const states = ["countered"];
const counterers = ["terra1kj6vwwvsw7vy7x35mazqfxyln2gk5xy00r87qy"];
const tradeIds = [2, 1, 0];
const names = ["Galactic Punks"];
const addresses = counterers;


//qb.setFilter({ field: "tradeInfo_cw721Assets_join.allNftInfo", operator: "$cont", value: "token_id" })
//qb.setFilter({ field: "tradeInfo_cw721Assets_collection_join.collectionName", operator: "$cont", value: "Punks"})
//qb.setFilter({ field: "tradeInfo_cw721Assets_join.allNftInfo", operator: "$cont", value: "sun-face"})
qb.setFilter({ field: "tradeInfo.tokensWanted", operator: "$cont", value: "coin"})
qb.setOr({ field: "tradeInfo.tokensWanted", operator: "$cont", value: "cw20Coin"})
console.log("with coin")

const test = qb.query();

console.log(test);

const api = axios
  .get(`${url}/?${test}`)
  .then(r => console.log(r, r.data))
  .catch(e => console.log(e));

export class QueryParameters {
  /* Filters section */
  "filters.globalSearch"?: string;
  "filters.collections"?: string[];
  "filters.lookingFor"?: string[];
}
