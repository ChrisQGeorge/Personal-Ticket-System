"""Authentication tests."""

import os
import time
import requests
import pytest


class TestLogin:
    def test_valid_login(self, base_url):
        s = requests.Session()
        username = f"login_test_{int(time.time())}"
        s.post(f"{base_url}/api/auth/register", json={
            "username": username, "password": "TestPass1!"
        })
        r = s.post(f"{base_url}/api/auth/login", json={
            "username": username, "password": "TestPass1!"
        })
        assert r.status_code == 200
        assert "user" in r.json()

    def test_invalid_password(self, base_url):
        s = requests.Session()
        username = f"badpw_{int(time.time())}"
        s.post(f"{base_url}/api/auth/register", json={
            "username": username, "password": "TestPass1!"
        })
        r = s.post(f"{base_url}/api/auth/login", json={
            "username": username, "password": "WrongPass1!"
        })
        assert r.status_code == 401

    def test_nonexistent_user(self, base_url):
        r = requests.post(f"{base_url}/api/auth/login", json={
            "username": "nonexistent_user_xyz", "password": "anything"
        })
        assert r.status_code == 401

    def test_login_error_is_generic(self, base_url):
        """Error message should not reveal whether the username exists."""
        r1 = requests.post(f"{base_url}/api/auth/login", json={
            "username": "definitely_not_real", "password": "Pass1234!"
        })
        # Should say "Invalid credentials" regardless
        assert "Invalid credentials" in r1.json().get("detail", "")


class TestRegistration:
    def test_first_user_is_admin(self, admin_session, base_url, is_admin):
        """First registered user should be admin. Skip if DB already had users."""
        if not is_admin:
            pytest.skip("DB already had users — admin_session is not admin")
        r = admin_session.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_subsequent_user_is_regular(self, user_session, base_url):
        r = user_session.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "user"

    def test_duplicate_username_rejected(self, base_url, admin_session):
        me = admin_session.get(f"{base_url}/api/auth/me").json()
        r = requests.post(f"{base_url}/api/auth/register", json={
            "username": me["username"], "password": "DupeTest1!"
        })
        assert r.status_code == 400

    def test_username_enumeration_prevented(self, base_url, admin_session):
        """Duplicate username error should not reveal the username exists."""
        me = admin_session.get(f"{base_url}/api/auth/me").json()
        r = requests.post(f"{base_url}/api/auth/register", json={
            "username": me["username"], "password": "DupeTest1!"
        })
        # Should NOT say "already taken"
        detail = r.json().get("detail", "")
        assert "already taken" not in detail.lower()
        assert "already exists" not in detail.lower()


class TestPasswordPolicy:
    def test_short_password_rejected(self, base_url):
        r = requests.post(f"{base_url}/api/auth/register", json={
            "username": f"short_{int(time.time())}", "password": "Ab1"
        })
        assert r.status_code == 422

    def test_no_uppercase_rejected(self, base_url):
        r = requests.post(f"{base_url}/api/auth/register", json={
            "username": f"noup_{int(time.time())}", "password": "lowercase1"
        })
        assert r.status_code == 422

    def test_no_lowercase_rejected(self, base_url):
        r = requests.post(f"{base_url}/api/auth/register", json={
            "username": f"nolow_{int(time.time())}", "password": "UPPERCASE1"
        })
        assert r.status_code == 422

    def test_no_digit_rejected(self, base_url):
        r = requests.post(f"{base_url}/api/auth/register", json={
            "username": f"nodig_{int(time.time())}", "password": "NoDigitsHere"
        })
        assert r.status_code == 422

    def test_valid_password_accepted(self, base_url):
        r = requests.post(f"{base_url}/api/auth/register", json={
            "username": f"valid_{int(time.time())}", "password": "ValidPass1!"
        })
        assert r.status_code in (200, 201)


class TestPasswordChange:
    def test_change_password(self, base_url):
        s = requests.Session()
        username = f"chpw_{int(time.time())}"
        s.post(f"{base_url}/api/auth/register", json={
            "username": username, "password": "OldPass1!"
        })
        r = s.post(f"{base_url}/api/auth/change-password", json={
            "current_password": "OldPass1!",
            "new_password": "NewPass1!"
        })
        assert r.status_code == 200
        # Verify can login with new password
        s2 = requests.Session()
        r2 = s2.post(f"{base_url}/api/auth/login", json={
            "username": username, "password": "NewPass1!"
        })
        assert r2.status_code == 200

    def test_wrong_current_password_fails(self, base_url):
        s = requests.Session()
        username = f"wrongcur_{int(time.time())}"
        s.post(f"{base_url}/api/auth/register", json={
            "username": username, "password": "Current1!"
        })
        r = s.post(f"{base_url}/api/auth/change-password", json={
            "current_password": "WrongOne1",
            "new_password": "NewPass1!"
        })
        assert r.status_code == 401


class TestLogout:
    def test_logout_clears_session(self, base_url):
        s = requests.Session()
        username = f"logout_{int(time.time())}"
        s.post(f"{base_url}/api/auth/register", json={
            "username": username, "password": "LogoutTest1!"
        })
        # Should be authenticated
        r = s.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        # Logout
        s.post(f"{base_url}/api/auth/logout")
        # Should be unauthenticated
        r = s.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401
