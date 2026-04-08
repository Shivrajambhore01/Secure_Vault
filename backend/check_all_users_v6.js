const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;

async function checkUsers() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const users = await db.collection("users").find({}).toArray();

        console.log(`Total users: ${users.length}`);
        users.forEach(u => {
            console.log(`User: ${u.email}`);
            console.log(`  ID: ${u._id}`);
            console.log(`  logoutTime: ${u.logoutTime}`);
            console.log(`  nomineesNotified: ${u.nomineesNotified}`);
            console.log(`  lastActive: ${u.lastActive}`);
            console.log('---');
        });
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

checkUsers();
