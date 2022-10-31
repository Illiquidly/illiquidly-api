import axios from "axios";

const url = "http://localhost:3000/raffles";

import { RequestQueryBuilder } from "@rewiko/crud-request";

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

//qb.setJoin({ field: "counterTrades.tradeInfo", select: ["owner"]  });
qb.setLimit(5);
//qb.setFilter({ field: "tradeInfo.whitelistedUsers", operator: "$eq" , value: "[]"});
//qb.setOr({ field: "tradeInfo.whitelistedUsers", operator: "$cont" , value: "terra1hzttzrf2yge4pepnlalvt5zuaphpzk3nnc8x7s"});
//qb.setOr({ field: "tradeInfo.whitelistedUsers", operator: "$cont" , value: "terra1hzttzrf2yge4pepnlalvt5zuaphpzk3nnc8x7s"});

qb.search({
  $or: [
    {
      "cw721Assets.allNftInfo": {
        $cont: "Galactic",
      },
    },
  ],
});

const test = qb.query();
console.log(test);

axios
  .get(`${url}/?${test}`)
  .then(r => console.log(r.data))
  .catch(e => console.log(e));

export class QueryParameters {
  /* Filters section */
  "filters.globalSearch"?: string;
  "filters.collections"?: string[];
  "filters.lookingFor"?: string[];
}
