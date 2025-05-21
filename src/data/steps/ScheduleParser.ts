import * as schedule from 'node-schedule';
import dotenv from 'dotenv';
import Scrapper from '../../base/scrapper';
import { Telegram } from 'telegraf';
import { Apartament } from '../../base/mongo';

dotenv.config();

function messageToGroup(data: Apartament): string {
    return `
🏠 <b>${data.title}</b>\n
📍 <b>Adresse/Postleitzahl:</b>
${data.address}\n
💰 <b>Miete:</b> ${data.price}
🛏️ <b>Zimmer:</b> ${data.rooms}
📐 <b>Wohnflache:</b> ${data.area}
    `
}

export default function Parser(ctx: Telegram, mongodb: any){
    schedule.scheduleJob('*/1 * * * *', async () => {
        console.log('Parser job');

        const data = await Scrapper();
        const check = await mongodb.CheckDuplicate(data);

        if (data?.length){
            for (let i = 0; i < data.length; i++) {
                if (!check[i]){
                    await ctx.sendPhoto(
                        process.env.TGC!,
                        `https://www.saga.hamburg/${data[i].img}`,
                        {
                            caption: messageToGroup(data[i]),
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: 'Angebot ansehen', url: data[i].link },
                                        { text: 'Auf Immomio bewerben', url: data[i].expose }
                                    ],
                                    [
                                        { text: 'Adresse auf Karte', url: `https://www.google.com/maps/place/${encodeURIComponent(data[i].address)}` }
                                    ]
                                ]
                            }
                        }
                    );
                }
            }
        }
        else console.warn('No data from scrapper work');
  });
}