import { createRedisClient, quitDB as quitRedisDB } from "../../utils/redis_db_accessor";
import { createNotificationDB, createTradeDB, flushNotificationDB, flushTradeDB, initDB, quitDB } from "../trades/structure";
import "dotenv/config"

async function main(){
	const knexDB = initDB();
	const redisDB = createRedisClient();
	console.log(process.env.REDIS_TXHASH_SET, process.env.REDIS_TXHASH_SET)
	await redisDB.del(process.env.REDIS_TXHASH_SET!);
	await redisDB.del(process.env.REDIS_NOTIFICATION_TXHASH_SET!);
	await flushTradeDB(knexDB);
	await flushNotificationDB(knexDB);
	await createTradeDB(knexDB);
	await createNotificationDB(knexDB);
	await quitDB(knexDB);
	await quitRedisDB(redisDB);
	console.log("Done")
}

main()
