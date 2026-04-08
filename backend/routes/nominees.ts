import express, { Request, Response } from "express";
import { ObjectId } from "mongodb";
import nodemailer from "nodemailer";
import clientPromise from "../lib/mongodb";
import { authenticateJWT } from "./auth";

const router = express.Router();

// Email transporter (shared with auth.ts)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// ... existing routes ...

// GET nominee details by token
router.get("/verify/:token", async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const client = await clientPromise;
        const db = client.db("securevault");

        console.log(`[Nominee] Verifying token: ${token}`);
        const nominee = await db.collection("nominees").findOne({ accessToken: token });

        if (!nominee) {
            console.warn(`[Nominee] Token not found in database: ${token}`);
            return res.status(404).json({ error: "Invalid or expired access link" });
        }

        if (nominee.tokenExpiry && new Date() > new Date(nominee.tokenExpiry)) {
            console.warn(`[Nominee] Token expired for nominee: ${nominee.email}`);
            return res.status(401).json({ error: "Access link has expired (24h limit)" });
        }

        console.log(`[Nominee] Token verified for: ${nominee.email}`);

        // Mask email for display: s*******@gmail.com
        const [user, domain] = nominee.email.split("@");
        const maskedEmail = user[0] + "*".repeat(user.length - 2) + user[user.length - 1] + "@" + domain;

        res.status(200).json({
            name: nominee.name,
            maskedEmail,
            email: nominee.email // We'll need this for sending OTP
        });
    } catch (error) {
        console.error("Nominee Verify Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST send OTP to nominee
router.post("/send-otp", async (req: Request, res: Response) => {
    try {
        const { token, email } = req.body;
        const client = await clientPromise;
        const db = client.db("securevault");

        // Verify token again
        const nominee = await db.collection("nominees").findOne({ accessToken: token, email });
        if (!nominee) return res.status(403).json({ error: "Unauthorized" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await db.collection("nominee_otps").updateOne(
            { email: email.toLowerCase() },
            { $set: { otp, expiresAt, token } },
            { upsert: true }
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "SecureVault Nominee Verification Code",
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Verify your access</h2>
                    <p>Your verification code to access SecureVault assets is:</p>
                    <div style="font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                </div>
            `,
        };

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail(mailOptions);
        } else {
            console.log(`[DEV MODE] Nominee OTP for ${email}: ${otp}`);
        }

        res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("Nominee OTP Error:", error);
        res.status(500).json({ error: "Failed to send OTP" });
    }
});

// POST verify nominee OTP
router.post("/verify-otp", async (req: Request, res: Response) => {
    try {
        const { email, otp, token } = req.body;
        const client = await clientPromise;
        const db = client.db("securevault");

        const record = await db.collection("nominee_otps").findOne({
            email: email.toLowerCase(),
            otp,
            token
        });

        if (!record || new Date() > record.expiresAt) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        // Return a temporary session token (for testing, we'll use the accessToken itself)
        // In a real app, generate a JWT.
        res.status(200).json({ message: "Verified", sessionToken: token });
    } catch (error) {
        console.error("Nominee Verify OTP Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET assets for nominee by session token
router.get("/assets/:sessionToken", async (req: Request, res: Response) => {
    try {
        const { sessionToken } = req.params;
        const client = await clientPromise;
        const db = client.db("securevault");

        // Find nominee by token
        const nominee = await db.collection("nominees").findOne({ accessToken: sessionToken });
        if (!nominee) return res.status(401).json({ error: "Session expired" });

        // IMPORTANT: Strictly fetch only assets assigned to this specific nominee
        const assets = await db.collection("assets").find({
            userId: nominee.userId,
            nomineeId: nominee.id
        }).toArray();

        res.status(200).json({
            ownerName: nominee.userName || "Account Owner",
            assets
        });
    } catch (error) {
        console.error("Fetch Nominee Assets Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET all nominees for a user
router.get("/:userId", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const client = await clientPromise;
        const db = client.db("securevault");
        const nominees = await db.collection("nominees").find({ userId }).toArray();
        res.status(200).json(nominees);
    } catch (error) {
        console.error("Fetch Nominees Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST save/update a nominee
router.post("/", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { id, userId, ...nomineeData } = req.body;
        if (!userId) return res.status(400).json({ error: "UserId is required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const nominees = db.collection("nominees");

        if (id) {
            await nominees.updateOne(
                { id, userId },
                { $set: { ...nomineeData, updatedAt: new Date().toISOString() } },
                { upsert: true }
            );
        } else {
            const newId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            await nominees.insertOne({
                id: newId,
                userId,
                ...nomineeData,
                createdAt: new Date().toISOString(),
            });
        }

        res.status(200).json({ message: "Nominee saved successfully" });
    } catch (error) {
        console.error("Save Nominee Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE a nominee
router.delete("/:userId/:id", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId, id } = req.params;
        const client = await clientPromise;
        const db = client.db("securevault");
        await db.collection("nominees").deleteOne({ id, userId });
        res.status(200).json({ message: "Nominee deleted successfully" });
    } catch (error) {
        console.error("Delete Nominee Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
