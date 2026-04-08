const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;

async function resetMulti() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const users = db.collection("users");

        // Set logoutTime to NOW for both users
        const now = new Date().toISOString();

        const result = await users.updateMany(
            {},
            {
                $set: {
                    nomineesNotified: false,
                    logoutTime: now,
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            }
        );

        console.log(`Reset result: ${result.matchedCount} matched, ${result.modifiedCount} modified`);
        console.log(`All users' logoutTime set to NOW: ${now}`);
    } catch (err) {
        console.error("Failed:", err);
    } finally {
        await client.close();
    }
}
resetMulti();
