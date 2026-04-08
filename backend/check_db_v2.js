const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Try loading env from multiple sources to be sure
dotenv.config();
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

const uri = process.env.MONGODB_URI;
console.log("Using URI (masked):", uri ? uri.replace(/:([^@]+)@/, ":****@") : "MISSING");

async function run() {
    if (!uri) return;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbs = await client.db().admin().listDatabases();

        const logData = [];
        logData.push(`Databases found: ${dbs.databases.map(d => d.name).join(', ')}`);

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'local', 'config'].includes(dbName)) continue;

            const db = client.db(dbName);
            const collections = await db.listCollections().toArray();
            logData.push(`DB: ${dbName} -> Collections: ${collections.map(c => c.name).join(', ')}`);

            for (const colInfo of collections) {
                const colName = colInfo.name;
                const col = db.collection(colName);
                const count = await col.countDocuments();
                if (count > 0) {
                    const sample = await col.findOne({});
                    logData.push(`  [${colName}] count: ${count}, sample _id: ${sample._id}, _id type: ${sample._id.constructor.name}`);
                    if (sample.email) logData.push(`    sample email: ${sample.email}`);
                } else {
                    logData.push(`  [${colName}] count: 0`);
                }
            }
        }
        fs.writeFileSync('db_diagnostics_result.txt', logData.join('\n'));
        console.log("Diagnostics written to db_diagnostics_result.txt");
    } catch (err) {
        console.error("Diagnostic failed:", err);
    } finally {
        await client.close();
    }
}
run();
