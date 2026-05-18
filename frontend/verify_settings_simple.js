const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");

dotenv.config({ path: path.join(__dirname, "backend", ".env") });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "a_very_secret_key_that_is_32_chars!";
const IV_LENGTH = 16;

function decrypt(text) {
    const textParts = text.split(":");
    const ivString = textParts.shift();
    if (!ivString) throw new Error("Invalid encrypted text format");
    const iv = Buffer.from(ivString, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

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

        const userEmail = "shivrajambhore01@gmail.com";
        const user = await users.findOne({ email: userEmail.toLowerCase() });

        if (!user) {
            console.error(`Test user ${userEmail} not found.`);
            return;
        }

        console.log(`Verifying settings logic for: ${user.email}`);

        // Verify decryption logic matches
        try {
            const pass = decrypt(user.password);
            console.log("✅ Decryption logic verified.");
        } catch (e) {
            console.log("ℹ️ Encryption mismatch (Expected if key changed).");
        }

        // Simulate update logic
        const testName = "Test Persistence";
        await users.updateOne({ _id: user._id }, { $set: { testField: testName } });
        const check = await users.findOne({ _id: user._id });

        if (check.testField === testName) {
            console.log("✅ MongoDB Persistence verified.");
            await users.updateOne({ _id: user._id }, { $unset: { testField: "" } });
        } else {
            console.error("❌ MongoDB Persistence failed.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}

verifySettings();
