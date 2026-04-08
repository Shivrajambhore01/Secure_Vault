const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
// Using native fetch available in Node.js v20
dotenv.config();

const BASE_URL = "http://localhost:5000/api";
const EMAIL = "shivrajambhore01@gmail.com";
const uri = process.env.MONGODB_URI;

async function run() {
    if (!uri) throw new Error("MONGODB_URI missing");
    const client = new MongoClient(uri);

    try {
        console.log("--- STARTING FULL PIN RESET TEST ---");

        // 1. Request
        console.log("1. Requesting PIN reset...");
        const reqRes = await fetch(`${BASE_URL}/auth/forgot-request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: EMAIL, type: "pin" })
        });
        const reqData = await reqRes.json();
        console.log("Request Response:", reqData);
        if (!reqRes.ok) throw new Error("Request failed");

        // 2. Get OTP from DB
        console.log("2. Fetching OTP from MongoDB...");
        await client.connect();
        const db = client.db("securevault");
        const otps = db.collection("otps");
        const record = await otps.findOne({ email: EMAIL, type: "forgot_pin" });
        if (!record) throw new Error("No OTP record found in DB!");
        const otp = record.otp;
        console.log(`Found OTP: ${otp}`);

        // 3. Verify
        console.log("3. Verifying OTP...");
        const verRes = await fetch(`${BASE_URL}/auth/forgot-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: EMAIL, otp: otp, type: "pin" })
        });
        const verData = await verRes.json();
        console.log("Verify Response:", verData);
        if (!verRes.ok) throw new Error("Verify failed");
        const resetToken = verData.resetToken;

        // 4. Reset
        console.log("4. Resetting PIN to '1111'...");
        const resRes = await fetch(`${BASE_URL}/auth/reset-credential`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resetToken: resetToken, newValue: "1111", type: "pin" })
        });
        const resData = await resRes.json();
        console.log("Reset Response:", resData);
        if (!resRes.ok) throw new Error("Reset failed");

        // 5. Final Check in DB
        console.log("5. Checking User PIN in DB...");
        const users = db.collection("users");
        const user = await users.findOne({ email: EMAIL });
        console.log(`User PIN in DB: ${user.pin}`);
        if (user.pin.startsWith("$2")) {
            console.log("SUCCESS: PIN is now Bcrypt hashed!");
        } else {
            console.log("FAILURE: PIN is still AES or plain!");
        }

    } catch (err) {
        console.error("TEST FAILED:", err.message);
    } finally {
        await client.close();
    }
}

run();
