import { Context, Telegraf } from "telegraf";
import { Update } from "telegraf/typings/core/types/typegram"

export default async function Start(bot: Telegraf<Context<Update>>, db: any) {
  bot.start(async (ctx) => {
    console.log('\n\nBOT STARTED (Pressed /start button)');

    const username = ctx.chat.type === "private" ? ctx.chat.username ?? null : null;
    await db.set(ctx.chat.id)('username')(username ?? 'unknown');
    await db.set(ctx.chat.id)('id')(ctx.chat.id.toString());

    await ctx.reply("Приветсвую вас, не пишите какие-либо сообщения мне, поскольку я не умею их обрабатывать, да и не к чему мне это, спасибо за понимание.");
    await db.set(ctx.chat.id)('state')('ToBeContinued...');
  });
}