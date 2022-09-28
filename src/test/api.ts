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


/*
qb.setFilter({ field: "network", operator: "$eq", value: networkType })
  .setFilter({ field: "tradeInfo.state", operator: "$in", value: states })
  .setFilter({ field: "tradeId", operator: "$in", value: tradeIds })
  .setFilter({ field: "tradeInfo.owner", operator: "$in", value: counterers })
  .setFilter({ field: "tradeInfo.whitelistedUsers", operator: "$in", value: counterers })
  .setFilter({ field: "counterTrades.tradeInfo.owner", operator: "$in", value: counterers })
  .setJoin({ field: "cw721Assets.collection" })
  .setFilter({ field: "cw721Assets.collection.collectionName.allNftInfo", operator: "$in", value: names })
*/

qb.setFilter({ field: "tradeInfo_cw721Assets_join.allNftInfo", operator: "$cont", value: "AH"})
  

const test = qb.query();

const api = axios
  .get(`${url}/?${test}`)
  .then(r => console.log(r, r.data, r.data[0].tradeInfo.associatedAssets, r.data[1].tradeInfo.associatedAssets))
  .catch(e => console.log(e));

export class QueryParameters {
  /* Filters section */
  "filters.globalSearch"?: string;
  "filters.collections"?: string[];
  "filters.lookingFor"?: string[];
}
