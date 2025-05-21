import Express from "express"
import Scrapper from "./scrapper";

const app = Express();
app.listen(3000);

export default function Requests(){
    app.get('/', async (req, res) => {
        const _res = await Scrapper();
        res.status(200).send(_res);
    })
}