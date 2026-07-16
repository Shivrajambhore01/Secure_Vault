import sys
import os
import asyncio

# Add current folder to sys.path to resolve app imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import db

async def reset_db():
    print("Connecting to database...")
    # Delete from all verification collections to reset the flow completely
    col_names = [
        "verification_requests",
        "verification_documents",
        "verification_logs",
        "verification_sessions",
        "verification_status_history",
        "verification_otps"
    ]

    print("\n--- Resetting Verification Database ---")
    for name in col_names:
        col = db[name]
        res = await col.delete_many({})
        print(f"Cleared collection '{name}': deleted {res.deleted_count} documents.")

    print("\nDatabase reset complete! You can now start the workflow from Step 1 again.")

if __name__ == "__main__":
    asyncio.run(reset_db())
