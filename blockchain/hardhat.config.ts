import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Read private key safely
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/**
 * Hardhat Configuration
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // ✅ Polygon Amoy Testnet (FREE testing network)
    amoy: {
      url:
        process.env.POLYGON_AMOY_RPC_URL ||
        "https://rpc-amoy.polygon.technology",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 80002,
    },

    // ✅ Polygon Mainnet (use later for production)
    polygonMainnet: {
      url:
        process.env.POLYGON_MAINNET_RPC_URL ||
        "https://polygon-rpc.com",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 137,
    },
  },

  // Optional: contract verification (PolygonScan)
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY || "",
  },
};

export default config;