#!/usr/bin/env python3
"""One-time script to create the first SUPER_ADMIN account.

Usage:
    python create_super_admin.py

Or with arguments:
    python create_super_admin.py --email admin@securevault.com --name "Super Admin" --password "yourpassword"

This script is safe to run multiple times — it checks if the email already exists.
"""

import asyncio
import argparse
import random
import string
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv()

import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_id() -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=13)) + hex(int(time.time()))[2:]


async def create_super_admin(email: str, full_name: str, password: str):
    mongodb_uri = os.getenv("MONGODB_URI")
    if not mongodb_uri:
        print("ERROR: MONGODB_URI is not set in .env")
        return

    client = AsyncIOMotorClient(mongodb_uri)
    db = client["securevault"]
    admins_col = db["admins"]

    email = email.strip().lower()

    # Check if email already exists
    existing = await admins_col.find_one({"email": email})
    if existing:
        print(f"An admin with email '{email}' already exists (role={existing['role']}, status={existing['status']}).")
        print("If you want to reset the password, use the Admin Dashboard instead.")
        client.close()
        return

    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters.")
        client.close()
        return

    hashed = pwd_context.hash(password)
    now = datetime.now(timezone.utc).isoformat()

    admin_doc = {
        "id": generate_id(),
        "fullName": full_name.strip(),
        "email": email,
        "password": hashed,
        "role": "SUPER_ADMIN",
        "status": "ACTIVE",
        "createdAt": now,
        "updatedAt": now,
        "lastLogin": None,
        "createdBy": "seed_script",
    }

    result = await admins_col.insert_one(admin_doc)

    print("\n" + "=" * 60)
    print("  [SUCCESS] SUPER ADMIN CREATED SUCCESSFULLY")
    print("=" * 60)
    print(f"  ID       : {admin_doc['id']}")
    print(f"  Name     : {admin_doc['fullName']}")
    print(f"  Email    : {admin_doc['email']}")
    print(f"  Role     : {admin_doc['role']}")
    print(f"  Status   : {admin_doc['status']}")
    print(f"  MongoDB  : _id={result.inserted_id}")
    print("=" * 60)
    print("\n  -> Login at: http://localhost:3000/admin/login")
    print("  [WARNING] Keep these credentials secure!\n")

    client.close()


def main():
    parser = argparse.ArgumentParser(description="Create the first SecureVault Super Admin.")
    parser.add_argument("--email", type=str, default=None, help="Admin email address")
    parser.add_argument("--name", type=str, default=None, help="Admin full name")
    parser.add_argument("--password", type=str, default=None, help="Admin password (min 8 chars)")
    args = parser.parse_args()

    email = args.email or input("Admin Email: ").strip()
    full_name = args.name or input("Admin Full Name: ").strip()
    password = args.password or input("Admin Password (min 8 chars): ").strip()

    if not email or not full_name or not password:
        print("ERROR: Email, name, and password are all required.")
        return

    asyncio.run(create_super_admin(email, full_name, password))


if __name__ == "__main__":
    main()
