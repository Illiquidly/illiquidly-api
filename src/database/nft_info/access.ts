import knex, { Knex } from "knex";

async function flushNFTDB(knexDB: Knex) {
  await knexDB.schema.dropTable("token_info").catch(() => {});
  await knexDB.schema.dropTable("nft_info").catch(() => {});
}

async function addNftInfo(knexDB: Knex, nftInfo: any[]) {
  return await knexDB("nft_info")
    .insert(
      nftInfo.map(nft => ({
        network: nft.network,
        nft_address: nft.nftAddress,
        name: nft.name,
        symbol: nft.symbol,
      })),
    )
    .onConflict()
    .merge(); // We erase if the data is already present
}

async function getNftInfo(knexDB: Knex, network: string, nft_address: string) {
  return (
    await knexDB("nft_info").select("*").where("network", network).where("nft_address", nft_address)
  ).map(info => ({
    nftAddress: info.nft_address,
    name: info.name,
    symbol: info.symbol,
  }));
}

async function getNftInfoByName(knexDB: Knex, network: string, nft_name: string) {
  return (
    await knexDB("nft_info").select("*").where("network", network).where("name", nft_name)
  ).map(info => ({
    nftAddress: info.nft_address,
    name: info.name,
    symbol: info.symbol,
  }));
}

async function getNftInfoByPartialName(knexDB: Knex, network: string, nftPartialName: string) {
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

async function getAllNftInfo(knexDB: Knex, network: string, nft_name: string) {
  return (await knexDB("nft_info").select("*").where("network", network)).map(info => ({
    nftAddress: info.nft_address,
    name: info.name,
    symbol: info.symbol,
  }));
}

export { addNftInfo, getNftInfo, getAllNftInfo, getNftInfoByPartialName };
