const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;

async function checkUser() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const user = await db.collection("users").findOne({ email: "ambhoresd@jdcoem.ac.in" });

        if (!user) {
            console.log("User not found!");
            return;
        }

        console.log(`User: ${user.email}`);
        console.log(`  logoutTime: ${user.logoutTime}`);
        console.log(`  nomineesNotified: ${user.nomineesNotified}`);
        console.log(`  reEngagementCallSent: ${user.reEngagementCallSent}`);
        console.log(`  reEngagementMessagesSent: ${user.reEngagementMessagesSent}`);

        const nominees = await db.collection("nominees").find({ userId: user._id.toString() }).toArray();
        console.log(`  Nominees found: ${nominees.length}`);
        nominees.forEach(n => {
            console.log(`    - ${n.name} <${n.email}> (accessToken: ${n.accessToken ? 'YES' : 'NO'})`);
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

checkUser();
