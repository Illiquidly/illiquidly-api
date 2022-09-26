import Redis from "ioredis";
import {
  SerializableContractsInteracted,
  StoreContractsInteracted,
  UpdateState,
} from "../nft-content/dto/get-nft-content.dto";

function createRedisClient() {
  // We start the db
  return new Redis();
}

async function quitDB(db: Redis) {
  // We stop the db
  await db.quit();
}

export { createRedisClient };

export function defaultContractsApiStructure(): StoreContractsInteracted {
  return {
    interactedContracts: new Set(),
    ownedTokens: [],
    state: UpdateState.Full,
    txs: {
      external: {
        oldest: null,
        newest: null,
      },
      internal: {
        oldest: null,
        newest: null,
      },
    },
  };
}

type Nullable<T> = T | null;

function fillEmpty(currentData: Nullable<StoreContractsInteracted>): StoreContractsInteracted {
  if (!currentData || Object.keys(currentData).length === 0) {
    return defaultContractsApiStructure();
  } else {
    return currentData;
  }
}

async function saveNFTContentToDb(db: Redis, key: string, currentData: StoreContractsInteracted) {
  const serialisedData = serialise(currentData);
  return await db.set(key, JSON.stringify(serialisedData));
}

async function getNFTContentFromDb(db: Redis, key: string): Promise<StoreContractsInteracted> {
  const serialisedData = await db.get(key);
  const currentData = deserialise(JSON.parse(serialisedData));
  return fillEmpty(currentData);
}
function serialise(currentData: StoreContractsInteracted): SerializableContractsInteracted {
  const serialised: any = { ...currentData };
  if (serialised.interactedContracts) {
    serialised.interactedContracts = Array.from(serialised.interactedContracts);
  }
  return serialised;
}

function deserialise(
  serialisedData: SerializableContractsInteracted,
): StoreContractsInteracted | null {
  if (serialisedData) {
    const currentData: any = { ...serialisedData };
    if (currentData.interactedContracts) {
      currentData.interactedContracts = new Set(currentData.interactedContracts);
    }
    return currentData;
  } else {
    return null;
  }
}

// Redis Lock functions

// We defined some time constants for the api queries

if (process.env.IDLE_UPDATE_INTERVAL == undefined) {
  process.env.IDLE_UPDATE_INTERVAL = "20000";
}
const IDLE_UPDATE_INTERVAL = parseInt(process.env.IDLE_UPDATE_INTERVAL);

export async function releaseUpdateLock(lock: any) {
  await lock.release().catch(() => console.log("Lock already released"));
}

async function lastUpdateStartTime(db: Redis, key: string): Promise<number> {
  const updateTime = await db.get(`${key}_updateStartTime${process.env.DB_VERSION}`);
  return parseInt(updateTime);
}

async function setLastUpdateStartTime(db: Redis, key: string, time: number) {
  await db.set(`${key}_updateStartTime${process.env.DB_VERSION}`, time);
}

async function canUpdate(db: Redis, dbKey: string): Promise<void | Lock> {
  // First we check that the we don't update too often
  if (Date.now() < (await lastUpdateStartTime(db, dbKey)) + IDLE_UPDATE_INTERVAL) {
    console.log("Too much requests my girl");
    return;
  }
  await setLastUpdateStartTime(db, dbKey, Date.now());
}

async function saveJSONToDb(db: Redis, key: string, currentData: any) {
  return await db.set(key, JSON.stringify(currentData));
}

async function getJSONFromDb(db: Redis, key: string): Promise<any> {
  const dbData = await db.get(key);
  return JSON.parse(dbData);
}

export {
  getNFTContentFromDb,
  saveNFTContentToDb,
  saveJSONToDb,
  getJSONFromDb,
  SerializableContractsInteracted,
  serialise,
  deserialise,
  quitDB,
  canUpdate,
};
