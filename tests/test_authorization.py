"""Authorization and data isolation tests."""

import os
import time
import requests
import pytest


class TestUnauthenticatedAccess:
    """All protected endpoints should return 401 without auth."""

    PROTECTED_ENDPOINTS = [
        ("GET", "/api/tickets"),
        ("POST", "/api/tickets"),
        ("GET", "/api/queue/next"),
        ("GET", "/api/queue/stats"),
        ("GET", "/api/recurring"),
        ("GET", "/api/profiles"),
        ("GET", "/api/config"),
        ("POST", "/api/backup"),
        ("GET", "/api/admin/users"),
        ("GET", "/api/auth/me"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_endpoint_requires_auth(self, base_url, unauthenticated_session, method, path):
        r = unauthenticated_session.request(method, f"{base_url}{path}")
        assert r.status_code == 401, f"{method} {path} returned {r.status_code}, expected 401"


class TestAdminOnlyEndpoints:
    """Non-admin users should get 403 on admin endpoints."""

    def test_user_cannot_list_users(self, base_url, user_session):
        r = user_session.get(f"{base_url}/api/admin/users")
        assert r.status_code == 403

    def test_user_cannot_change_config(self, base_url, user_session):
        r = user_session.put(f"{base_url}/api/config", json={"age_weight": 5.0})
        assert r.status_code == 403

    def test_admin_can_list_users(self, base_url, admin_session, is_admin):
        if not is_admin:
            pytest.skip("admin_session is not admin — DB had existing users")
        r = admin_session.get(f"{base_url}/api/admin/users")
        assert r.status_code == 200

    def test_admin_can_change_config(self, base_url, admin_session, is_admin):
        if not is_admin:
            pytest.skip("admin_session is not admin — DB had existing users")
        r = admin_session.put(f"{base_url}/api/config", json={"age_weight": 10.0})
        assert r.status_code == 200


class TestDataIsolation:
    """Users should never see each other's data."""

    def test_user_cannot_see_others_tickets(self, base_url, admin_session, user_session):
        # Admin creates a ticket
        admin_profiles = admin_session.get(f"{base_url}/api/profiles").json()
        if admin_profiles:
            admin_session.post(f"{base_url}/api/tickets", json={
                "title": "Admin Secret Ticket",
                "profile_id": admin_profiles[0]["id"]
            })

        # User should not see it
        user_tickets = user_session.get(f"{base_url}/api/tickets").json()
        admin_titles = [t["title"] for t in user_tickets]
        assert "Admin Secret Ticket" not in admin_titles

    def test_user_cannot_see_others_profiles(self, base_url, admin_session, user_session):
        admin_profiles = admin_session.get(f"{base_url}/api/profiles").json()
        user_profiles = user_session.get(f"{base_url}/api/profiles").json()

        admin_ids = {p["id"] for p in admin_profiles}
        user_ids = {p["id"] for p in user_profiles}
        assert admin_ids.isdisjoint(user_ids), "Users should not share profile IDs"

    def test_user_cannot_access_others_ticket_by_id(self, base_url, admin_session, user_session):
        # Admin creates a ticket
        admin_profiles = admin_session.get(f"{base_url}/api/profiles").json()
        if admin_profiles:
            r = admin_session.post(f"{base_url}/api/tickets", json={
                "title": "Private Admin Ticket",
                "profile_id": admin_profiles[0]["id"]
            })
            if r.status_code == 201:
                ticket_id = r.json()["id"]
                # User tries to access it
                r2 = user_session.get(f"{base_url}/api/tickets/{ticket_id}")
                assert r2.status_code in (403, 404), "User should not access another user's ticket"

    def test_user_cannot_access_others_profile_by_id(self, base_url, admin_session, user_session):
        admin_profiles = admin_session.get(f"{base_url}/api/profiles").json()
        if admin_profiles:
            r = user_session.get(f"{base_url}/api/profiles/{admin_profiles[0]['id']}")
            assert r.status_code in (403, 404)
