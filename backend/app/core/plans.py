"""Static plan configuration — SecureVault Subscription Plans.

These are NOT stored in the database and NOT editable via API.
All plan enforcement references this single source of truth.

Core security features (Death Verification, Identity Verification,
Encryption, basic Inactivity Monitoring) are available on ALL plans.
"""

PLANS = {
    "free": {
        "id": "free",
        "name": "Free",
        "price": 0,                                    # ₹0
        "currency": "INR",
        "billing_period": "forever",
        "storage_limit": 50 * 1024 * 1024,             # 50 MB
        "file_size_limit": 5 * 1024 * 1024,            # 5 MB
        "nominee_limit": 1,
        "asset_limit": 5,
        "features": [
            "50 MB Secure Storage",
            "5 MB Max File Size",
            "1 Nominee",
            "5 Digital Assets",
            "AES-256 Encryption",
            "Death Verification",
            "Inactivity Monitoring",
        ],
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price": 199,                                   # ₹199/mo
        "currency": "INR",
        "billing_period": "monthly",
        "storage_limit": 5 * 1024 * 1024 * 1024,       # 5 GB
        "file_size_limit": 100 * 1024 * 1024,           # 100 MB
        "nominee_limit": 5,
        "asset_limit": 50,
        "features": [
            "5 GB Secure Storage",
            "100 MB Max File Size",
            "5 Nominees",
            "50 Digital Assets",
            "AES-256 Encryption",
            "Death Verification",
            "Inactivity Monitoring",
            "Priority Support",
        ],
    },
    "premium": {
        "id": "premium",
        "name": "Premium",
        "price": 499,                                   # ₹499/mo
        "currency": "INR",
        "billing_period": "monthly",
        "storage_limit": 25 * 1024 * 1024 * 1024,      # 25 GB
        "file_size_limit": 500 * 1024 * 1024,           # 500 MB
        "nominee_limit": 10,
        "asset_limit": 1000,                            # soft cap
        "features": [
            "25 GB Secure Storage",
            "500 MB Max File Size",
            "10 Nominees",
            "Unlimited Assets (soft cap 1000)",
            "AES-256 Encryption",
            "Death Verification",
            "Inactivity Monitoring",
            "Priority Support",
            "Early Feature Access",
        ],
    },
}

# Convenience: list of paid plan IDs
PAID_PLANS = {"pro", "premium"}

# Subscription duration in days
SUBSCRIPTION_DURATION_DAYS = 30


def get_plan(plan_id: str) -> dict:
    """Get plan config by ID. Returns Free plan for unknown IDs."""
    return PLANS.get(plan_id, PLANS["free"])


def get_plan_price(plan_id: str) -> int:
    """Get server-authoritative price for a plan. Never trust frontend."""
    plan = get_plan(plan_id)
    return plan["price"]


def get_all_plans() -> list[dict]:
    """Return all plans as a list (for the public /plans endpoint)."""
    return list(PLANS.values())
