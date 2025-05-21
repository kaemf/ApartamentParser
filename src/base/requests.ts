import Express from "express"
import Scrapper from "./scrapper";

const app = Express();
app.listen(3000);

export default function Requests(){
    app.get('/', async (req, res) => {
        try {
            const _res = await Scrapper();
            res.json({ test: "ok", results: _res});
        } catch (err) {
            res.status(500).send('Internal Server Error');
        }
    });
}