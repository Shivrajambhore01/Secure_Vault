"""
Phase 1 Unit Tests: Point-of-Access Asset Authorization & Entitlement Matrix
Tests entitlement validation prior to decryption across all access scenarios.
"""

import pytest
from datetime import datetime, timedelta, timezone
from app.lib.authorization import is_nominee_authorized_for_asset, enforce_point_of_access_authorization
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_nominee_a_access_own_asset_approved_claim():
    nominee_a = {"id": "nominee_111", "email": "nomineeA@example.com"}
    asset_own = {
        "id": "asset_100",
        "name": "Nominee A Document",
        "nomineeIds": ["nominee_111"],
    }
    approved_claim = {"status": "APPROVED", "userId": "user_1"}

    authorized = await is_nominee_authorized_for_asset(nominee_a, asset_own, approved_claim)
    assert authorized is True


@pytest.mark.asyncio
async def test_nominee_a_access_nominee_b_asset_blocked():
    nominee_a = {"id": "nominee_111", "email": "nomineeA@example.com"}
    asset_b = {
        "id": "asset_200",
        "name": "Nominee B Document",
        "nomineeIds": ["nominee_222"],
    }
    approved_claim = {"status": "APPROVED", "userId": "user_1"}

    authorized = await is_nominee_authorized_for_asset(nominee_a, asset_b, approved_claim)
    assert authorized is False


@pytest.mark.asyncio
async def test_random_nominee_access_blocked():
    random_nominee = {"id": "nominee_999", "email": "random@example.com"}
    asset = {
        "id": "asset_100",
        "name": "Confidential Vault Asset",
        "nomineeIds": ["nominee_111", "nominee_222"],
    }
    approved_claim = {"status": "APPROVED", "userId": "user_1"}

    authorized = await is_nominee_authorized_for_asset(random_nominee, asset, approved_claim)
    assert authorized is False


@pytest.mark.asyncio
async def test_expired_or_rejected_claim_blocked():
    nominee_a = {"id": "nominee_111", "email": "nomineeA@example.com"}
    asset = {
        "id": "asset_100",
        "name": "Asset",
        "nomineeIds": ["nominee_111"],
    }
    rejected_claim = {"status": "REJECTED", "userId": "user_1"}

    authorized = await is_nominee_authorized_for_asset(nominee_a, asset, rejected_claim)
    assert authorized is False


@pytest.mark.asyncio
async def test_approved_claim_unauthorized_asset_blocked():
    nominee_a = {"id": "nominee_111", "email": "nomineeA@example.com"}
    asset_unauthorized = {
        "id": "asset_300",
        "name": "Financial Ledger",
        "nomineeIds": ["nominee_333"],
    }
    approved_claim = {"status": "KEY_RELEASE_GRANTED", "userId": "user_1"}

    authorized = await is_nominee_authorized_for_asset(nominee_a, asset_unauthorized, approved_claim)
    assert authorized is False


def test_enforce_point_of_access_raises_http_exception():
    nominee_a = {"id": "nominee_111", "email": "nomineeA@example.com"}
    asset_unauthorized = {
        "id": "asset_300",
        "name": "Financial Ledger",
        "nomineeIds": ["nominee_333"],
    }

    with pytest.raises(HTTPException) as exc_info:
        enforce_point_of_access_authorization(
            caller_is_owner=False,
            nominee=nominee_a,
            asset=asset_unauthorized,
            claim_workflow={"status": "APPROVED"}
        )
    assert exc_info.value.status_code == 403
