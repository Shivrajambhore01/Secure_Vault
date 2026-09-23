"""MongoDB async connection using Motor."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings

settings = get_settings()

client: AsyncIOMotorClient = AsyncIOMotorClient(settings.MONGODB_URI)
db: AsyncIOMotorDatabase = client["securevault"]


async def get_db() -> AsyncIOMotorDatabase:
    """Dependency to get the database instance."""
    return db


async def verify_connection():
    """Verify MongoDB connection on startup and create necessary indexes."""
    try:
        await client.admin.command("ping")
        print("Successfully connected to MongoDB Atlas")

        # Initialize collections indexes
        try:
            # Payment requests indexes
            await db["payment_requests"].create_index([("userId", 1), ("status", 1)])
            await db["payment_requests"].create_index([("id", 1)], unique=True)
            await db["payment_requests"].create_index([("status", 1), ("submittedAt", -1)])

            # Subscriptions indexes
            await db["subscriptions"].create_index([("userId", 1), ("status", 1)])
            await db["subscriptions"].create_index([("id", 1)], unique=True)
            await db["subscriptions"].create_index([("status", 1), ("endDate", 1)])

            # Invoices indexes
            await db["invoices"].create_index([("userId", 1), ("issuedAt", -1)])
            await db["invoices"].create_index([("id", 1)], unique=True)
            await db["invoices"].create_index([("paymentRequestId", 1)])

            # Billing audit logs indexes
            await db["billing_audit_logs"].create_index([("userId", 1), ("createdAt", -1)])
            await db["billing_audit_logs"].create_index([("action", 1)])
        except Exception as idx_err:
            print(f"Index creation note: {idx_err}")

    except Exception as e:
        print(f"⚠️ Warning: Failed to connect to MongoDB: {e}")
