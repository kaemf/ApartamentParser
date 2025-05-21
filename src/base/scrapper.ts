import puppeteer, { ElementHandle } from "puppeteer";
import { Apartament } from "./mongo";
import ImmoweltProfiles from "../data/immowelt";

function CheckMiete(input: string | null): boolean {
    if (!input) return false;
    const _input = input.toLowerCase().split(' ');
    return _input.includes('miete') || _input.includes('mieten');
}

export default async function Scrapper(): Promise<Apartament[] | undefined> {
    try{
        console.log('Scrapping started...');
    
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        let page = await browser.newPage();
    
        const results = [];
    
        for (let site of ["saga", "immowelt"]) {
            if (site === 'saga') {
                console.log('Scraping Saga...');
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
                        const img = card.querySelector('picture > img')?.getAttribute('src') || '';
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
                        console.warn(`Can't find expose link for ${fullDetailLink}`);
                    }
            
                    await detailPage.close();
            
                    results.push({
                        siteType: site,
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
            }
            else if (site === 'immowelt') {
                console.log('Scraping Immowelt...');
                for (const profile of ImmoweltProfiles) {
                    if (!page.isClosed()) {
                        await page.close();
                    }
                    page = await browser.newPage();
                    console.log(`[${ImmoweltProfiles.indexOf(profile) + 1}] ${profile} ${ImmoweltProfiles.indexOf(profile) === 0 ? '\n' : ''}`);
                    await page.goto(profile, {
                        waitUntil: 'networkidle2',
                    });
    
                    const usercentricsRoot = await page.waitForSelector('#usercentrics-root', { timeout: 10000 });
                    if (!usercentricsRoot) console.error('Usercentrics not found\n');
    
                    const acceptButtonHandle = await usercentricsRoot?.evaluateHandle(root => {
                        const shadow = root.shadowRoot;
                        if (!shadow) return null;
                        const btn = shadow.querySelector('[data-testid="uc-accept-all-button"]');
                        return btn;
                    });
    
                    const elementHandle = acceptButtonHandle?.asElement() as ElementHandle<Element> | null;
    
                    elementHandle ? await elementHandle.click() : console.log('Usercentrics not found\n');
    
                    while (true) {
                        const loadMoreButton = await page.$('button.btn.btn--100.btn--secondary');
    
                        if (!loadMoreButton) break;
    
                        await loadMoreButton.click();
                        console.log('Load more...');
    
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                
                   
                    try {
                        await page.waitForSelector('.object-card', { timeout: 5000 });
                    } catch (e) {
                        console.log(`No listings found (timeout) for profile: [${ImmoweltProfiles.indexOf(profile) + 1}]`);
                        continue;
                    }
                
                    const listings = await page.$$eval('.object-card', cards => {
                        return cards.map(card => {
                            const roomAndAreaContainer = card.querySelector('.flex.flex-grow.items-center');
    
                            let area = '';
                            let rooms = '';
    
                            if (roomAndAreaContainer) {
                                const elems = Array.from(roomAndAreaContainer.querySelectorAll('.mr-100')).map(el => el.textContent?.trim() || '');
    
                                let hasArea = elems.some(text => text.includes('m²') || text.includes('m2'));
                                let hasRooms = elems.some(text => text.includes('Zi.'));
    
                                if (!(hasArea && hasRooms)) {
                                    return null;
                                }
    
                                elems.forEach(text => {
                                    if (text.includes('m²') || text.includes('m2')) {
                                        area = text;
                                    } else if (text.includes('Zi.')) {
                                        rooms = text.replace('Zi.', '').trim();
                                    }
                                });
                            }
    
                            const title = card.querySelector('.headline')?.textContent?.trim() || '';
                            const price = card.querySelector('.is-bold')?.textContent?.trim() || '';
                            const address = card.querySelector('.details p')?.textContent?.trim() || '';
                            const img = (card.querySelector('.img')?.getAttribute('style')?.match(/url\((.*?)\)/))?.[1] || '';
                            const link = card.querySelector('a')?.getAttribute('href') || '';
    
                            return { title, link, address, img, rooms, area, price, available: "" };
                        }).filter(Boolean);
                    }) as Apartament[];
                
                    if (!listings.length) {
                        console.log('No listings found.');
                        continue;
                    }
                
                    for (const [i, listing] of listings.entries()) {
                        const detailPage = await browser.newPage();
                        const fullDetailLink = listing.link;
                
                        await detailPage.goto(fullDetailLink, { waitUntil: 'networkidle2' });
                
                        let typeOfSell: string | null = null;
                
                        try {
                            await detailPage.waitForSelector('span.css-2bd70b', { timeout: 5000 });
                
                            typeOfSell = await detailPage.$eval(
                                'span.css-2bd70b',
                                el => (el as HTMLElement).innerText
                            );
                        } catch (err) {
                            console.warn(`Can't find expose link for ${fullDetailLink}`);
                        }
                
                        await detailPage.close();

                        if (CheckMiete(typeOfSell)) {
                            results.push({
                                siteType: site,
                                title: listing.title,
                                address: listing.address,
                                rooms: listing.rooms,
                                img: listing.img,
                                area: listing.area,
                                price: listing.price,
                                available: listing.available,
                                link: listing.link,
                                expose: ''
                            });
                        }

                    }
                }
            }
        }
    
        await browser.close();

        console.log(`Done, found ${results.length} results`);
    
        return results;
    }
    
    catch (error) {
        console.error('\n\nFatal Error to connect to Puppeteer:\n', error);
        process.exit(1);
    }
}