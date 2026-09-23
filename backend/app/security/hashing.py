"""
Password and PIN Hashing Service — SecureVault Enterprise
"""

import bcrypt

# Compatibility patch for passlib on Python 3.12 with bcrypt >= 4.1
if not hasattr(bcrypt, "__about__"):
    class _About:
        __version__ = getattr(bcrypt, "__version__", "4.0.1")
    bcrypt.__about__ = _About()

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_secret(secret: str) -> str:
    """Hash password or PIN with bcrypt."""
    return pwd_context.hash(secret)


def verify_secret(plain: str, hashed: str) -> bool:
    """Verify plaintext password/PIN against hash."""
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False
