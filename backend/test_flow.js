const fetch = require('node-fetch');

const BASE_URL = "http://localhost:5000/api";
const EMAIL = "shivrajambhore01@gmail.com";

async function test() {
    console.log("--- Testing Forgot PIN Flow ---");

    // 1. Request OTP
    console.log("1. Requesting OTP...");
    const reqRes = await fetch(`${BASE_URL}/auth/forgot-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, type: "pin" })
    });
    const reqData = await reqRes.json();
    console.log("Request Response:", reqData);
    if (!reqRes.ok) return;

    // 2. Get OTP from DB (we'll need a way to read it)
    console.log("\n2. Getting OTP from DB...");
    // I'll use the check_otps.js logic here or just assume I'll read it from terminal if I log it.
    // In server.ts, I log it to console in dev mode.
    console.log("(Check backend terminal for OTP)");

    // Since I can't easily read the terminal from this script, I'll stop here and ask the user or try to read it via another tool.
    // Actually, I'll just write a script that does everything including reading the DB.
}

test();
