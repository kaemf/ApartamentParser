import * as schedule from 'node-schedule';
import dotenv from 'dotenv';
import Scrapper from '../../base/scrapper';
import { Telegram, TelegramError } from 'telegraf';
import { Apartament } from '../../base/mongo';

dotenv.config();

function messageToGroup(data: Apartament): string {
    return data.siteType === 'saga' ? 
`
🏠 <b>${data.title}</b>\n
📍 <b>Adresse/Postleitzahl:</b>
${data.address}\n
💰 <b>Miete:</b> ${data.price}
🛏️ <b>Zimmer:</b> ${data.rooms}
📐 <b>Wohnflache:</b> ${data.area}
` 
:
`
🏠 <b>${data.title}</b>\n
${data.address !== '' ? `📍 <b>Adresse/Postleitzahl:</b>\n${data.address}\n` : ''}
${data.price !== '' ? `💰 <b>Miete:</b> ${data.price}` : ''}
${data.rooms !== '' ? `🛏️ <b>Zimmer:</b> ${data.rooms}` : ''}
${data.area !== '' ? `📐 <b>Wohnflache:</b> ${data.area}` : ''}
`;
}

async function sendWithRetry(ctx: Telegram, data: Apartament) {
    try {
        await ctx.sendPhoto(
            process.env.TGC!,
            data.siteType === 'saga' ? `https://www.saga.hamburg${data.img}` : data.img.replace(/^"|"$/g, ''),
            {
                caption: messageToGroup(data),
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: data.siteType === 'saga'
                        ? [
                            [
                                { text: 'Angebot ansehen', url: data.link },
                                { text: 'Auf Immomio bewerben', url: data.expose }
                            ],
                            [
                                { text: 'Adresse auf Karte', url: `https://www.google.com/maps/place/${encodeURIComponent(data.address)}` }
                            ]
                        ]
                        : [
                            [{ text: 'Angebot ansehen', url: data.link }]
                        ]
                }
            }
        );
    } catch (err) {
        if (err instanceof TelegramError && err.response?.error_code === 429) {
            const waitTime = err.response.parameters?.retry_after ?? 30;
            console.warn(`Rate limit hit. Waiting ${waitTime} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            return sendWithRetry(ctx, data);
        } else {
            throw err;
        }
    }
}


export default function Parser(ctx: Telegram, mongodb: any){
    let busy = false;

    schedule.scheduleJob('*/1 * * * *', async () => {
        if (busy) {
            console.log('Busy, waiting...');
            return;
        }

        try {
            busy = true;
            console.log('Parser job');

            const data = await Scrapper(),
                check = await mongodb.CheckDuplicate(data);

            if (data?.length) {
                let _i = 0;
                for (let i = 0; i < data.length; i++) {
                    if (!check[i]) {
                        _i++;

                        await sendWithRetry(ctx, data[i]);

                        console.log(`${_i}. Post sent.`);
                    }
                }
            } else {
                console.warn('No data from scrapper work');
            }
        } catch (error) {
            console.error(error);
        } finally {
            busy = false;
        }
    });
}