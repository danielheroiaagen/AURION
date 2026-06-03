import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]


class DatabaseMigrationStrategyDocumentationTests(unittest.TestCase):
    def test_database_strategy_decision_is_documented(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-008-postgresql-migrations-query-layer.md"

        self.assertTrue(adr.exists())
        text = adr.read_text(encoding="utf-8")
        self.assertIn("PostgreSQL is the source of truth", text)
        self.assertIn("SQL-first migrations", text)
        self.assertIn("Kysely", text)
        self.assertIn("node-postgres", text)

    def test_migrations_doc_defines_reviewable_sql_contract(self):
        migrations = ROOT / "19_BACKEND" / "migrations.md"

        text = migrations.read_text(encoding="utf-8")
        self.assertIn("ADR-008", text)
        self.assertIn("database/migrations", text)
        self.assertIn("up/down", text)
        self.assertIn("No auto-sync", text)
        self.assertIn("tenant_id", text)

    def test_postgres_repositories_keep_domain_independent(self):
        repositories = ROOT / "19_BACKEND" / "postgres-repositories.md"

        text = repositories.read_text(encoding="utf-8")
        self.assertIn("ADR-008", text)
        self.assertIn("Kysely", text)
        self.assertIn("node-postgres", text)
        self.assertIn("Domain must not import", text)
        self.assertIn("raw SQL escape hatch", text)


if __name__ == "__main__":
    unittest.main()
