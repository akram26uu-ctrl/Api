import sys
import unittest
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
