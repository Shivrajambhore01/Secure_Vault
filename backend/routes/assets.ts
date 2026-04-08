import express, { Request, Response } from "express";
import clientPromise from "../lib/mongodb";
import { ObjectId } from "mongodb";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateJWT } from "./auth";
import { generateAssetHash, registerAssetOnChain } from "../lib/blockchain";

const router = express.Router();

// Apply Auth Middleware to all asset routes
router.use(authenticateJWT);

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// GET all assets for a user
router.get("/:userId", async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const client = await clientPromise;
        const db = client.db("securevault");
        const assets = await db.collection("assets").find({ userId }).toArray();
        res.status(200).json(assets);
    } catch (error) {
        console.error("Fetch Assets Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST save/update an asset
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
    try {
        const { id, userId, name, type, description, nomineeId, content } = req.body;
        const file = req.file;

        if (!userId) return res.status(400).json({ error: "UserId is required" });

        const client = await clientPromise;
        const db = client.db("securevault");
        const assets = db.collection("assets");
        const users = db.collection("users");

        // Fetch user plan info
        const user = await users.findOne({ _id: new ObjectId(userId as any) });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Storage limit check
        const newFileSize = file?.size || 0;
        if ((user.storageUsed || 0) + newFileSize > user.storageLimit) {
            return res.status(403).json({ error: "Storage limit reached. Please upgrade your plan." });
        }

        // File size limit check
        const fileSizeLimit = user.plan === "free" ? 50 * 1024 * 1024 : user.plan === "pro" ? 500 * 1024 * 1024 : Infinity;
        if (newFileSize > fileSizeLimit) {
            return res.status(403).json({ error: `File size exceeds limits for ${user.plan} plan.` });
        }

        const assetData: any = {
            name,
            type,
            description,
            nomineeId,
            updatedAt: new Date().toISOString()
        };

        // If it's a file upload (Image, Video, Document, etc.)
        if (file) {
            assetData.fileName = file.originalname;
            assetData.filePaths = `/uploads/${file.filename}`;
            assetData.fileSize = file.size;
            assetData.mimeType = file.mimetype;
        }

        // If it's a Text Note or Password
        if (content) {
            assetData.content = content; // In a real app, encrypt this!
        }

        // --- BLOCKCHAIN INTEGRATION ---
        try {
            const assetContent = file ? fs.readFileSync(file.path) : (content || "");
            const assetHash = generateAssetHash(assetContent);
            
            // Get nominee wallet address (need to fetch nominee from DB)
            const nominee = await db.collection("nominees").findOne({ id: nomineeId });
            
            if (nominee && nominee.walletAddress) {
                console.log(`[Blockchain] Registering asset on chain...`);
                const blockchainData = await registerAssetOnChain(
                    assetHash, 
                    nominee.walletAddress, 
                    user.inactivityPeriod || 7
                );
                
                assetData.blockchain = {
                    assetHash: assetHash,
                    txHash: blockchainData.txHash,
                    assetId: blockchainData.assetId,
                    verified: true,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (bcError) {
            console.error("[Blockchain] Registration failed:", bcError);
            assetData.blockchain = { verified: false, error: "Chain sync failed" };
        }
        // ------------------------------

        if (id) {
            // Update existing
            await assets.updateOne(
                { id, userId },
                { $set: assetData },
                { upsert: true }
            );
        } else {
            // Create new
            const newId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            await assets.insertOne({
                id: newId,
                userId,
                ...assetData,
                createdAt: new Date().toISOString(),
            });
        }

        // Update user storage usage
        if (file) {
            await users.updateOne(
                { _id: new ObjectId(userId) },
                { $inc: { storageUsed: file.size } }
            );
        }

        res.status(200).json({ message: "Asset saved successfully" });
    } catch (error) {
        console.error("Save Asset Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// DELETE an asset
router.delete("/:userId/:id", async (req: Request, res: Response) => {
    try {
        const { userId, id } = req.params;
        const client = await clientPromise;
        const db = client.db("securevault");

        // Find asset to get its size before deletion
        const asset = await db.collection("assets").findOne({ id, userId });
        if (asset && asset.fileSize) {
            await db.collection("users").updateOne(
                { _id: new ObjectId(userId as any) },
                { $inc: { storageUsed: -asset.fileSize } }
            );
        }

        await db.collection("assets").deleteOne({ id, userId });
        res.status(200).json({ message: "Asset deleted successfully" });
    } catch (error) {
        console.error("Delete Asset Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
