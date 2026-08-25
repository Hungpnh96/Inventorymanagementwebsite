-- EPIC-002 M1 — Postgres schema for inventory + auth + audit.
-- Idempotent: safe to run multiple times via IF NOT EXISTS guards.
-- Loaded by docker-entrypoint-initdb.d on first boot of postgres container.

BEGIN;

-- ============================================================================
-- USERS / AUTH
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        TEXT        NOT NULL,
    username_lower  TEXT        NOT NULL,
    full_name       TEXT        NOT NULL DEFAULT '',
    password_hash   TEXT        NOT NULL,
    role            TEXT        NOT NULL CHECK (role IN ('admin', 'user')),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT   NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username_lower_active
    ON users (username_lower) WHERE deleted_at IS NULL;

-- ============================================================================
-- PERMISSIONS (per user × per menu × per action)
-- 5 menus × 4 actions = 20 permission rows max per user
-- menus: dashboard, inventory, transactions, reports, users
-- actions: view, create, update, delete
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu        TEXT        NOT NULL CHECK (menu IN ('dashboard','inventory','transactions','reports','users')),
    action      TEXT        NOT NULL CHECK (action IN ('view','create','update','delete')),
    allowed     BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, menu, action)
);

CREATE INDEX IF NOT EXISTS ix_user_permissions_user ON user_permissions(user_id);

-- ============================================================================
-- PRODUCTS  (replaces Excel `products` sheet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
    id              BIGSERIAL PRIMARY KEY,
    stt             INT,
    loai_hang       TEXT        NOT NULL DEFAULT '',
    ma_sku          TEXT        NOT NULL,
    ten_san_pham    TEXT        NOT NULL,
    don_vi_tinh     TEXT        NOT NULL DEFAULT '',
    ton_kho         NUMERIC(18,3) NOT NULL DEFAULT 0,
    gia_von         NUMERIC(18,2) NOT NULL DEFAULT 0,
    gia_tri_kho     NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_products_ma_sku ON products(ma_sku);
CREATE INDEX IF NOT EXISTS ix_products_loai_hang ON products(loai_hang);

-- ============================================================================
-- TRANSACTIONS  (replaces Excel `transactions` sheet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
    id           TEXT         PRIMARY KEY,
    product_id   TEXT         NOT NULL,
    ma_sku       TEXT         NOT NULL,
    ten_san_pham TEXT         NOT NULL,
    type         TEXT         NOT NULL CHECK (type IN ('import','export')),
    quantity     NUMERIC(18,3) NOT NULL,
    date         TIMESTAMPTZ  NOT NULL,
    note         TEXT,
    username     TEXT         NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_transactions_ma_sku ON transactions(ma_sku);
CREATE INDEX IF NOT EXISTS ix_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS ix_transactions_username ON transactions(username);

-- ============================================================================
-- AUDIT LOG (append-only — no UPDATE/DELETE grant at application level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor_user_id   BIGINT,
    actor_username  TEXT        NOT NULL,
    actor_role      TEXT        NOT NULL,
    action          TEXT        NOT NULL,
    resource_type   TEXT        NOT NULL,
    resource_id     TEXT,
    before_json     JSONB,
    after_json      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_at ON audit_logs(at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor ON audit_logs(actor_user_id, at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action, at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_resource ON audit_logs(resource_type, resource_id, at DESC);

-- ============================================================================
-- MIGRATION TRACKING (for Excel import idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS migration_state (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
