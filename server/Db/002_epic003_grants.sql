-- EPIC-003 M5 — Append-only audit logs at DB grant level (AC37).
-- This migration assumes psql is invoked with -v app_password='<value>'.
-- Idempotent: safe to re-run.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'inventory_app') THEN
    EXECUTE format('CREATE ROLE inventory_app NOINHERIT LOGIN PASSWORD %L', :'app_password');
  END IF;
END$$;

GRANT CONNECT ON DATABASE inventory TO inventory_app;
GRANT USAGE ON SCHEMA public TO inventory_app;

-- Mutable tables: full DML
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, user_permissions, products, transactions, migration_state
  TO inventory_app;

-- Append-only: SELECT + INSERT only (AC37)
GRANT SELECT, INSERT ON audit_logs TO inventory_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM inventory_app, PUBLIC;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO inventory_app;

-- Permission cache covering index
CREATE INDEX IF NOT EXISTS ix_user_permissions_user_menu
  ON user_permissions (user_id, menu);

COMMIT;
