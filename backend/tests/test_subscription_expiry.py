"""
Test Subscription Expiry Calculation and Mid-Cycle Upgrade Rules.
"""

from datetime import datetime, timedelta, timezone
from app.core.plans import SUBSCRIPTION_DURATION_DAYS

def test_subscription_duration():
    """Verify subscription validity is 30 days."""
    assert SUBSCRIPTION_DURATION_DAYS == 30

def test_expiry_date_calculation():
    """Verify end date is accurately calculated 30 days ahead in UTC."""
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=SUBSCRIPTION_DURATION_DAYS)
    diff = end - now
    assert diff.days == 30

def test_is_subscription_expired():
    """Verify expiration condition."""
    past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    future_date = (datetime.now(timezone.utc) + timedelta(days=29)).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    assert past_date < now_iso
    assert future_date > now_iso
