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
    """Verify MongoDB connection on startup."""
    try:
        await client.admin.command("ping")
        print("Successfully connected to MongoDB Atlas")
    except Exception as e:
        print(f"Failed to connect to MongoDB Atlas: {e}")
        raise
