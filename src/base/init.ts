// Apartment Parser Test Task
// Developed by Yaroslav Volkivskyi (TheLaidSon)

// Initialization File

import { Telegraf } from "telegraf";
import { createClient } from "redis";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function MongoDB() {
  try {
    const client = new MongoClient('mongodb://localhost:27017/?family=4');

    await client.connect();

    console.log("Done");
    return client;
  } catch (error) {
    console.error('\n\nFatal Error to connect to MongoDB:\n', error);
    process.exit(1);
  }
}

export default async function init() {
  console.log(`\n\n  Apartment Parser v1.0\n\n   Developed by Yaroslav Volkivskyi (TheLaidSon)\n\n`)
  console.log("Creating redis client...");
  const redis = createClient({url: process.env.REDIS_URL});
  redis.on("error", (err) => console.log("Redis Client Error", err));
  console.log("Done");

  console.log("Connecting to redis server...");
  await redis.connect();
  console.log("Done");

  console.log("Creating telegraf bot instanse...");
  const bot = new Telegraf(process.env.TOKEN ?? '');
  console.log("Done");

  console.log("Connecting to MongoDB...");
  const db = await MongoDB();

  bot.use(async (ctx, next) => {
    const originalReply = ctx.reply;

    ctx.reply = async (text: string, extra?: any) => {
      let finalExtra = { ...extra, parse_mode: 'HTML' };
      if (!extra?.reply_markup) {
        finalExtra.reply_markup = { remove_keyboard: true };
      }
      else if (extra && extra.reply_markup) {
        finalExtra.reply_markup = {...extra.reply_markup, resize_keyboard: true};
      }
      return originalReply.call(ctx, text, finalExtra);
    };

    await next();
  })

  // wrap redis with helper functions
  const wRedis = ({
    getAll: (id: number) => async () => redis.hGetAll(`${id}`),
    getAllKeys: async () => redis.keys('*'),
    get: (id: number) => async (property: string) => await redis.hGet(`${id}`, property),
    set: (id: number) => (property: string) => async (new_value: string) => await redis.hSet(`${id}`, property, new_value)
  })

  return [bot, wRedis, db] as const;
}