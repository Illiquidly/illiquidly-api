import knex, { Knex } from "knex";

let knexDB: Knex;

async function initNFTDB() {
  knexDB = knex({
    client: "mysql2",
    connection: {
      host: "127.0.0.1",
      user: "illiquidly",
      password: "illiquidly",
      database: "ILLIQUIDLY",
    },
  });
}

async function quitNFTDB() {
  knexDB.destroy();
}

async function getNftInfo(network: string, nft_address: string) {
  return (
    await knexDB("nft_info").select("*").where("network", network).where("nft_address", nft_address)
  ).map(info => ({
    nftAddress: info.nft_address,
    name: info.name,
    symbol: info.symbol,
  }));
}

async function getNftInfoByName(network: string, nft_name: string) {
  return (
    await knexDB("nft_info").select("*").where("network", network).where("name", nft_name)
  ).map(info => ({
    nftAddress: info.nft_address,
    name: info.name,
    symbol: info.symbol,
  }));
}

async function getNftInfoByPartialName(network: string, nftPartialName: string) {
  return (
    await knexDB("nft_info")
      .select("*")
      .where("network", network)
      .whereRaw("name like ?", nftPartialName ?? "")
  ).map(info => ({
    nftAddress: info.nft_address,
    name: info.name,
    symbol: info.symbol,
  }));
}

async function getAllNftInfo(network: string, nft_name: string) {
  return (await knexDB("nft_info").select("*").where("network", network)).map(info => ({
    nftAddress: info.nft_address,
    name: info.name,
    symbol: info.symbol,
  }));
}

export { initNFTDB, quitNFTDB, getNftInfo, getAllNftInfo, getNftInfoByPartialName };
