const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) {
        console.error("MONGODB_URI not found");
        return;
    }
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('securevault');
        const users = db.collection('users');

        // Reset ALL users to the new V4 state
        const res = await users.updateMany(
            {},
            {
                $set: {
                    logoutTime: null, // Disarmed
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                },
                $unset: {
                    isOnline: "",
                    isMonitoringActive: "",
                    inactivityEmailsSent: "",
                    callTriggered: "",
                    nomineesNotified: "",
                    lastInactivityNotificationAt: "",
                    inactivityCalls: ""
                }
            }
        );
        console.log(`V4 RESET COMPLETE: Updated ${res.modifiedCount} users.`);
        console.log("All legacy flags purged. System is now purely Logout-Based.");

    } finally {
        await client.close();
    }
}
run();
