import { Message } from "../../base/types";

export default async function TBC(onTextMessage: Message, redis: any) {
    onTextMessage('ToBeContinued...', async (ctx, user, set, data) => {
        ctx.reply("Данный бот не обрабатывает входящие ему сообщения.")
    })
}