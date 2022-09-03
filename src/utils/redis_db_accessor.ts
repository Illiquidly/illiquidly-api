import Redis from "ioredis";
import Redlock, { Lock } from "redlock";
import {
  ContractsInteracted,
  SerializableContractsInteracted,
  UpdateState,
} from "../nft-content/dto/get-nft-content.dto";

export function defaultContractsApiStructure(): ContractsInteracted {
  return {
    interactedContracts: new Set(),
    ownedCollections: [],
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


function fillEmpty(currentData: Nullable<ContractsInteracted>): ContractsInteracted {
  if (!currentData || Object.keys(currentData).length === 0) {
    return defaultContractsApiStructure();
  } else {
    return currentData;
  }
}

function saveNFTContentToDb(key: string, currentData: ContractsInteracted) {
  const serialisedData = serialise(currentData);
  return db.set(key, JSON.stringify(serialisedData));
}

async function getNFTContentFromDb(key: string): Promise<ContractsInteracted> {
  const serialisedData = await db.get(key);
  const currentData = deserialise(JSON.parse(serialisedData));
  return fillEmpty(currentData);
}
function serialise(currentData: ContractsInteracted): SerializableContractsInteracted {
  const serialised: any = { ...currentData };
  if (serialised.interactedContracts) {
    serialised.interactedContracts = Array.from(serialised.interactedContracts);
  }
  return serialised;
}

function deserialise(serialisedData: SerializableContractsInteracted): ContractsInteracted | null {
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

let db: Redis;
initDB();
async function initDB() {
  // We start the db
  db = new Redis();
}

async function quitDB() {
  // We stop the db
  await db.quit();
}

// Redis Lock functions

// We defined some time constants for the api queries
if (process.env.UPDATE_DESPITE_LOCK_TIME == undefined) {
  process.env.UPDATE_DESPITE_LOCK_TIME = "120000";
}
const UPDATE_DESPITE_LOCK_TIME = parseInt(process.env.UPDATE_DESPITE_LOCK_TIME);
if (process.env.IDLE_UPDATE_INTERVAL == undefined) {
  process.env.IDLE_UPDATE_INTERVAL = "20000";
}
const IDLE_UPDATE_INTERVAL = parseInt(process.env.IDLE_UPDATE_INTERVAL);

let redlock: Redlock;

async function initMutex() {
  redlock = new Redlock(
    // You should have one client for each independent redis node
    // or cluster.
    [db],
    {
      // The expected clock drift; for more details see:
      // http://redis.io/topics/distlock
      driftFactor: 0.01, // multiplied by lock ttl to determine drift time

      // The max number of times Redlock will attempt to lock a resource
      // before erroring.
      retryCount: 1,

      // the time in ms between attempts
      retryDelay: 200, // time in ms

      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 200, // time in ms

      // The minimum remaining time on a lock before an extension is automatically
      // attempted with the `using` API.
      automaticExtensionThreshold: 500, // time in ms
    },
  );
}

async function acquireUpdateLock(key: string): Promise<Lock> {
  return redlock.acquire(
    [`${key}_updateLock_${process.env.DB_VERSION!}`],
    UPDATE_DESPITE_LOCK_TIME,
  );
}

export async function releaseUpdateLock(lock: any) {
  await lock.release().catch((_error: any) => console.log("Lock already released"));
}

async function lastUpdateStartTime(key: string): Promise<number> {
  let updateTime = await db.get(`${key}_updateStartTime${process.env.DB_VERSION!}`);
  return parseInt(updateTime);
}

async function setLastUpdateStartTime(key: string, time: number) {
  await db.set(`${key}_updateStartTime${process.env.DB_VERSION!}`, time);
}

async function canUpdate(dbKey: string): Promise<void | Lock> {
  // First we check that the we don't update too often
  if (Date.now() < (await lastUpdateStartTime(dbKey)) + IDLE_UPDATE_INTERVAL) {
    console.log("Too much requests my girl");
    return;
  }

  // Then we check that we can update the records (and someone is not doing the same thing simultaneously)
  // We do that my using a Redis Redlock. This Redlock lasts at most UPDATE_DESPITE_LOCK_TIME, to not be blocking in case of program crash
  let isLocked = false;
  let lock = await acquireUpdateLock(dbKey).catch(_error => {
    console.log(_error);
    console.log("islocked");
    isLocked = true;
  });
  if (isLocked) {
    return;
  }

  await setLastUpdateStartTime(dbKey, Date.now());
  return lock;
}

function saveJSONToDb(key: string, currentData: any) {
  return db.set(key, JSON.stringify(currentData));
}

async function getJSONFromDb(key: string): Promise<any> {
  const dbData = await db.get(key);
  return JSON.parse(dbData);
}

export {
  getNFTContentFromDb,
  saveNFTContentToDb,
  saveJSONToDb,
  getJSONFromDb,
  SerializableContractsInteracted,
  ContractsInteracted,
  serialise,
  deserialise,
  quitDB,
  initMutex,
  canUpdate,
};
