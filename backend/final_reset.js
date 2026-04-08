const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) return;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('securevault');
        const users = db.collection('users');

        // Reset ALL users to a clean state
        const res = await users.updateMany(
            {},
            {
                $set: {
                    logoutTime: null, // Disarmed for everyone initially
                    inactivityEmailsSent: 0,
                    nomineesNotified: false,
                    callTriggered: false,
                    lastInactivityNotificationAt: null
                },
                $unset: {
                    isOnline: "",
                    isMonitoringActive: ""
                }
            }
        );
        console.log(`FINAL RESET: Updated ${res.modifiedCount} users.`);
        console.log("All monitoring flags DELETED. System now relies solely on 'logoutTime'.");

    } finally {
        await client.close();
    }
}
run();
