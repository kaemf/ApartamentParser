import { MongoClient } from "mongodb";

export type Apartament = {
    siteType: string;
    title: string;
    address: string;
    img: string;
    rooms: string;
    area: string;
    price: string;
    available: string;
    link: string;
    expose: string;
}

export default function DataBase(mongodb: MongoClient){
    class MongoDB{
        private apartamentDB = mongodb.db('ApartamentParser').collection('apartaments');
         private ttlIndexName = 'createdAt_1';

        constructor() {
            this.ensureTTLIndex().catch(console.error);
        }

        private async ensureTTLIndex() {
            const indexes = await this.apartamentDB.indexes();
            const ttlExists = indexes.some(index => index.name === this.ttlIndexName);

            if (!ttlExists) {
                await this.apartamentDB.createIndex(
                    { createdAt: 1 },
                    { name: this.ttlIndexName, expireAfterSeconds: 1209600 } // 14 days
                );
                console.log('TTL-index created');
            } else {
                console.log('TTL-index already exists');
            }
        }

        public async CheckDuplicate(data: Apartament[]): Promise<boolean[]> {
            try{
                const result: boolean[] = [];
                for (let i = 0; i < data.length; i++) {
                    const existing = await this.apartamentDB.findOne({
                        siteType: data[i].siteType,
                        title: data[i].title,
                        address: data[i].address,
                        rooms: data[i].rooms,
                        area: data[i].area,
                        price: data[i].price,
                        available: data[i].available,
                    });
        
                    if (existing) {
                        result.push(true);
                    }
                    else{
                        await this.apartamentDB.insertOne({
                            ...data[i],
                            createdAt: new Date()
                        });
                        result.push(false);
                    }
                }
    
                return result;
            }
            catch(e){
                console.log(e);
                return [];
            }
        }
    }

    return new MongoDB;
}