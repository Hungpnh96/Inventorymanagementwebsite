-- Generic key/value app settings table (EPIC-006 Settings module).
-- Currently used for Telegram Bot notification config; safe to reuse for future settings.
-- Idempotent: safe to run multiple times via IF NOT EXISTS guards.
-- Loaded by docker-entrypoint-initdb.d on first boot of postgres container.
-- NOTE: for an ALREADY-INITIALISED database this file is not auto-applied by the
-- entrypoint; SettingsService.EnsureSchemaAsync() runs the same DDL at startup.

BEGIN;

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT        PRIMARY KEY,
    value       TEXT        NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  BIGINT      REFERENCES users(id)
);

COMMIT;
