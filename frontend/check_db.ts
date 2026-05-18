import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "backend", ".env") });

async function checkUser() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI not found");
        return;
    }

    const emailToCheck = process.argv[2];
    if (!emailToCheck) {
        console.error("Please provide an email to check: npm run check-user -- <email>");
        return;
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const users = db.collection("users");

        console.log(`Checking for user: ${emailToCheck.toLowerCase()}...`);
        const user = await users.findOne({ email: emailToCheck.toLowerCase() });

        if (user) {
            console.log("User FOUND in database:");
            console.log(JSON.stringify(user, null, 2));
        } else {
            console.log("User NOT FOUND in database.");

            // Search for partial matches or similar emails
            const allUsers = await users.find({}).toArray();
            const similar = allUsers.filter(u => u.email.includes(emailToCheck.split('@')[0]));
            if (similar.length > 0) {
                console.log("\nFound similar emails:");
                similar.forEach(u => console.log(`- ${u.email}`));
            }
        }
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    } finally {
        await client.close();
    }
}

checkUser();
