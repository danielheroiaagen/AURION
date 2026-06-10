import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
API_SRC = ROOT / "apps" / "api" / "src"
API_TEST = ROOT / "apps" / "api" / "test"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


class MigrationRunnerTests(unittest.TestCase):
    RUNNER = ROOT / "tools" / "db" / "migrate.mjs"

    def test_runner_exists_with_checksum_ledger(self):
        self.assertTrue(self.RUNNER.exists())
        source = read(self.RUNNER)
        self.assertIn("schema_migrations", source)
        self.assertIn("checksum", source)
        self.assertIn("sha256", source)
        self.assertIn("pg_advisory_lock", source)

    def test_runner_refuses_checksum_drift(self):
        self.assertIn("Checksum mismatch", read(self.RUNNER))

    def test_npm_scripts_expose_migrate_and_status(self):
        package = json.loads(read(ROOT / "package.json"))
        scripts = package["scripts"]
        self.assertIn("db:migrate", scripts)
        self.assertIn("db:status", scripts)
        self.assertIn("test:api:integration", scripts)


class PersistenceInfrastructureTests(unittest.TestCase):
    def test_database_infrastructure_files_exist(self):
        for relative in [
            "config/database.config.ts",
            "database/database.module.ts",
            "database/database.schema.ts",
            "database/database.tokens.ts",
            "database/tenant-scope.ts",
        ]:
            self.assertTrue((API_SRC / relative).exists(), relative)

    def test_database_config_fails_closed(self):
        source = read(API_SRC / "config" / "database.config.ts")
        self.assertIn("DATABASE_URL is required", source)

    def test_tenant_scope_sets_transaction_local_guc(self):
        source = read(API_SRC / "database" / "tenant-scope.ts")
        self.assertIn("set_config", source)
        self.assertIn("app.tenant_id", source)
        self.assertIn("transaction", source)

    def test_app_module_wires_database_and_resources(self):
        source = read(API_SRC / "modules" / "app.module.ts")
        for marker in ["DatabaseModule", "CryptoModule", "TenantsModule", "KnowledgeModule", "AuditModule"]:
            self.assertIn(marker, source)


class FieldEncryptionTests(unittest.TestCase):
    SERVICE = API_SRC / "common" / "crypto" / "field-encryption.service.ts"

    def test_encryption_service_uses_authenticated_aes_256_gcm(self):
        source = read(self.SERVICE)
        self.assertIn("aes-256-gcm", source)
        self.assertIn("DATA_ENCRYPTION_KEYS", source)

    def test_envelope_is_versioned_for_key_rotation(self):
        source = read(self.SERVICE)
        self.assertIn("keyId", source)
        self.assertIn("base64url", source)

    def test_crypto_module_fails_closed_at_startup(self):
        source = read(API_SRC / "common" / "crypto" / "crypto.module.ts")
        self.assertIn("fail closed", source.lower())


class DbAuditSinkTests(unittest.TestCase):
    def test_db_audit_sink_writes_audit_events_with_fallback(self):
        source = read(API_SRC / "modules" / "auth" / "infrastructure" / "db-audit.sink.ts")
        self.assertIn("audit_events", source)
        self.assertIn("fallback", source)

    def test_auth_module_binds_db_audit_sink(self):
        source = read(API_SRC / "modules" / "auth" / "auth.module.ts")
        self.assertIn("DbAuditSink", source)


class ResourceModulesTests(unittest.TestCase):
    def test_tenants_module_files_exist(self):
        base = API_SRC / "modules" / "tenants"
        for relative in [
            "tenants.module.ts",
            "application/tenants.repository.port.ts",
            "application/tenants.service.ts",
            "infrastructure/kysely-tenants.repository.ts",
            "http/tenants.controller.ts",
            "http/tenants.dto.ts",
        ]:
            self.assertTrue((base / relative).exists(), relative)

    def test_knowledge_module_files_exist(self):
        base = API_SRC / "modules" / "knowledge"
        for relative in [
            "knowledge.module.ts",
            "domain/knowledge-document.ts",
            "application/knowledge-documents.repository.port.ts",
            "application/knowledge-documents.service.ts",
            "infrastructure/kysely-knowledge-documents.repository.ts",
            "http/knowledge-documents.controller.ts",
            "http/knowledge-documents.dto.ts",
        ]:
            self.assertTrue((base / relative).exists(), relative)

    def test_audit_module_files_exist(self):
        base = API_SRC / "modules" / "audit"
        for relative in [
            "audit.module.ts",
            "application/audit-events.repository.port.ts",
            "infrastructure/kysely-audit-events.repository.ts",
            "http/audit-events.controller.ts",
            "http/audit-events.dto.ts",
        ]:
            self.assertTrue((base / relative).exists(), relative)

    def test_knowledge_lifecycle_is_explicit(self):
        source = read(API_SRC / "modules" / "knowledge" / "domain" / "knowledge-document.ts")
        for status in ["draft", "review", "published", "archived"]:
            self.assertIn(status, source)
        self.assertIn("canTransition", source)

    def test_list_endpoints_use_opaque_cursor_pagination(self):
        cursor = read(API_SRC / "common" / "pagination" / "cursor.ts")
        self.assertIn("base64url", cursor)
        self.assertIn("nextCursor", cursor)

    def test_permission_catalog_gains_read_permissions(self):
        permissions = read(API_SRC / "modules" / "auth" / "domain" / "permissions.ts")
        self.assertIn("'tenant:read'", permissions)
        self.assertIn("'knowledge:read'", permissions)
        matrix_doc = read(ROOT / "05_SECURITY" / "permissions.md")
        self.assertIn("`tenant:read`", matrix_doc)
        self.assertIn("`knowledge:read`", matrix_doc)


class IntegrationTestHarnessTests(unittest.TestCase):
    def test_integration_suite_exists_and_proves_security_contract(self):
        spec = API_TEST / "integration" / "persistence.spec.ts"
        self.assertTrue(spec.exists())
        source = read(spec)
        self.assertIn("NOBYPASSRLS", source)
        self.assertIn("append-only", source)
        self.assertIn("row-level security", source.lower())

    def test_ci_runs_integration_against_postgres_service(self):
        workflow = read(ROOT / ".github" / "workflows" / "ci.yml")
        self.assertIn("postgres", workflow)
        self.assertIn("test:api:integration", workflow)
        self.assertIn("db:migrate", workflow)


class DocumentationTests(unittest.TestCase):
    def test_adr_012_records_runtime_persistence_decisions(self):
        adr = ROOT / "03_ARCHITECTURE" / "adr" / "ADR-012-runtime-persistence-implementation.md"
        self.assertTrue(adr.exists())
        text = read(adr)
        for marker in ["Kysely", "set_config", "AES-256-GCM", "schema_migrations"]:
            self.assertIn(marker, text)

    def test_phase3_plan_exists(self):
        plan = ROOT / "26_PROJECT_MANAGEMENT" / "phase-3-persistence-resources-plan.md"
        self.assertTrue(plan.exists())
        text = read(plan)
        self.assertIn("ADR-012", text)

    def test_env_example_documents_database_contract(self):
        env = read(ROOT / ".env.example")
        self.assertIn("DATABASE_URL", env)
        self.assertIn("DATA_ENCRYPTION_KEYS", env)

    def test_database_readme_documents_runner(self):
        readme = read(ROOT / "database" / "README.md")
        self.assertIn("db:migrate", readme)
        self.assertIn("schema_migrations", readme)


if __name__ == "__main__":
    unittest.main()
