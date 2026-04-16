import os
import requests
import pytest
import time

BASE_URL = os.getenv("PTS_TEST_URL", "http://127.0.0.1:9999")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def admin_session(base_url):
    """Register/login an admin user and return an authenticated session.

    If the DB already has users, we try to login with a known test admin.
    If no users exist, first registration becomes admin.
    """
    s = requests.Session()
    # First, try to register — if DB is fresh, this becomes admin
    username = f"test_admin_{int(time.time())}"
    r = s.post(f"{base_url}/api/auth/register", json={
        "username": username,
        "password": "AdminPass1!"
    })
    if r.status_code in (200, 201):
        # Check if we got admin role
        me = s.get(f"{base_url}/api/auth/me")
        if me.status_code == 200 and me.json().get("role") == "admin":
            return s

    # If we're not admin, we need to find/use an existing admin account.
    # For CI, the DB should be fresh. For local dev with existing data,
    # set PTS_ADMIN_USER and PTS_ADMIN_PASS env vars.
    admin_user = os.getenv("PTS_ADMIN_USER", "")
    admin_pass = os.getenv("PTS_ADMIN_PASS", "")
    if admin_user and admin_pass:
        s2 = requests.Session()
        r = s2.post(f"{base_url}/api/auth/login", json={
            "username": admin_user,
            "password": admin_pass,
        })
        if r.status_code == 200:
            return s2

    # Return the session we have (may not be admin — some tests will be skipped)
    return s


@pytest.fixture(scope="session")
def is_admin(admin_session, base_url):
    """Check if the admin_session actually has admin role."""
    r = admin_session.get(f"{base_url}/api/auth/me")
    if r.status_code == 200:
        return r.json().get("role") == "admin"
    return False


@pytest.fixture(scope="session")
def user_session(base_url, admin_session):
    """Register a regular (non-admin) user and return an authenticated session."""
    s = requests.Session()
    username = f"test_user_{int(time.time())}"
    r = s.post(f"{base_url}/api/auth/register", json={
        "username": username,
        "password": "UserPass1!"
    })
    assert r.status_code in (200, 201), f"User setup failed: {r.text}"
    return s


@pytest.fixture(scope="session")
def unauthenticated_session():
    """Return a session with no auth cookies."""
    return requests.Session()
