-- Self-registration + admin approval (EPIC-007). Existing rows default to 'active'
-- so nothing currently logged-in is affected.
BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'rejected'));

COMMIT;
