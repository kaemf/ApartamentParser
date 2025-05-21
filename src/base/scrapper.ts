import puppeteer from "puppeteer";
import { Apartament } from "./mongo";

export default async function Scrapper(): Promise<Apartament[] | undefined> {
    console.log('Scrapping...');

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.goto('https://www.saga.hamburg/immobiliensuche?Kategorie=APARTMENT', {
        waitUntil: 'networkidle2',
    });

    await page.waitForSelector('#APARTMENT .immo-item');

    const listings = await page.$$eval('#APARTMENT .immo-item', cards => {
        return cards.map(card => {
            function extractRightSide(input: string, splitter: string): string {
                return input.split(splitter)[1].trim();
            }

            const title = card.querySelector('h3')?.textContent?.trim() || '';
            const img = card.querySelector('img')?.getAttribute('src') || '';
            const link = card.querySelector('a[href]')?.getAttribute('href') || '';
            const address = card.querySelector('p')?.textContent?.trim() || '';
            const rooms = card.querySelector('[data-rooms]')?.textContent?.trim() || '';
            const area = card.querySelector('[data-livingspace]')?.textContent?.trim() || '';
            const price = card.querySelector('[data-fullcosts]')?.textContent?.trim() || '';
            const available = card.querySelector('[data-availableat]')?.textContent?.trim() || '';

            return { title, link, address, img, rooms: extractRightSide(rooms, ':'), area: extractRightSide(area, '.'), price: extractRightSide(price, ':'), available: extractRightSide(available, ':') };
        });
    });

    if (!listings.length) {
        console.log('No listings found.');
        await browser.close();
        return;
    }

    const results = [];

    for (const [i, listing] of listings.entries()) {
        const detailPage = await browser.newPage();
        const fullDetailLink = listing.link.startsWith('http') ? listing.link : `https://www.saga.hamburg${listing.link}`;

        await detailPage.goto(fullDetailLink, { waitUntil: 'networkidle2' });

        let exposeLink: string | null = null;

        try {
            await detailPage.waitForSelector('a[href*="immomio.com/apply"]', { timeout: 5000 });

            exposeLink = await detailPage.$eval(
                'a[href*="immomio.com/apply"]',
                el => el.getAttribute('href')
            );
        } catch (err) {
            console.warn(`⚠️ Не удалось найти кнопку Zum Exposé на ${fullDetailLink}`);
        }

        await detailPage.close();

        // console.log(`\n[${i + 1}] ${listing.title}`);
        // console.log(`📍 Адрес: ${listing.address}`);
        // console.log(`🛏 Комнаты: ${listing.rooms}`);
        // console.log(`📐 Площадь: ${listing.area}`);
        // console.log(`💶 Стоимость: ${listing.price}`);
        // console.log(`📅 Доступно с: ${listing.available}`);
        // console.log(`🔗 Ссылка: ${fullDetailLink}`);
        // console.log(`➡️ Zum Exposé: ${exposeLink || 'Не найдено'}`);

        results.push({
            title: listing.title,
            address: listing.address,
            rooms: listing.rooms,
            img: listing.img,
            area: listing.area,
            price: listing.price,
            available: listing.available,
            link: fullDetailLink,
            expose: exposeLink ?? 'https://www.saga.hamburg/not_found',
        });
    }

    await browser.close();

    console.log('Done');

    return results;
}