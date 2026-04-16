"""Input validation tests."""

import os
import time
import requests
import pytest


class TestTicketValidation:
    def test_empty_title_rejected(self, base_url, admin_session):
        profiles = admin_session.get(f"{base_url}/api/profiles").json()
        r = admin_session.post(f"{base_url}/api/tickets", json={
            "title": "",
            "profile_id": profiles[0]["id"]
        })
        assert r.status_code == 422

    def test_invalid_priority_rejected(self, base_url, admin_session):
        profiles = admin_session.get(f"{base_url}/api/profiles").json()
        r = admin_session.post(f"{base_url}/api/tickets", json={
            "title": "Test",
            "priority": "INVALID",
            "profile_id": profiles[0]["id"]
        })
        assert r.status_code == 400

    def test_invalid_sort_field_fallback(self, base_url, admin_session):
        """Invalid sort_by should not crash -- should fallback gracefully."""
        r = admin_session.get(f"{base_url}/api/tickets?sort_by=__dict__")
        assert r.status_code == 200  # Should work, just use default sort

    def test_sql_injection_in_sort(self, base_url, admin_session):
        """SQL injection attempt in sort_by should be harmless."""
        r = admin_session.get(f"{base_url}/api/tickets?sort_by=id;DROP TABLE tickets")
        assert r.status_code == 200  # Should work, invalid field ignored


class TestEnumValidation:
    def test_invalid_role_rejected(self, base_url, admin_session, is_admin):
        if not is_admin:
            pytest.skip("admin_session is not admin — DB had existing users")
        r = admin_session.get(f"{base_url}/api/admin/users")
        assert r.status_code == 200
        users = r.json()
        me = admin_session.get(f"{base_url}/api/auth/me").json()
        # Find a non-self user
        target = next((u for u in users if u["id"] != me["id"]), None)
        if target:
            r = admin_session.put(f"{base_url}/api/admin/users/{target['id']}/role", json={
                "role": "superadmin"
            })
            assert r.status_code == 400
        else:
            pytest.skip("No other users to test role change on")

    def test_invalid_frequency_rejected(self, base_url, admin_session):
        profiles = admin_session.get(f"{base_url}/api/profiles").json()
        r = admin_session.post(f"{base_url}/api/recurring", json={
            "title": "Test",
            "frequency": "hourly",
            "start_date": "2025-01-01",
            "profile_id": profiles[0]["id"]
        })
        assert r.status_code == 400


class TestBackupValidation:
    def test_invalid_backup_format_rejected(self, base_url, admin_session):
        r = admin_session.post(
            f"{base_url}/api/backup/restore",
            files={"file": ("bad.json", b'{"not": "a backup"}', "application/json")}
        )
        assert r.status_code == 400

    def test_malformed_json_rejected(self, base_url, admin_session):
        r = admin_session.post(
            f"{base_url}/api/backup/restore",
            files={"file": ("bad.json", b'not json at all', "application/json")}
        )
        assert r.status_code in (400, 422, 500)


class TestImportValidation:
    def test_unsupported_file_type_rejected(self, base_url, admin_session):
        r = admin_session.post(
            f"{base_url}/api/import",
            files={"file": ("test.txt", b"some text", "text/plain")}
        )
        assert r.status_code == 400
        assert "Unsupported" in r.text
