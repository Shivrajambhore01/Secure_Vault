const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) return;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const otps = db.collection("otps");

        const indices = await otps.listIndexes().toArray();
        console.log("Indices on otps collection:", JSON.stringify(indices, null, 2));
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await client.close();
    }
}
run();
