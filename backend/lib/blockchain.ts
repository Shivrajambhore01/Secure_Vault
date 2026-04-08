import { ethers } from "ethers";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

/**
 * Manual ABI for SecureVaultInheritance contract
 * Based on SecureVaultInheritance.sol
 */
const CONTRACT_ABI = [
    "function registerAsset(string memory _assetHash, address _nominee, uint256 _inactivityPeriod) external returns (bytes32)",
    "function updateLastActive() external",
    "function updateLastActiveForUser(address _user) external",
    "function triggerInheritance(bytes32 _assetId) external",
    "function claimAsset(bytes32 _assetId) external",
    "function getAsset(bytes32 _assetId) external view returns (tuple(string assetHash, address owner, address nominee, uint256 lastActive, uint256 inactivityPeriod, bool exists, bool claimed))",
    "function userLastActive(address) external view returns (uint256)",
    "event AssetRegistered(bytes32 indexed assetId, string assetHash, address indexed owner, address indexed nominee)",
    "event ActivityUpdated(address indexed user, uint256 timestamp)",
    "event InheritanceTriggered(bytes32 indexed assetId, address indexed owner, address indexed nominee)",
    "event OwnershipTransferred(bytes32 indexed assetId, address indexed newOwner)"
];

const RPC_URL = process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.warn("Blockchain Service: Missing PRIVATE_KEY or CONTRACT_ADDRESS in .env");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
const contract = (wallet && CONTRACT_ADDRESS) ? new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet) : null;

/**
 * Generate SHA-256 hash of a string or buffer
 */
export function generateAssetHash(data: string | Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Register an asset on the blockchain
 */
export async function registerAssetOnChain(assetHash: string, nomineeAddress: string, inactivityPeriodDays: number) {
    if (!contract) throw new Error("Blockchain contract not initialized");

    const inactivitySeconds = inactivityPeriodDays * 24 * 60 * 60;
    
    console.log(`[Blockchain] Registering asset hash ${assetHash} for nominee ${nomineeAddress}`);
    const tx = await contract.registerAsset(assetHash, nomineeAddress, inactivitySeconds);
    const receipt = await tx.wait();
    
    // The first event is AssetRegistered
    const event = receipt.logs[0]; 
    const assetId = event.topics[1]; // Indexed assetId

    return {
        txHash: tx.hash,
        assetId: assetId
    };
}

/**
 * Update user's last active timestamp on-chain
 */
export async function updateActivityOnChain(userAddress: string) {
    if (!contract) return;

    try {
        console.log(`[Blockchain] Updating activity for ${userAddress}`);
        const tx = await contract.updateLastActiveForUser(userAddress);
        await tx.wait();
        return tx.hash;
    } catch (error) {
        console.error(`[Blockchain] Activity update failed for ${userAddress}:`, error);
    }
}

/**
 * Verify an asset hash against the blockchain record
 */
export async function verifyAssetOnChain(assetId: string) {
    if (!contract) return null;

    try {
        const asset = await contract.getAsset(assetId);
        return {
            exists: asset.exists,
            assetHash: asset.assetHash,
            owner: asset.owner,
            nominee: asset.nominee,
            claimed: asset.claimed
        };
    } catch (error) {
        console.error(`[Blockchain] Verification failed for asset ${assetId}:`, error);
        return null;
    }
}
