from datetime import datetime, timezone
from app.core.database import db

audit_col = db["audit_logs"]

async def write_audit_log(
    user_id: str,
    action: str,
    status: str,
    ip_address: str,
    user_agent: str,
    metadata: dict = None
):
    """Write an entry to the audit logs collection in MongoDB."""
    log_entry = {
        "userId": user_id,
        "action": action,
        "status": status,
        "ipAddress": ip_address,
        "userAgent": user_agent,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {}
    }
    try:
        await audit_col.insert_one(log_entry)
        print(f"[AUDIT] {action} by User {user_id} - Status: {status} - Metadata: {metadata}")
    except Exception as e:
        print(f"[AUDIT ERROR] Failed to write audit log: {e}")
