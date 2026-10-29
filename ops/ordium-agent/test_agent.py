import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agent


class AgentSafetyTests(unittest.TestCase):
    def test_allows_application_source(self):
        self.assertTrue(agent.safe_path("api/app/services/risk_engine.py"))
        self.assertTrue(agent.safe_path("web/src/components/Dashboard.tsx"))
        self.assertTrue(agent.safe_path("control-plane/app/main.py"))

    def test_blocks_secrets_infrastructure_and_manifests(self):
        for path in (
            ".env", "api/.env.production", "deploy/ec2/README.md",
            ".github/workflows/deploy.yml", "api/alembic/versions/change.py",
            "web/package.json", "api/pyproject.toml", "web/package-lock.json",
            "api/../../etc/passwd", "/tmp/evil.py", "ops/ordium-agent/agent.py",
        ):
            with self.subTest(path=path):
                self.assertFalse(agent.safe_path(path))

    def test_redacts_database_urls_and_bearer_tokens(self):
        message = (
            "DATABASE_URL=postgresql://merchant:supersecret@db.example:5432/prod "
            "Authorization: Bearer ghp_exampletoken password=hunter2"
        )
        redacted = agent.redact_log_message(message)
        self.assertNotIn("supersecret", redacted)
        self.assertNotIn("ghp_exampletoken", redacted)
        self.assertNotIn("hunter2", redacted)
        self.assertIn("[REDACTED]", redacted)

    def test_redacts_email_and_algerian_mobile_numbers(self):
        redacted = agent.redact_log_message(
            "customer akram@example.com called 0551234567 and +213551234567"
        )
        self.assertNotIn("akram@example.com", redacted)
        self.assertNotIn("0551234567", redacted)
        self.assertNotIn("+213551234567", redacted)
        self.assertIn("[REDACTED_EMAIL]", redacted)
        self.assertIn("[REDACTED_PHONE]", redacted)

    def test_changed_paths_includes_new_files(self):
        with patch.object(
            agent,
            "run",
            side_effect=[
                SimpleNamespace(stdout="api/app/changed.py\n"),
                SimpleNamespace(stdout="api/tests/test_new.py\n"),
            ],
        ):
            self.assertEqual(
                agent.changed_paths(),
                ["api/app/changed.py", "api/tests/test_new.py"],
            )

    def test_extra_tasks_are_loaded_only_when_enabled_and_unexpired(self):
        import json
        import tempfile
        from datetime import datetime, timedelta, timezone

        original_file = agent.TASKS_FILE
        with tempfile.TemporaryDirectory() as directory:
            task_file = Path(directory) / "tasks.json"
            expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            task_file.write_text(json.dumps({
                "enabled": True,
                "expires_at": expires,
                "tasks": [{"id": "review-health", "task": "Review health-check failures"}],
            }), encoding="utf-8")
            agent.TASKS_FILE = task_file
            try:
                prompt, digest = agent.load_active_tasks()
                self.assertIn("review-health", prompt)
                self.assertTrue(digest)
                task_file.write_text(json.dumps({
                    "enabled": True,
                    "expires_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
                    "tasks": [{"id": "expired", "task": "Should not be sent"}],
                }), encoding="utf-8")
                self.assertEqual(agent.load_active_tasks(), ("", ""))
            finally:
                agent.TASKS_FILE = original_file

    def test_extra_tasks_require_timezone_and_enabled_flag(self):
        import json
        import tempfile

        original_file = agent.TASKS_FILE
        with tempfile.TemporaryDirectory() as directory:
            task_file = Path(directory) / "tasks.json"
            agent.TASKS_FILE = task_file
            try:
                task_file.write_text(json.dumps({
                    "enabled": True, "expires_at": "2099-01-01T00:00:00",
                    "tasks": [{"id": "task1", "task": "Do something"}],
                }), encoding="utf-8")
                self.assertEqual(agent.load_active_tasks(), ("", ""))
                task_file.write_text(json.dumps({
                    "enabled": False, "expires_at": "2099-01-01T00:00:00Z",
                    "tasks": [{"id": "task1", "task": "Do something"}],
                }), encoding="utf-8")
                self.assertEqual(agent.load_active_tasks(), ("", ""))
            finally:
                agent.TASKS_FILE = original_file

    def test_daily_model_budget_persists_and_resets_by_day(self):
        import tempfile

        original_workspace = agent.WORKSPACE
        with tempfile.TemporaryDirectory() as directory:
            agent.WORKSPACE = Path(directory) / "workspace"
            agent.WORKSPACE.parent.mkdir(parents=True, exist_ok=True)
            try:
                self.assertEqual(agent.load_model_budget("2026-10-29"), 0)
                agent.save_model_budget("2026-10-29", 4)
                self.assertEqual(agent.load_model_budget("2026-10-29"), 4)
                self.assertEqual(agent.load_model_budget("2026-10-30"), 0)
            finally:
                agent.WORKSPACE = original_workspace

    def test_validates_normal_unified_diff(self):
        patch = (
            "diff --git a/api/app/example.py b/api/app/example.py\n"
            "index 1111111..2222222 100644\n"
            "--- a/api/app/example.py\n"
            "+++ b/api/app/example.py\n"
            "@@ -1 +1 @@\n"
            "-old_value = 1\n"
            "+new_value = 2\n"
        )
        agent.validate_patch(patch)

    def test_rejects_patch_to_protected_file(self):
        patch = (
            "diff --git a/api/.env b/api/.env\n"
            "--- a/api/.env\n"
            "+++ b/api/.env\n"
            "@@ -1 +1 @@\n"
            "-x\n"
            "+y\n"
        )
        with self.assertRaises(ValueError):
            agent.validate_patch(patch)

    def test_rejects_empty_and_rename_patches(self):
        with self.assertRaises(ValueError):
            agent.validate_patch("")
        patch = (
            "diff --git a/api/app/a.py b/api/app/b.py\n"
            "rename from api/app/a.py\n"
            "rename to api/app/b.py\n"
            "--- a/api/app/a.py\n"
            "+++ b/api/app/b.py\n"
        )
        with self.assertRaises(ValueError):
            agent.validate_patch(patch)


if __name__ == "__main__":
    unittest.main()
