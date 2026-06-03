import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "database" / "migrations"
UP = MIGRATIONS / "2026-06-01-0001-create-mvp-core.up.sql"
DOWN = MIGRATIONS / "2026-06-01-0001-create-mvp-core.down.sql"


class ExecutableDatabaseSchemaTests(unittest.TestCase):
    def test_mvp_core_migration_pair_exists(self):
        self.assertTrue(UP.exists())
        self.assertTrue(DOWN.exists())

    def test_up_migration_creates_core_tables(self):
        sql = UP.read_text(encoding="utf-8")

        for table in [
            "tenants",
            "users",
            "tenant_memberships",
            "knowledge_documents",
            "voice_sessions",
            "controlled_actions",
            "audit_events",
        ]:
            self.assertRegex(sql, rf"CREATE TABLE {table}\b")

        self.assertIn("CREATE EXTENSION IF NOT EXISTS pgcrypto", sql)
        self.assertIn("gen_random_uuid()", sql)

    def test_customer_owned_tables_are_tenant_scoped(self):
        sql = UP.read_text(encoding="utf-8")

        for table in [
            "tenant_memberships",
            "knowledge_documents",
            "voice_sessions",
            "controlled_actions",
            "audit_events",
        ]:
            pattern = rf"CREATE TABLE {table}\s*\((?P<body>.*?)\n\);"
            match = re.search(pattern, sql, re.DOTALL)
            self.assertIsNotNone(match, table)
            self.assertIn("tenant_id UUID NOT NULL", match.group("body"))
            self.assertIn("REFERENCES tenants(id)", match.group("body"))

    def test_schema_includes_authorization_audit_and_idempotency_guards(self):
        sql = UP.read_text(encoding="utf-8")

        self.assertIn("CHECK (role IN", sql)
        self.assertIn("CHECK (actor_type IN", sql)
        self.assertIn("idempotency_key", sql)
        self.assertIn("UNIQUE (tenant_id, idempotency_key)", sql)
        self.assertIn("correlation_id", sql)
        self.assertIn("JSONB", sql)

    def test_schema_prevents_cross_tenant_action_session_links(self):
        sql = UP.read_text(encoding="utf-8")

        self.assertIn("UNIQUE (tenant_id, id)", sql)
        self.assertIn("FOREIGN KEY (tenant_id, voice_session_id)", sql)
        self.assertIn("REFERENCES voice_sessions(tenant_id, id)", sql)

    def test_tenant_owned_user_attribution_requires_same_tenant_membership(self):
        sql = UP.read_text(encoding="utf-8")

        for column in [
            "created_by_user_id",
            "started_by_user_id",
            "actor_user_id",
            "approved_by_user_id",
        ]:
            self.assertIn(f"FOREIGN KEY (tenant_id, {column})", sql)
            self.assertIn("REFERENCES tenant_memberships(tenant_id, user_id)", sql)
            self.assertIn(f"ON DELETE SET NULL ({column})", sql)

    def test_down_migration_reverses_core_schema(self):
        sql = DOWN.read_text(encoding="utf-8")

        for table in [
            "audit_events",
            "controlled_actions",
            "voice_sessions",
            "knowledge_documents",
            "tenant_memberships",
            "users",
            "tenants",
        ]:
            self.assertRegex(sql, rf"DROP TABLE IF EXISTS {table}\b")

    def test_database_readme_documents_how_to_run_migrations(self):
        readme = ROOT / "database" / "README.md"

        self.assertTrue(readme.exists())
        text = readme.read_text(encoding="utf-8")
        self.assertIn("ADR-008", text)
        self.assertIn("psql", text)
        self.assertIn("up.sql", text)
        self.assertIn("down.sql", text)


if __name__ == "__main__":
    unittest.main()
