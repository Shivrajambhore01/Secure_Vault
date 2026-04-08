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

        const allUsers = await users.find().toArray();
        const output = allUsers.map(u => {
            const pinType = u.pin && (u.pin.startsWith("$2") ? "Bcrypt" : "AES/Other");
            return `Email: ${u.email}, PIN Type: ${pinType || "None"}`;
        }).join('\n');
        fs.writeFileSync('user_pin_check.txt', output);
        console.log("Results written to user_pin_check.txt");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await client.close();
    }
}
run();
