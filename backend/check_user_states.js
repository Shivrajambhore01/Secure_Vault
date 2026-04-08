const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) return;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('securevault');
        const users = await db.collection('users').find({}).toArray();

        const output = users.map(u => ({
            email: u.email,
            isOnline: u.isOnline,
            isProfileComplete: u.isProfileComplete,
            lastActive: u.lastActive,
            inactivityEmailsSent: u.inactivityEmailsSent,
            nomineesNotified: u.nomineesNotified,
            callTriggered: u.callTriggered
        }));

        fs.writeFileSync('user_states.json', JSON.stringify(output, null, 2));
        console.log("User states written to user_states.json");
    } finally {
        await client.close();
    }
}
run();
