const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const uri = process.env.MONGODB_URI;
async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbs = await client.db().admin().listDatabases();

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'local', 'config'].includes(dbName)) continue;

            const db = client.db(dbName);
            const collections = await db.listCollections().toArray();

            for (const colInfo of collections) {
                const colName = colInfo.name;
                const col = db.collection(colName);
                const count = await col.countDocuments();
                if (count > 0) {
                    console.log(`FOUND DATA: DB: ${dbName}, Col: ${colName}, Count: ${count}`);
                    const samples = await col.find({}).limit(1).toArray();
                    console.log(`  - Sample:`, JSON.stringify(samples[0]).substring(0, 100));
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}
run();
