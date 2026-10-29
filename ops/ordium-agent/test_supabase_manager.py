import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import supabase_manager as sm


class SupabaseManagerTests(unittest.TestCase):
    def test_project_list_returns_only_allowlisted_fields(self):
        payload = [{
            "id": "abcdefghij",
            "name": "Ordium",
            "region": "eu-west-1",
            "status": "ACTIVE_HEALTHY",
            "database": {"host": "private-host"},
            "service_role_key": "must-not-leak",
        }]
        with patch.object(sm, "_management_request", return_value=payload):
            result = sm.list_projects()
        self.assertEqual(result[0]["name"], "Ordium")
        self.assertNotIn("database", result[0])
        self.assertNotIn("service_role_key", result[0])

    def test_project_ref_is_validated_before_request(self):
        with patch.object(sm, "_management_request") as request:
            with self.assertRaises(sm.SupabaseError):
                sm.get_project("../bad")
            request.assert_not_called()

    def test_missing_management_token_is_safe_error(self):
        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": ""}):
            with self.assertRaisesRegex(sm.SupabaseError, "not configured"):
                sm.list_projects()

    def test_database_url_mapping_must_be_object_of_strings(self):
        with patch.dict(os.environ, {"SUPABASE_DB_URLS_JSON": json.dumps(["bad"]), "SUPABASE_DB_URLS_FILE": ""}):
            with self.assertRaises(sm.SupabaseError):
                sm._database_urls()

    def test_database_mapping_can_be_loaded_from_protected_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "db-urls.json"
            path.write_text(json.dumps({"abcdefghij": "postgresql://example"}), encoding="utf-8")
            with patch.dict(os.environ, {"SUPABASE_DB_URLS_FILE": str(path), "SUPABASE_DB_URLS_JSON": ""}):
                self.assertEqual(sm._database_urls(), {"abcdefghij": "postgresql://example"})

    def test_database_inspection_requires_configured_project(self):
        with patch.dict(os.environ, {"SUPABASE_DB_URLS_JSON": "{}", "SUPABASE_DB_URLS_FILE": ""}):
            with self.assertRaisesRegex(sm.SupabaseError, "No database connection"):
                sm.inspect_database("abcdefghij")


if __name__ == "__main__":
    unittest.main()
