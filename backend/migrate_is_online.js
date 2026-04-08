const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

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
        const db = client.db('securevault');
        const users = db.collection('users');

        // 1. Set isOnline: false for anyone missing it
        const res1 = await users.updateMany(
            { isOnline: { $exists: false } },
            { $set: { isOnline: false } }
        );
        console.log(`Initialized isOnline for ${res1.modifiedCount} users.`);

        // 2. Set isOnline: true for users with very recent activity (last 5 mins)
        // to prevent immediate triggers for active sessions that didn't have the flag yet.
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const res2 = await users.updateMany(
            { lastActive: { $gte: fiveMinsAgo } },
            { $set: { isOnline: true } }
        );
        console.log(`Marked ${res2.modifiedCount} active users as online.`);

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.close();
    }
}
run();
