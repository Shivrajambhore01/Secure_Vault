import express, { Request, Response } from "express";
import clientPromise from "../lib/mongodb";
import { ObjectId } from "mongodb";
import { encrypt, decrypt } from "../lib/encryption";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { updateActivityOnChain } from "../lib/blockchain";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev_only";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

// Token helpers
const generateAccessToken = (userId: string, email?: string) => {
    return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (userId: string) => {
    return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString("hex");
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
    // Access Token Cookie
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000, // 15 mins
    });

    // Refresh Token Cookie
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

// Auth Middleware
export const authenticateJWT = (req: Request, res: Response, next: any) => {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        console.log(`[Auth] Decoded Token UserId: ${decoded.userId}`);

        // Fetch full user to get isVerified status if needed, or include it in JWT
        // For now, we'll keep the JWT light and check isVerified in protected routes if necessary, 
        // but typically it's good to have it in the request object.
        (req as any).user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid or expired token" });
    }
};

// RBAC Middleware
export const authorizeRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: any) => {
        const user = (req as any).user;
        const userRole = user?.role || "user"; // Default to "user" if no role specified in token
        if (!roles.includes(userRole)) {
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }
        next();
    };
};

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendVerificationEmail = async (email: string, token: string, fullName: string) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verificationUrl = `${frontendUrl}/verify?token=${token}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify your Email - SecureVault",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #3b82f6;">Welcome to SecureVault!</h2>
                <p>Hello ${fullName},</p>
                <p>Thank you for signing up. Please verify your email address to activate your account and access your dashboard.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email Address</a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #64748b;">${verificationUrl}</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #64748b;">This link will expire in 24 hours.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

router.post("/signup", async (req: Request, res: Response) => {
    try {
        const { fullName, email, phone, dob, password, pin } = req.body;

        if (!fullName || !email || !password || !pin) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const existingUser = await users.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const pinHash = await bcrypt.hash(pin, 12);

        const newUser = {
            fullName,
            email: email.toLowerCase(),
            phone: "", // To be filled in profile completion
            dob: "",   // To be filled in profile completion
            password: passwordHash,
            pin: pinHash, // This is technically the password-like pin from signup step 3
            role: "user",
            isTwoFactorEnabled: false,
            twoFactorSecret: "",
            isProfileComplete: false, // Force profile completion redirect
            inactivityPeriod: 6,
            plan: "free",
            storageUsed: 0,
            storageLimit: 500 * 1024 * 1024,
            isVerified: false,
            verificationToken: generateVerificationToken(),
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            logoutTime: null,
            reEngagementCallSent: false,
            reEngagementMessagesSent: 0,
            reEngagementLastMessageAt: null
        };

        const result = await users.insertOne(newUser as any);

        // Send verification email
        await sendVerificationEmail(newUser.email, newUser.verificationToken, newUser.fullName);

        const { password: _, pin: __, ...userData } = newUser as any;
        userData.id = result.insertedId.toString();

        // Generate Tokens
        const accessToken = generateAccessToken(userData.id, userData.email);
        const refreshToken = generateRefreshToken(userData.id);

        // Set HttpOnly Cookies
        setAuthCookies(res, accessToken, refreshToken);

        res.status(201).json({
            message: "User registered successfully",
            user: userData
        });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        let isPasswordMatch = false;
        if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
            isPasswordMatch = await bcrypt.compare(password, user.password);
        } else {
            // Legacy password (AES-256)
            try {
                const decryptedPassword = decrypt(user.password);
                if (decryptedPassword === password) {
                    // Lazy migrate to bcrypt
                    const newHash = await bcrypt.hash(password, 12);
                    await users.updateOne({ _id: user._id }, { $set: { password: newHash } });
                    isPasswordMatch = true;
                }
            } catch (error) {
                console.error("Legacy decryption failed:", error);
            }
        }

        if (!isPasswordMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Check if 2FA is enabled
        if (user.isTwoFactorEnabled) {
            return res.status(200).json({
                message: "2FA Required",
                twoFactorRequired: true,
                userId: user._id.toString()
            });
        }

        const { password: _, pin: __, _id, ...userData } = user as any;
        userData.id = _id.toString();

        // Generate Tokens
        const accessToken = generateAccessToken(userData.id, userData.email);
        const refreshToken = generateRefreshToken(userData.id);

        // Set HttpOnly Cookies
        setAuthCookies(res, accessToken, refreshToken);

        // Reset inactivity timer on successful login
        await users.updateOne(
            { _id },
            {
                $set: {
                    lastActive: new Date().toISOString(),
                    logoutTime: null,
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            }
        );

        res.status(200).json({
            message: "Login successful",
            user: userData
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2FA Setup (Generate Secret & QR Code)
router.post("/2fa/setup", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = (req as any).user;
        const secret = speakeasy.generateSecret({ name: `SecureVault:${userId}` });

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        // Save secret temporarily until verified
        await users.updateOne(
            { _id: new ObjectId(userId as any) },
            { $set: { tempTwoFactorSecret: secret.base32 } }
        );

        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || "");
        res.status(200).json({ qrCodeUrl, secret: secret.base32 });
    } catch (error) {
        console.error("2FA Setup Error:", error);
        res.status(500).json({ error: "Failed to setup 2FA" });
    }
});

// 2FA Initial Verify (Enable 2FA)
router.post("/2fa/verify", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = (req as any).user;
        const { token } = req.body;

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId as any) });
        if (!user || !user.tempTwoFactorSecret) {
            return res.status(400).json({ error: "2FA setup not initiated" });
        }

        const verified = speakeasy.totp.verify({
            secret: user.tempTwoFactorSecret,
            encoding: "base32",
            token
        });

        if (verified) {
            await users.updateOne(
                { _id: new ObjectId(userId as any) },
                {
                    $set: {
                        isTwoFactorEnabled: true,
                        twoFactorSecret: user.tempTwoFactorSecret
                    },
                    $unset: { tempTwoFactorSecret: "" }
                }
            );
            res.status(200).json({ message: "2FA enabled successfully!" });
        } else {
            res.status(400).json({ error: "Invalid verification token" });
        }
    } catch (error) {
        console.error("2FA Verify Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2FA Login Verify (During login flow)
router.post("/2fa/login-verify", async (req: Request, res: Response) => {
    try {
        const { userId, token } = req.body;
        if (!userId || !token) return res.status(400).json({ error: "UserId and token required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId as any) });
        if (!user || !user.twoFactorSecret) {
            return res.status(401).json({ error: "Invalid session or 2FA not enabled" });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: "base32",
            token
        });

        if (verified) {
            const { password: _, pin: __, _id, ...userData } = user as any;
            userData.id = _id.toString();

            const accessToken = generateAccessToken(userData.id, userData.email);
            const refreshToken = generateRefreshToken(userData.id);
            setAuthCookies(res, accessToken, refreshToken);

            // Reset re-engagement system on 2FA login
            await users.updateOne(
                { _id: user._id },
                {
                    $set: {
                        lastActive: new Date().toISOString(),
                        logoutTime: null,
                        reEngagementCallSent: false,
                        reEngagementMessagesSent: 0,
                        reEngagementLastMessageAt: null
                    }
                }
            );

            res.status(200).json({ message: "Login successful", user: userData });
        } else {
            res.status(401).json({ error: "Invalid 2FA token" });
        }
    } catch (error) {
        console.error("2FA Login Verify Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Send OTP
router.post("/send-otp", async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        const client = await clientPromise;
        const db = client.db("securevault");
        const otps = db.collection("otps");

        await otps.updateOne(
            { email: email.toLowerCase() },
            { $set: { otp, expiresAt } },
            { upsert: true }
        );

        // Send email
        console.log("Checking email config:", {
            hasUser: !!process.env.EMAIL_USER,
            hasPass: !!process.env.EMAIL_PASS,
            user: process.env.EMAIL_USER
        });

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            // Re-initialize transporter if needed (in case env was loaded late)
            const currentTransporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: "SecureVault Verification Code",
                html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Verify your email</h2>
            <p>Your verification code for SecureVault is:</p>
            <div style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code will expire in 5 minutes.</p>
          </div>
        `,
            };
            await currentTransporter.sendMail(mailOptions);
            res.status(200).json({ message: "OTP sent successfully" });
        } else {
            console.warn("WARNING: EMAIL_USER or EMAIL_PASS not found in environment variables.");
            console.log(`[DEV MODE] OTP for ${email}: ${otp}`);
            res.status(200).json({ message: "OTP sent (check backend terminal logs)", devMode: true });
        }
    } catch (error) {
        console.error("Send OTP Error:", error);
        res.status(500).json({ error: "Failed to send OTP" });
    }
});

// Verify OTP
router.post("/verify-otp", async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const otps = db.collection("otps");

        const record = await otps.findOne({ email: email.toLowerCase() });

        if (!record || record.otp !== otp || new Date() > record.expiresAt) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        // Clean up used OTP
        await otps.deleteOne({ email: email.toLowerCase() });

        res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Verify PIN
router.post("/verify-pin", async (req: Request, res: Response) => {
    try {
        const { userId, pin } = req.body;
        if (!userId || !pin) return res.status(400).json({ error: "User ID and PIN are required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        let isPinMatch = false;
        if (user.pin.startsWith("$2a$") || user.pin.startsWith("$2b$")) {
            isPinMatch = await bcrypt.compare(pin, user.pin);
        } else {
            // Legacy PIN (AES-256)
            try {
                const decryptedPin = decrypt(user.pin);
                if (decryptedPin === pin) {
                    // Lazy migrate to bcrypt
                    const newHash = await bcrypt.hash(pin, 12);
                    await users.updateOne({ _id: user._id }, { $set: { pin: newHash } });
                    isPinMatch = true;
                }
            } catch (error) {
                console.error("Legacy PIN decryption failed:", error);
            }
        }

        if (isPinMatch) {
            return res.status(200).json({ message: "PIN verified successfully" });
        } else {
            return res.status(401).json({ error: "Incorrect PIN" });
        }
    } catch (error) {
        console.error("Verify PIN Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update Plan (PROTECTED)
router.post("/update-plan", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId, plan } = req.body;
        if (!userId || !plan) return res.status(400).json({ error: "UserId and Plan are required" });

        const limits = {
            free: 500 * 1024 * 1024,
            pro: 10 * 1024 * 1024 * 1024,
            premium: 100 * 1024 * 1024 * 1024
        };

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const result = await users.findOneAndUpdate(
            { _id: new ObjectId(userId as any) },
            { $set: { plan, storageLimit: (limits as any)[plan] } },
            { returnDocument: "after" }
        );

        if (!result) return res.status(404).json({ error: "User not found" });

        res.status(200).json({
            message: `Upgraded to ${plan} successfully!`,
            user: result
        });
    } catch (error) {
        console.error("Update Plan Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Get User Profile (PROTECTED)
router.get("/me/:userId", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params as any;
        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        const { password: _, pin: __, _id, ...userData } = user as any;
        userData.id = _id.toString();

        // Default values for existing users
        if (userData.isVerified === undefined) userData.isVerified = false;
        if (userData.isProfileComplete === undefined) userData.isProfileComplete = false;
        if (!userData.plan) userData.plan = "free";
        if (!userData.storageLimit) userData.storageLimit = 500 * 1024 * 1024;

        // Auto-fix storageUsed if it's potentially inconsistent
        if (userData.storageUsed === undefined || userData.storageUsed === 0) {
            const assets = await db.collection("assets").find({ userId }).toArray();
            const totalSize = assets.reduce((sum, a) => sum + (a.fileSize || 0), 0);

            if (totalSize > 0) {
                await users.updateOne({ _id: new ObjectId(userId as any) }, { $set: { storageUsed: totalSize } });
                userData.storageUsed = totalSize;
            } else {
                userData.storageUsed = 0;
            }
        }

        res.status(200).json(userData);
    } catch (error) {
        console.error("Get User Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update Profile
router.post("/update-profile", authenticateJWT, authorizeRoles("user", "admin"), async (req: Request, res: Response) => {
    try {
        const { userId, fullName, phone, email, inactivityPeriod } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID is required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const updateData: any = {};
        if (fullName) updateData.fullName = fullName;
        if (phone) updateData.phone = phone;
        if (email) updateData.email = email.toLowerCase();
        if (inactivityPeriod !== undefined) updateData.inactivityPeriod = inactivityPeriod;

        // Reset re-engagement system on profile update
        updateData.logoutTime = null;
        updateData.reEngagementCallSent = false;
        updateData.reEngagementMessagesSent = 0;
        updateData.reEngagementLastMessageAt = null;

        const result = await users.findOneAndUpdate(
            { _id: new ObjectId(userId as any) },
            { $set: updateData },
            { returnDocument: "after" }
        );

        if (!result) return res.status(404).json({ error: "User not found" });

        const { password: _, pin: __, ...userData } = (result.value || result) as any;
        userData.id = (userData._id || new ObjectId(userId as any)).toString();

        res.status(200).json({
            message: "Profile updated successfully!",
            user: userData
        });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update Password
router.post("/update-password", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;
        if (!userId || !oldPassword || !newPassword) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify old password
        let isOldPasswordMatch = false;
        if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
            isOldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
        } else {
            // Legacy password (AES-256)
            try {
                if (decrypt(user.password) === oldPassword) isOldPasswordMatch = true;
            } catch (error) {
                console.error("Legacy password decryption failed:", error);
            }
        }

        if (!isOldPasswordMatch) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await users.updateOne(
            { _id: new ObjectId(userId as any) },
            {
                $set: {
                    password: hashedPassword,
                    logoutTime: null, // Reset re-engagement system on password change
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            }
        );

        res.status(200).json({ message: "Password updated successfully!" });
    } catch (error) {
        console.error("Update Password Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Heartbeat (Update lastActive)
router.post("/heartbeat", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = (req as any).user;
        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        // SECURITY: Fetch user to check if they actually have a logoutTime set.
        // If they do, this heartbeat might be a "zombie" from an old tab.
        const user = await users.findOne({ _id: new ObjectId(userId as string) });

        if (user && user.logoutTime) {
            console.log(`[Heartbeat] BLOCKED for User ${userId} (already logged out at ${user.logoutTime})`);
            return res.status(200).json({ status: "logged_out", isOnline: false });
        }

        await users.updateOne(
            { _id: new ObjectId(userId as string) },
            {
                $set: {
                    lastActive: new Date().toISOString(),
                    logoutTime: null,
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            }
        );
        // Blockchain activity update
        if (user && user.walletAddress) {
            updateActivityOnChain(user.walletAddress).catch(err => console.error("BC Heartbeat Error:", err));
        }

        console.log(`[Heartbeat] User ${userId} is active.`);
        res.status(200).json({ status: "active", isOnline: true });
    } catch (error) {
        res.status(500).json({ error: "Heartbeat failed" });
    }
});

// Update PIN
router.post("/update-pin", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId, oldPin, newPin } = req.body;
        if (!userId || !oldPin || !newPin) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify old PIN
        let isOldPinMatch = false;
        if (user.pin.startsWith("$2a$") || user.pin.startsWith("$2b$")) {
            isOldPinMatch = await bcrypt.compare(oldPin, user.pin);
        } else {
            // Legacy PIN (AES-256)
            try {
                if (decrypt(user.pin) === oldPin) isOldPinMatch = true;
            } catch (error) {
                console.error("Legacy PIN decryption failed:", error);
            }
        }

        if (!isOldPinMatch) {
            return res.status(401).json({ error: "Incorrect current PIN" });
        }

        // Hash and update new PIN
        const hashedPin = await bcrypt.hash(newPin, 12);
        await users.updateOne(
            { _id: new ObjectId(userId as any) },
            {
                $set: {
                    pin: hashedPin,
                    logoutTime: null, // Reset re-engagement system on PIN change
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            }
        );

        res.status(200).json({ message: "PIN updated successfully!" });
    } catch (error) {
        console.error("Update PIN Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Google OAuth Authentication (Sign Up & Login)
router.post("/google-auth", async (req: Request, res: Response) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: "Google token is required" });

        // Verify Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        if (!payload) return res.status(401).json({ error: "Invalid Google token" });

        const { email, name, picture, sub: googleId } = payload;
        if (!email) return res.status(400).json({ error: "Email not provided by Google" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        let user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
            // 1. SIGN UP (Automated)
            const newUser = {
                fullName: name,
                email: email.toLowerCase(),
                googleId,
                picture,
                phone: "", // To be filled later if needed
                dob: "",    // To be filled later if needed
                password: await bcrypt.hash("GOOGLE_AUTH_ACCOUNT", 12), // Placeholder
                pin: await bcrypt.hash("0000", 12), // Default PIN
                inactivityPeriod: 6,
                plan: "free",
                storageUsed: 0,
                storageLimit: 500 * 1024 * 1024,
                isVerified: false,
                verificationToken: generateVerificationToken(),
                verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                isProfileComplete: false, // Google signup needs profile completion
                isOnline: true,
                authMethod: "google",
                logoutTime: null, // Reset re-engagement system on Google signup
                reEngagementCallSent: false,
                reEngagementMessagesSent: 0,
                reEngagementLastMessageAt: null
            };

            const result = await users.insertOne(newUser as any);

            // Send verification email
            await sendVerificationEmail(newUser.email, newUser.verificationToken, newUser.fullName || "User");

            const { password: _, pin: __, ...userData } = newUser as any;
            userData.id = result.insertedId.toString();

            // Generate and set auth cookies for the new user
            const accessToken = generateAccessToken(userData.id, userData.email);
            const refreshToken = generateRefreshToken(userData.id);
            setAuthCookies(res, accessToken, refreshToken);

            return res.status(201).json({
                message: "Signed up with Google successfully!",
                user: userData,
                source: "signup"
            });
        } else {
            // 2. LOGIN (Continue with Google)

            // Map Google ID if it's the first time they use Google for this email
            if (!user.googleId) {
                await users.updateOne(
                    { _id: user._id },
                    { $set: { googleId, picture, authMethod: "google" } }
                );
            }

            const { password: _, pin: __, _id, ...userData } = user as any;
            userData.id = _id.toString();

            // Generate Tokens
            const accessToken = generateAccessToken(userData.id, userData.email);
            const refreshToken = generateRefreshToken(userData.id);

            // Set HttpOnly Cookies
            setAuthCookies(res, accessToken, refreshToken);

            // Reset re-engagement system on login
            await users.updateOne(
                { _id: user._id },
                {
                    $set: {
                        lastActive: new Date().toISOString(),
                        logoutTime: null,
                        reEngagementCallSent: false,
                        reEngagementMessagesSent: 0,
                        reEngagementLastMessageAt: null
                    }
                }
            );

            return res.status(200).json({
                message: "Welcome back!",
                user: userData,
                source: "login"
            });
        }
    } catch (error) {
        console.error("Google Auth Error:", error);
        res.status(500).json({ error: "Google authentication failed" });
    }
});

// Complete Profile (for Google OAuth first-time users)
router.post("/complete-profile", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = (req as any).user;
        const { fullName, phone, dob, pin } = req.body;

        console.log(`[Complete Profile] userId from token: ${userId}`);
        console.log(`[Complete Profile] req.body:`, { fullName, phone, dob, pin: pin ? "****" : "missing" });

        if (!fullName || !phone || !dob || !pin) {
            return res.status(400).json({ error: "All fields are required: fullName, phone, dob, pin" });
        }

        if (pin.length < 4) {
            return res.status(400).json({ error: "PIN must be at least 4 digits" });
        }

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const encryptedPin = encrypt(pin);

        console.log(`[Complete Profile] Querying for _id: ${userId}`);

        let userToUpdate = await users.findOne({ _id: new ObjectId(userId) });

        // Fallback: If not found by ID (session mismatch?), try by email from token if available
        if (!userToUpdate && (req as any).user.email) {
            console.warn(`[Complete Profile] User not found by ID ${userId}, falling back to email: ${(req as any).user.email}`);
            userToUpdate = await users.findOne({ email: (req as any).user.email.toLowerCase() });
        }

        if (!userToUpdate) {
            console.error(`[Complete Profile] User not found for ID: ${userId} or email from token.`);
            return res.status(404).json({ error: "User not found" });
        }

        const result = await users.findOneAndUpdate(
            { _id: userToUpdate._id },
            {
                $set: {
                    fullName,
                    phone,
                    dob,
                    pin: encryptedPin,
                    isProfileComplete: true,
                    logoutTime: null,
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            },
            { returnDocument: "after" }
        );

        const actualUser = (result?.value || result) as any;
        const { password: _, pin: __, _id, ...userData } = actualUser;
        userData.id = _id.toString();

        console.log("Profile completed for user:", userData.email);
        res.status(200).json({ message: "Profile completed successfully!", user: userData });
    } catch (error) {
        console.error("Complete Profile Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Refresh Token Route
router.post("/refresh-token", async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) return res.status(401).json({ error: "No refresh token provided" });

        // Verify Refresh Token
        jwt.verify(refreshToken, JWT_SECRET, async (err: any, decoded: any) => { // Added async here
            if (err || !decoded.userId || decoded.type !== "refresh") {
                return res.status(403).json({ error: "Invalid refresh token" });
            }

            // Generate New Access Token
            const newAccessToken = generateAccessToken(decoded.userId, decoded.email);

            // Set New Access Token Cookie
            res.cookie("accessToken", newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 15 * 60 * 1000, // 15 mins
            });

            // Reset re-engagement system on token refresh
            const client = await clientPromise;
            const db = client.db("securevault");
            const users = db.collection("users");
            await users.updateOne(
                { _id: new ObjectId(decoded.userId as string) },
                {
                    $set: {
                        lastActive: new Date().toISOString(),
                        logoutTime: null,
                        reEngagementCallSent: false,
                        reEngagementMessagesSent: 0,
                        reEngagementLastMessageAt: null
                    }
                }
            );

            res.status(200).json({ message: "Token refreshed" });
        });
    } catch (error) {
        res.status(500).json({ error: "Refresh failed" });
    }
});

// Verify Email Route
router.get("/verify-email", async (req: Request, res: Response) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "Token is required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        // First, find user by token only (avoids date type mismatch issues)
        const user = await users.findOne({ verificationToken: token as string });

        if (!user) {
            console.log("Verify Email: No user found with token:", (token as string).substring(0, 10) + "...");
            return res.status(400).json({ error: "Invalid or expired verification token" });
        }

        // Check if already verified
        if (user.isVerified) {
            return res.status(200).json({ message: "Email already verified!" });
        }

        // Check expiry manually (handles both Date objects and ISO strings)
        const expiresAt = user.verificationTokenExpires;
        if (expiresAt) {
            const expiryDate = new Date(expiresAt);
            if (expiryDate < new Date()) {
                console.log("Verify Email: Token expired at", expiryDate.toISOString());
                return res.status(400).json({ error: "Verification token has expired. Please request a new one." });
            }
        }

        await users.updateOne(
            { _id: user._id },
            {
                $set: {
                    isVerified: true,
                    logoutTime: null, // Reset re-engagement system on email verification
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                },
                $unset: { verificationToken: "", verificationTokenExpires: "" }
            }
        );

        console.log("Verify Email: Success for user", user.email);
        res.status(200).json({ message: "Email verified successfully!" });
    } catch (error) {
        console.error("Verify Email Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Resend Verification Email
router.post("/resend-verification", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = (req as any).user;
        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ error: "User not found" });
        if (user.isVerified) return res.status(400).json({ error: "Email already verified" });

        const newToken = generateVerificationToken();
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await users.updateOne(
            { _id: new ObjectId(userId as any) },
            {
                $set: {
                    verificationToken: newToken,
                    verificationTokenExpires: expiry,
                    logoutTime: null, // Reset re-engagement system on resend verification
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            }
        );

        await sendVerificationEmail(user.email, newToken, user.fullName);

        res.status(200).json({ message: "Verification email resent!" });
    } catch (error) {
        console.error("Resend Verification Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Logout Route
router.post("/logout", authenticateJWT, async (req: Request, res: Response) => {
    try {
        const { userId } = (req as any).user;
        const client = await clientPromise;
        // ARM re-engagement system on logout
        console.log(`[Logout] Arming re-engagement for User: ${userId}`);
        await client.db("securevault").collection("users").updateOne(
            { _id: new ObjectId(userId as string) },
            {
                $set: {
                    lastActive: new Date().toISOString(),
                    logoutTime: new Date().toISOString(),
                    reEngagementCallSent: false,
                    reEngagementMessagesSent: 0,
                    reEngagementLastMessageAt: null
                }
            }
        );
    } catch (e: any) {
        const uid = (req as any).user?.userId || "unknown";
        console.error(`[Logout] DB Update Error for User ${uid}:`, e.message);
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out successfully" });
});


// Twilio Voice Call Helper (Re-Engagement)
async function triggerReEngagementCall(userId: string) {
    try {
        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user || !user.phone) {
            console.warn(`[RE-ENGAGEMENT-V4] Skip Call: User ${userId} has no phone number.`);
            return { skipped: true };
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const flowSid = process.env.TWILIO_FLOW_SID;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !flowSid || !fromNumber) {
            console.warn("[RE-ENGAGEMENT-V4] Skip Call: Missing Twilio config.");
            return { skipped: true };
        }

        const twilioClient = twilio(accountSid, authToken);
        console.log(`[RE-ENGAGEMENT-V4] Triggering Call to ${user.phone}... (Flow SID: ${flowSid})`);

        const execution = await twilioClient.studio.v2.flows(flowSid)
            .executions
            .create({ to: user.phone, from: fromNumber });

        console.log(`[RE-ENGAGEMENT-V4] Call Triggered Successfully. Execution SID: ${execution.sid}`);

        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { reEngagementCallSent: true } }
        );

        return { success: true, sid: execution.sid };
    } catch (error: any) {
        console.error("[RE-ENGAGEMENT-V4] Twilio Error:", error.message);
        return { success: false };
    }
}

// Notify Nominees (V4 Final Step)
async function notifyNomineesForUser(userId: string) {
    console.log(`[NOMINEE-NOTIFICATION] Starting notification process for userId: ${userId}`);
    try {
        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");
        const nomineesCol = db.collection("nominees");

        // 1. Fetch user
        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            console.error(`[NOMINEE-NOTIFICATION] User not found: ${userId}`);
            return;
        }
        console.log(`[NOMINEE-NOTIFICATION] User: ${user.email}`);

        // 2. Fetch nominees by string userId
        const nominees = await nomineesCol.find({ userId }).toArray();
        console.log(`[NOMINEE-NOTIFICATION] Found ${nominees.length} nominee(s) for user ${user.email}`);

        if (nominees.length === 0) {
            console.warn(`[NOMINEE-NOTIFICATION] No nominees found — marking as notified and skipping.`);
            await users.updateOne({ _id: new ObjectId(userId) }, { $set: { nomineesNotified: true } });
            return;
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        let successCount = 0;

        for (const nominee of nominees) {
            try {
                console.log(`[NOMINEE-NOTIFICATION] Processing nominee: ${nominee.name} <${nominee.email}>`);

                // 3. Generate a fresh 10-day access token
                const token = crypto.randomBytes(32).toString("hex");
                const expiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days

                // 4. Persist token to DB
                await nomineesCol.updateOne(
                    { _id: nominee._id },
                    {
                        $set: {
                            accessToken: token,
                            tokenExpiry: expiry,
                            userName: user.fullName
                        }
                    }
                );
                console.log(`[NOMINEE-NOTIFICATION] Access token saved for nominee: ${nominee.email}`);

                const accessUrl = `${frontendUrl}/nominee/verify/${token}`;

                // 5. Build the email
                const mailOptions = {
                    from: `"SecureVault" <${process.env.EMAIL_USER}>`,
                    to: nominee.email,
                    subject: `Secure Access Granted: ${user.fullName}'s Digital Vault`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #10b981;">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px 40px; text-align: center;">
                                <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 1px;">🔐 SecureVault</h1>
                                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Digital Asset Inheritance Platform</p>
                            </div>

                            <!-- Body -->
                            <div style="padding: 36px 40px; color: #e2e8f0;">
                                <h2 style="color: #10b981; font-size: 20px; margin-top: 0;">You've Been Granted Secure Access</h2>
                                <p style="line-height: 1.7;">Hello <strong>${nominee.name}</strong>,</p>
                                <p style="line-height: 1.7;">
                                    You have been designated as a nominee for <strong>${user.fullName}</strong>'s digital vault on SecureVault.
                                    As their re-engagement period has concluded, you are now authorized to access the digital assets assigned to you.
                                </p>

                                <div style="background: #1e293b; border: 1px solid #10b98133; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
                                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 12px;">Click the button below to securely access your assigned assets:</p>
                                    <a href="${accessUrl}"
                                       style="display: inline-block; background-color: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; letter-spacing: 0.5px;">
                                        Access My Assets →
                                    </a>
                                </div>

                                <p style="line-height: 1.7; color: #94a3b8; font-size: 13px;">
                                    If the button above doesn't work, copy and paste the link below into your browser:
                                </p>
                                <p style="word-break: break-all; color: #38bdf8; font-size: 12px; background: #1e293b; padding: 12px; border-radius: 6px;">${accessUrl}</p>

                                <div style="background: #1e293b; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 14px 18px; margin: 24px 0;">
                                    <p style="color: #fbbf24; font-size: 13px; font-weight: bold; margin: 0 0 4px;">⏳ Important: Link Expires in 10 Days</p>
                                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                                        This access link will expire on <strong>${expiry.toUTCString()}</strong>. Please access your assigned assets before this date.
                                    </p>
                                </div>

                                <p style="line-height: 1.7; font-size: 13px; color: #64748b;">
                                    You will be asked to verify your identity via OTP before viewing the assets.
                                    If you believe you received this email by mistake, please disregard it.
                                </p>
                            </div>

                            <!-- Footer -->
                            <div style="background: #0f172a; border-top: 1px solid #1e293b; padding: 20px 40px; text-align: center;">
                                <p style="color: #475569; font-size: 11px; margin: 0;">
                                    This is an automated security notification from SecureVault. Do not reply to this email.
                                </p>
                            </div>
                        </div>
                    `
                };

                // 6. Send email (with dev-mode fallback)
                if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    await transporter.sendMail(mailOptions);
                    console.log(`[NOMINEE-NOTIFICATION] ✅ Email sent to: ${nominee.email}`);
                    successCount++;
                } else {
                    console.warn(`[NOMINEE-NOTIFICATION] ⚠️ DEV MODE — SMTP not configured. Would have sent to: ${nominee.email}`);
                    console.log(`[NOMINEE-NOTIFICATION] Access URL: ${accessUrl}`);
                    successCount++;
                }
            } catch (nomineeErr: any) {
                console.error(`[NOMINEE-NOTIFICATION] ❌ Failed to notify nominee ${nominee.email}:`, nomineeErr.message);
                // Continue to the next nominee even if this one failed
            }
        }

        // 7. Mark user as notified (even if some emails failed — we log the failures above)
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { nomineesNotified: true } }
        );
        console.log(`[NOMINEE-NOTIFICATION] Done. ${successCount}/${nominees.length} nominees notified for user ${user.email}`);

    } catch (error: any) {
        console.error(`[NOMINEE-NOTIFICATION] ❌ Critical error in notifyNomineesForUser(${userId}):`, error.message);
        // Don't re-throw — scheduler must continue for other users
    }
}

// Core Re-Engagement Logic (V4)
export async function processReEngagementForUser(userId: string) {
    const client = await clientPromise;
    const db = client.db("securevault");
    const users = db.collection("users");
    const user = await users.findOne({ _id: new ObjectId(userId) });

    if (!user || !user.logoutTime) return;

    const testMode = process.env.INACTIVITY_TEST_MODE === "true";
    const now = Date.now();
    const logoutTime = new Date(user.logoutTime).getTime();
    const elapsed = now - logoutTime;

    // CONFIGURATION
    const WAIT_PERIOD = testMode ? (1 * 60 * 1000) : (6 * 30 * 24 * 60 * 60 * 1000); // 1 min vs 6 mo
    const DURATION = testMode ? (3 * 60 * 1000) : (2 * 30 * 24 * 60 * 60 * 1000);    // 3 min vs 2 mo
    const GAP = testMode ? (1 * 60 * 1000) : (10 * 24 * 60 * 60 * 1000);            // 1 min vs 10 days

    // STEP 1: INITIAL CALL (Exactly once after WAIT_PERIOD)
    if (elapsed >= WAIT_PERIOD && !user.reEngagementCallSent) {
        console.log(`[RE-ENGAGEMENT-V4] Triggering re-engagement call for ${user.email}`);
        await triggerReEngagementCall(userId);
    }

    // STEP 2: REMINDER EMAILS (Only within the DURATION window after WAIT_PERIOD)
    if (elapsed >= WAIT_PERIOD && elapsed < (WAIT_PERIOD + DURATION)) {
        const lastSent = user.reEngagementLastMessageAt ? new Date(user.reEngagementLastMessageAt).getTime() : 0;

        console.log(`[RE-ENGAGEMENT-V4] In window for ${user.email}. Elapsed stage: ${((elapsed - WAIT_PERIOD) / 1000).toFixed(2)}s / ${(DURATION / 1000).toFixed(2)}s`);
        console.log(`[RE-ENGAGEMENT-V4] Time since last message: ${((now - lastSent) / 1000).toFixed(2)}s. Gap required: ${(GAP / 1000).toFixed(2)}s`);

        if (now - lastSent >= GAP) {
            console.log(`[RE-ENGAGEMENT-V4] Sending reminder message to ${user.email}...`);

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: "SecureVault: Re-Engagement Reminder",
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                        <h2 style="color: #3b82f6;">We miss you at SecureVault!</h2>
                        <p>Hello ${user.fullName},</p>
                        <p>It's been a while since you last logged in. We wanted to reach out and make sure your vault assets are still secure and that you haven't forgotten your designated nominees.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="http://localhost:3000/login" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In to SecureVault</a>
                        </div>
                        <p>This is a periodic reminder to keep your account active.</p>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                        <p style="font-size: 12px; color: #64748b;">If you no longer wish to receive these reminders, simply log in and update your preferences.</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`[RE-ENGAGEMENT-V4] Reminder email sent to ${user.email}`);

            await users.updateOne(
                { _id: new ObjectId(userId) },
                {
                    $inc: { reEngagementMessagesSent: 1 },
                    $set: { reEngagementLastMessageAt: new Date().toISOString() }
                }
            );
        }
    } else if (elapsed >= (WAIT_PERIOD + DURATION)) {
        console.log(`[RE-ENGAGEMENT-V4] Re-engagement cycle COMPLETED for ${user.email}. nomineesNotified status: ${user.nomineesNotified}`);

        // STEP 3: NOTIFY NOMINEES (Triggered once cycle completes)
        if (!user.nomineesNotified) {
            console.log(`[RE-ENGAGEMENT-V4] Calling notifyNomineesForUser for ${user.email}`);
            await notifyNomineesForUser(userId);
        } else {
            console.log(`[RE-ENGAGEMENT-V4] Skipping notifyNomineesForUser for ${user.email} (already notified)`);
        }
    } else {
        console.log(`[RE-ENGAGEMENT-V4] User ${user.email} still in WAIT_PERIOD. ${((WAIT_PERIOD - elapsed) / 1000).toFixed(2)}s remaining.`);
    }
}

// --- FORGOT PASSWORD / PIN FLOW ---

// Generate Reset Token (JWT)
const generateResetToken = (userId: string, type: "password" | "pin") => {
    return jwt.sign({ userId, type, purpose: "reset" }, JWT_SECRET, { expiresIn: "15m" });
};

// 1. Forgot Request (Password or PIN)
router.post("/forgot-request", async (req: Request, res: Response) => {
    try {
        const { email, type } = req.body; // type: 'password' or 'pin'
        if (!email || !type) return res.status(400).json({ error: "Email and type required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");
        const otps = db.collection("otps");

        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Return success anyway for security (prevent email enumeration)
            return res.status(200).json({ message: "If account exists, OTP has been sent." });
        }

        // Rate limit: Max 3 requests per hour for this email
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentOTPs = await otps.countDocuments({
            email: email.toLowerCase(),
            createdAt: { $gte: oneHourAgo }
        });

        if (recentOTPs >= 3) {
            return res.status(429).json({ error: "Too many requests. Try again after an hour." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await otps.updateOne(
            { email: email.toLowerCase(), type: `forgot_${type}` },
            {
                $set: { otp, expiresAt, createdAt: new Date() }
            },
            { upsert: true }
        );

        // Send email
        const currentTransporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `SecureVault - Reset ${type === "password" ? "Password" : "PIN"}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #3b82f6;">Reset your ${type}</h2>
                    <p>You requested to reset your SecureVault ${type}. Use the code below to proceed:</p>
                    <div style="font-size: 32px; font-bold; color: #3b82f6; letter-spacing: 5px; margin: 20px 0; background: #f8fafc; padding: 10px; text-align: center; border-radius: 8px;">
                        ${otp}
                    </div>
                    <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
                </div>
            `,
        };

        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await currentTransporter.sendMail(mailOptions);
        } else {
            console.log(`[DEV MODE] OTP for ${email} (${type}): ${otp}`);
        }

        res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("Forgot Request Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. Verify OTP for Reset
router.post("/forgot-verify", async (req: Request, res: Response) => {
    try {
        const { email, otp, type } = req.body;
        if (!email || !otp || !type) return res.status(400).json({ error: "Missing required fields" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const otps = db.collection("otps");
        const users = db.collection("users");

        const record = await otps.findOne({
            email: email.toLowerCase(),
            type: `forgot_${type}`,
            otp: otp
        });

        if (!record || new Date() > record.expiresAt) {
            return res.status(400).json({ error: "Invalid or expired OTP" });
        }

        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Clean up OTP
        await otps.deleteOne({ _id: record._id });

        // Generate a reset token valid for 15 mins
        const resetToken = generateResetToken(user._id.toString(), type);

        res.status(200).json({ resetToken, message: "OTP verified. Proceed to reset." });
    } catch (error) {
        console.error("Forgot Verify Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 3. Reset Password or PIN
router.post("/reset-credential", async (req: Request, res: Response) => {
    try {
        const { resetToken, newValue, type } = req.body;
        if (!resetToken || !newValue || !type) return res.status(400).json({ error: "Missing required fields" });

        // Verify Reset Token
        let decoded: any;
        try {
            decoded = jwt.verify(resetToken, JWT_SECRET);
            if (decoded.purpose !== "reset" || decoded.type !== type) {
                return res.status(401).json({ error: "Invalid reset token" });
            }
        } catch (e) {
            return res.status(401).json({ error: "Reset token expired or invalid" });
        }

        const client = await clientPromise;
        const db = client.db("securevault");
        const users = db.collection("users");

        const hashedValue = await bcrypt.hash(newValue, 12);
        const updateField = type === "password" ? { password: hashedValue } : { pin: hashedValue };

        const result = await users.updateOne(
            { _id: new ObjectId(decoded.userId) },
            { $set: updateField }
        );

        if (result.matchedCount === 0) return res.status(404).json({ error: "User not found" });

        res.status(200).json({ message: `${type === "password" ? "Password" : "PIN"} reset successfully!` });
    } catch (error) {
        console.error("Reset Credential Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
