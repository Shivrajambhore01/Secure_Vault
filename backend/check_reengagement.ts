import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) {
        console.error("MONGODB_URI not found in env");
        return;
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('securevault');
        const users = await db.collection('users').find({ logoutTime: { $ne: null } }).toArray();

        console.log(`Found ${users.length} logged-out users:`);
        users.forEach(u => {
            console.log(`- Email: ${u.email}`);
            console.log(`  logoutTime: ${u.logoutTime}`);
            console.log(`  reEngagementCallSent: ${u.reEngagementCallSent}`);
            console.log(`  reEngagementMessagesSent: ${u.reEngagementMessagesSent}`);
            console.log(`  reEngagementLastMessageAt: ${u.reEngagementLastMessageAt}`);

            if (u.logoutTime) {
                const now = Date.now();
                const logoutTime = new Date(u.logoutTime).getTime();
                const elapsed = now - logoutTime;
                console.log(`  Elapsed: ${(elapsed / 1000).toFixed(2)}s`);
            }
        });
    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        await client.close();
    }
}
run();
