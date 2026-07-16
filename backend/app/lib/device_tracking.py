"""
Device Tracking & Fingerprinting — SecureVault Enterprise

Records browser and device metadata on every authenticated request.
Used by the Risk Engine to detect anomalous access patterns.

What is stored per session:
  - Browser name & version (from User-Agent parsing)
  - Operating system
  - Client IP address
  - Country / City / ASN (via ip-api.com if available)
  - Screen resolution, timezone, language (from client-sent headers)
  - Fingerprint hash (SHA-256 of device signals)

Device history is stored in the 'device_sessions' collection.
New devices trigger a risk-score increment in the Risk Engine.
"""

import hashlib
import httpx
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from app.core.database import db

logger = logging.getLogger("securevault.device")
device_sessions_col = db["device_sessions"]

# ip-api.com free tier: 45 requests/minute (no API key needed)
GEO_API_URL = "http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,isp,org,as,proxy,hosting"


def _extract_ua_info(user_agent: str) -> dict:
    """
    Basic user-agent parsing without external library dependency.
    Returns browser and OS name strings.
    """
    ua = user_agent.lower()
    browser = "Unknown"
    os_name = "Unknown"

    if "firefox/" in ua:
        browser = "Firefox"
    elif "edg/" in ua:
        browser = "Edge"
    elif "chrome/" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "safari/" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "opera" in ua or "opr/" in ua:
        browser = "Opera"

    if "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os x" in ua:
        os_name = "macOS"
    elif "linux" in ua and "android" not in ua:
        os_name = "Linux"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"

    return {"browser": browser, "os": os_name}


def _build_fingerprint(ip: str, ua: str, tz: str = "", lang: str = "") -> str:
    """
    Generate a deterministic fingerprint hash from device signals.
    SHA-256 of ip + user-agent + timezone + language.
    This is NOT a tracking cookie — it's a risk signal only.
    """
    raw = f"{ip}|{ua}|{tz}|{lang}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def _resolve_geo(ip: str) -> dict:
    """
    Resolve IP to geo/ASN info using ip-api.com.
    Returns empty dict on failure (network errors are swallowed).
    """
    if ip in ("unknown", "127.0.0.1", "::1", "localhost"):
        return {"country": "LOCAL", "countryCode": "LOCAL", "city": "Local", "isVpn": False, "isTor": False}
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(GEO_API_URL.format(ip=ip))
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    return {
                        "country": data.get("country", ""),
                        "countryCode": data.get("countryCode", ""),
                        "city": data.get("city", ""),
                        "isp": data.get("isp", ""),
                        "asn": data.get("as", ""),
                        "isVpn": data.get("proxy", False) or data.get("hosting", False),
                        "isTor": False,  # ip-api free doesn't detect TOR; use paid or ipinfo.io
                    }
    except Exception as exc:
        logger.debug("GeoIP lookup failed for %s: %s", ip, exc)
    return {}


def get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting forwarded headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


async def capture_device_info(
    request: Request,
    user_id: Optional[str] = None,
    session_context: str = "unknown",
) -> dict:
    """
    Capture device + geo information for a request.
    Saves the device record to the database and returns the info dict.

    Parameters
    ----------
    request          : FastAPI Request object
    user_id          : Owner or nominee ID associated with this request
    session_context  : Label for where this capture occurred (e.g. 'login', 'claim')

    Returns
    -------
    Dict with keys: ip, browser, os, fingerprint, country, isVpn, isTor, isNewDevice
    """
    ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "unknown")
    tz = request.headers.get("x-client-timezone", "")
    lang = request.headers.get("accept-language", "")

    ua_info = _extract_ua_info(ua)
    fingerprint = _build_fingerprint(ip, ua, tz, lang)
    geo = await _resolve_geo(ip)

    # Check if this fingerprint has been seen before for this user
    is_new_device = True
    if user_id:
        existing = await device_sessions_col.find_one({
            "userId": user_id,
            "fingerprint": fingerprint,
        })
        is_new_device = existing is None

    device_info = {
        "ip": ip,
        "userAgent": ua,
        "browser": ua_info["browser"],
        "os": ua_info["os"],
        "timezone": tz,
        "language": lang,
        "fingerprint": fingerprint,
        "country": geo.get("country", ""),
        "countryCode": geo.get("countryCode", ""),
        "city": geo.get("city", ""),
        "isp": geo.get("isp", ""),
        "asn": geo.get("asn", ""),
        "is_vpn": geo.get("isVpn", False),
        "is_tor": geo.get("isTor", False),
        "is_new_device": is_new_device,
        "capturedAt": datetime.now(timezone.utc).isoformat(),
    }

    # Persist the device session record
    try:
        await device_sessions_col.update_one(
            {"userId": user_id, "fingerprint": fingerprint},
            {
                "$set": {
                    "userId": user_id,
                    "fingerprint": fingerprint,
                    "browser": ua_info["browser"],
                    "os": ua_info["os"],
                    "country": geo.get("country", ""),
                    "lastSeen": datetime.now(timezone.utc).isoformat(),
                    "context": session_context,
                },
                "$setOnInsert": {
                    "firstSeen": datetime.now(timezone.utc).isoformat(),
                },
                "$inc": {"visitCount": 1},
            },
            upsert=True,
        )
    except Exception as exc:
        logger.error("Failed to save device session: %s", exc)

    return device_info
