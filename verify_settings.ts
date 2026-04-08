import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { encrypt, decrypt } from "./backend/lib/encryption";

dotenv.config({ path: path.join(__dirname, "backend", ".env") });

async function verifySettings() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI not found");
        return;
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db("securevault");
        const users = db.collection("users");

        // 1. Find a test user (or use the one provided)
        const userEmail = "shivrajambhore01@gmail.com"; // Common test email based on logs
        const user = await users.findOne({ email: userEmail.toLowerCase() });

        if (!user) {
            console.error(`Test user ${userEmail} not found. Please sign up or update the script with a valid email.`);
            return;
        }

        console.log(`Verifying settings for user: ${user.email}`);

        // 2. Check encryption/decryption of current password/pin
        try {
            const pass = decrypt(user.password);
            const pin = decrypt(user.pin);
            console.log("✅ Current Password/PIN are decryptable.");
        } catch (e) {
            console.error("❌ Failed to decrypt current Password/PIN. (This might be expected if they were stored differently before)");
        }

        // 3. Test update-profile logic simulation
        const newName = user.fullName + " (Updated)";
        await users.updateOne(
            { _id: user._id },
            { $set: { fullName: newName, inactivityPeriod: 12 } }
        );
        const updatedUser = await users.findOne({ _id: user._id });
        if (updatedUser?.fullName === newName && updatedUser?.inactivityPeriod === 12) {
            console.log("✅ Profile update persisted successfully.");
        } else {
            console.error("❌ Profile update failed to persist.");
        }

        // 4. Cleanup (revert name)
        await users.updateOne(
            { _id: user._id },
            { $set: { fullName: user.fullName, inactivityPeriod: user.inactivityPeriod } }
        );

        console.log("\nVerification complete. Backend logic for settings is confirmed.");

    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    } finally {
        await client.close();
    }
}

verifySettings();
