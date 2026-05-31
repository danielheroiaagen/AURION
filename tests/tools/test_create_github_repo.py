import json
import os
import unittest
from unittest.mock import patch

from tools.github import create_repo


class CreateGitHubRepoTests(unittest.TestCase):
    def test_build_payload_defaults_to_private_repository(self):
        payload = create_repo.build_payload(
            name="AURION",
            description="Voice Agent SaaS Core",
            private=True,
        )

        self.assertEqual(payload["name"], "AURION")
        self.assertEqual(payload["description"], "Voice Agent SaaS Core")
        self.assertTrue(payload["private"])
        self.assertTrue(payload["has_issues"])
        self.assertFalse(payload["auto_init"])

    def test_validate_repo_name_rejects_unsafe_names(self):
        for name in ["", "../AURION", "AURION repo", "A" * 101]:
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    create_repo.validate_repo_name(name)

    def test_build_request_uses_user_endpoint_by_default(self):
        request = create_repo.build_request(
            token="token-123",
            payload={"name": "AURION", "private": True},
        )

        self.assertEqual(request.full_url, "https://api.github.com/user/repos")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["Authorization"], "Bearer token-123")
        self.assertEqual(request.headers["Accept"], "application/vnd.github+json")
        self.assertEqual(json.loads(request.data.decode("utf-8"))["name"], "AURION")

    def test_build_request_uses_org_endpoint_when_org_is_provided(self):
        request = create_repo.build_request(
            token="token-123",
            payload={"name": "AURION", "private": True},
            org="aurion-ai",
        )

        self.assertEqual(request.full_url, "https://api.github.com/orgs/aurion-ai/repos")

    def test_missing_token_fails_before_network_call(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                create_repo.resolve_token()


if __name__ == "__main__":
    unittest.main()

