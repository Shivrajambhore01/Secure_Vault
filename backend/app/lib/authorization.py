"""
Point-of-Access Asset Authorization & Entitlement Engine
Enforces strict asset-level access policy checks immediately prior to decryption.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException

logger = logging.getLogger("securevault.authorization")

ALLOWED_CLAIM_RELEASE_STATES = {"APPROVED", "KEY_RELEASE_GRANTED", "ASSET_RELEASED", "DUAL_APPROVED"}


async def is_nominee_authorized_for_asset(
    nominee: Dict[str, Any],
    asset: Dict[str, Any],
    claim_workflow: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Evaluates point-of-access authorization for a nominee requesting a specific asset.
    Checks:
      1. Claim Approval State (Must be APPROVED / KEY_RELEASE_GRANTED / ASSET_RELEASED)
      2. Nominee Entitlement (Nominee ID must be in asset.nomineeIds or asset.nomineeId)
      3. Release Policy Compliance (If policy defined, verify preconditions)
    Returns True if authorized, False otherwise.
    """
    if not nominee or not asset:
        return False

    # 1. Claim State Check (if claim workflow is provided or present)
    if claim_workflow:
        claim_status = claim_workflow.get("status", "")
        if claim_status not in ALLOWED_CLAIM_RELEASE_STATES:
            logger.warning(
                f"[Authz Blocked] Claim status '{claim_status}' not allowed for asset release. "
                f"Asset: {asset.get('id')}, Nominee: {nominee.get('id')}"
            )
            return False

    # 2. Nominee-Asset Entitlement Check
    nominee_id = nominee.get("id") or str(nominee.get("_id"))
    nominee_email = nominee.get("email")

    allowed_nominee_ids = asset.get("nomineeIds") or []
    if not allowed_nominee_ids and asset.get("nomineeId"):
        allowed_nominee_ids = [asset.get("nomineeId")]

    # Check match against nominee ID, _id string, or nominee email
    is_entitled = (
        nominee_id in allowed_nominee_ids
        or str(nominee.get("_id")) in allowed_nominee_ids
        or (nominee_email and nominee_email in allowed_nominee_ids)
    )

    if not is_entitled:
        logger.warning(
            f"[Authz Blocked] Nominee '{nominee_id}' ({nominee_email}) is NOT authorized for asset '{asset.get('id')}'. "
            f"Allowed nominees: {allowed_nominee_ids}"
        )
        return False

    # 3. Release Policy Verification (if defined on asset)
    release_policy = asset.get("releasePolicy")
    if release_policy and isinstance(release_policy, dict):
        # Check cooling period requirement
        cooling_days = release_policy.get("coolingPeriodDays")
        if cooling_days and claim_workflow:
            submitted_at = claim_workflow.get("createdAt")
            if submitted_at:
                try:
                    sub_dt = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
                    elapsed_days = (datetime.now(timezone.utc) - sub_dt).days
                    if elapsed_days < cooling_days:
                        logger.warning(
                            f"[Authz Blocked] Cooling period of {cooling_days} days not met for asset '{asset.get('id')}'. "
                            f"Elapsed: {elapsed_days} days."
                        )
                        return False
                except Exception as e:
                    logger.error(f"[Authz Error] Failed to parse claim submission date: {e}")

    return True


def enforce_point_of_access_authorization(
    caller_is_owner: bool,
    nominee: Optional[Dict[str, Any]],
    asset: Dict[str, Any],
    claim_workflow: Optional[Dict[str, Any]] = None,
):
    """
    Enforces point-of-access authorization. Raises HTTPException if unauthorized.
    """
    if caller_is_owner:
        return True

    if not nominee:
        raise HTTPException(status_code=401, detail="Authentication token required to access asset")

    # Nominee token expiry check
    expiry = nominee.get("tokenExpiry")
    if expiry:
        try:
            if isinstance(expiry, str):
                expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            else:
                expiry_dt = expiry
            if datetime.now(timezone.utc) > expiry_dt:
                raise HTTPException(status_code=401, detail="Nominee access token has expired")
        except HTTPException:
            raise
        except Exception:
            pass

    # Check nominee entitlement & claim approval state
    nominee_id = nominee.get("id") or str(nominee.get("_id"))
    allowed_nominee_ids = asset.get("nomineeIds") or []
    if not allowed_nominee_ids and asset.get("nomineeId"):
        allowed_nominee_ids = [asset.get("nomineeId")]

    if nominee_id not in allowed_nominee_ids and str(nominee.get("_id")) not in allowed_nominee_ids:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not authorized to view or decrypt this specific asset."
        )

    if claim_workflow:
        claim_status = claim_workflow.get("status", "")
        if claim_status not in ALLOWED_CLAIM_RELEASE_STATES:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Claim status '{claim_status}' is not approved for asset release."
            )
