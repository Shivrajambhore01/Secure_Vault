const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) {
        console.error("MONGODB_URI is missing");
        return;
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const otps = db.collection("otps");

        const recent = await otps.find().sort({ createdAt: -1 }).limit(10).toArray();
        const output = recent.map(r => `Email: ${r.email}, Type: ${r.type}, CreatedAt: ${r.createdAt}, ExpiresAt: ${r.expiresAt}`).join('\n');
        fs.writeFileSync('otp_check_results.txt', output || "No OTPs found");
        console.log("Results written to otp_check_results.txt");
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await client.close();
    }
}
run();
