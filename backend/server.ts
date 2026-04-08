import dotenv from "dotenv";
import path from "path";

dotenv.config(); // Loads backend/.env
dotenv.config({ path: path.join(__dirname, "..", ".env.local") }); // Also try root .env.local

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import assetRoutes from "./routes/assets";
import nomineeRoutes from "./routes/nominees";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/nominees", nomineeRoutes);

app.get("/", (req, res) => {
    res.send("SecureVault Backend API is running...");
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    // Start background inactivity monitoring scheduler
    import("./lib/scheduler").then(({ startInactivityScheduler }) => {
        startInactivityScheduler();
    }).catch((err) => {
        console.error("Failed to start inactivity scheduler:", err);
    });
});
