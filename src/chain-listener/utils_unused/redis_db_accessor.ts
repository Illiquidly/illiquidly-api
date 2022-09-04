import Redis from "ioredis";

async function createDBClient() {
  // We start the db
  return new Redis();
}

async function quitDB(db: Redis) {
  // We stop the db
  await db.quit();
}

export { createDBClient, quitDB };
