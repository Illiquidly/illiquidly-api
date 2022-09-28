import Redis from "ioredis";

const redisDB = new Redis();

async function test() {
  await redisDB.keys("*").then(keys => console.log(keys));

  await redisDB.keys("*2.0*").then(function (keys) {
    // Use pipeline instead of sending
    // one command each time to improve the
    // performance.
    const pipeline = redisDB.pipeline();
    keys.forEach(function (key) {
      pipeline.del(key);
    });
    return pipeline.exec();
  });

  await redisDB.keys("*").then(keys => console.log(keys));
  redisDB.quit();
}

test();
