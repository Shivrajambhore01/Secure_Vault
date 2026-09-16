# pytest conftest for SecureVault tests
import pytest
from app.core.config import get_settings
from app.lib.rate_limit import reset_rate_limits

settings = get_settings()

@pytest.fixture(autouse=True)
def configure_test_rate_limits():
    """Ensure automated test suites are not artificially throttled by global rate limits."""
    original_limit = settings.RATE_LIMIT_PER_MINUTE
    settings.RATE_LIMIT_PER_MINUTE = 10000
    reset_rate_limits()
    yield
    reset_rate_limits()
    settings.RATE_LIMIT_PER_MINUTE = original_limit
