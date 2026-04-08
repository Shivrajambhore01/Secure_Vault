const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) return;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const users = db.collection("users");
        const otps = db.collection("otps");

        const user = await users.findOne({ email: "shivrajambhore01@gmail.com" });
        const userOtps = await otps.find({ email: "shivrajambhore01@gmail.com" }).toArray();

        const data = {
            user: user,
            otps: userOtps
        };

        fs.writeFileSync('full_debug_data.json', JSON.stringify(data, null, 2));
        console.log("Full debug data written to full_debug_data.json");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await client.close();
    }
}
run();
