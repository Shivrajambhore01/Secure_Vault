"""Payment Provider Interface — SecureVault.

Abstracts payment verification behind a provider interface so the
Subscription/Invoice/Audit logic is decoupled from the payment method.

Current: ManualUpiProvider (manual UPI + screenshot + admin review)
Future:  RazorpayProvider (automated payment gateway — not implemented)
"""

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.binary import Binary
from fastapi import HTTPException

from app.core.database import db
from app.core.plans import get_plan, get_plan_price, PAID_PLANS
from app.lib.encryption import encrypt_bytes

payment_requests_col = db["payment_requests"]


class PaymentProvider(ABC):
    """Abstract base class for payment providers."""

    @abstractmethod
    async def create_payment_request(
        self,
        user_id: str,
        plan_id: str,
        **kwargs,
    ) -> dict:
        """Create a new payment request. Returns the created document."""
        ...

    @abstractmethod
    async def get_payment_request(self, request_id: str) -> Optional[dict]:
        """Retrieve a payment request by its ID."""
        ...


class ManualUpiProvider(PaymentProvider):
    """Manual UPI payment provider.

    Users submit a UTR/transaction ID and screenshot of their UPI payment.
    An admin (SUPPORT_ADMIN) manually reviews and approves/rejects.
    """

    async def create_payment_request(
        self,
        user_id: str,
        plan_id: str,
        *,
        utr_id: str,
        screenshot_data: bytes,
        screenshot_filename: str,
        screenshot_mime_type: str,
        user_email: str = "",
        user_name: str = "",
    ) -> dict:
        """Create a manual UPI payment request.

        Raises:
            HTTPException 400: If plan_id is not a paid plan
            HTTPException 409: If user already has a PENDING request
        """
        # Validate plan
        if plan_id not in PAID_PLANS:
            raise HTTPException(
                status_code=400,
                detail="Cannot create payment request for free plan.",
            )

        # Block duplicate PENDING requests for the same user
        existing_pending = await payment_requests_col.find_one({
            "userId": user_id,
            "status": "PENDING",
        })
        if existing_pending:
            raise HTTPException(
                status_code=409,
                detail="You already have a pending payment request. "
                       "Please wait for it to be reviewed.",
            )

        # Server-determined price — never trust frontend
        amount = get_plan_price(plan_id)
        plan = get_plan(plan_id)

        # Encrypt screenshot before storage
        encrypted_screenshot = encrypt_bytes(screenshot_data)

        request_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        doc = {
            "id": request_id,
            "userId": user_id,
            "userEmail": user_email,
            "userName": user_name,
            "planId": plan_id,
            "planName": plan["name"],
            "amount": amount,
            "currency": "INR",
            "utrId": utr_id.strip(),
            "screenshotData": Binary(encrypted_screenshot),
            "screenshotFilename": screenshot_filename,
            "screenshotMimeType": screenshot_mime_type,
            "status": "PENDING",
            "adminRemark": None,
            "reviewedBy": None,
            "reviewedByRole": None,
            "submittedAt": now,
            "reviewedAt": None,
        }

        await payment_requests_col.insert_one(doc)

        # Return without binary data
        safe_doc = {k: v for k, v in doc.items() if k != "screenshotData"}
        safe_doc["_id"] = str(doc.get("_id", ""))
        return safe_doc

    async def get_payment_request(self, request_id: str) -> Optional[dict]:
        """Retrieve a payment request by ID (without screenshot binary)."""
        doc = await payment_requests_col.find_one(
            {"id": request_id},
            {"screenshotData": 0},
        )
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc


# Singleton instance for the current provider
_current_provider: Optional[PaymentProvider] = None


def get_payment_provider() -> PaymentProvider:
    """Get the active payment provider instance."""
    global _current_provider
    if _current_provider is None:
        _current_provider = ManualUpiProvider()
    return _current_provider
