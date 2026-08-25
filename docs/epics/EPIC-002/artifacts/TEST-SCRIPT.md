# EPIC-002 — Test Script (Platform Upgrade)

**Epic:** EPIC-002 — Nâng cấp hệ thống quản lý nhân sự, công nghệ
**Branch under test:** `feature/EPIC-002-platform-upgrade`
**Implementation status:** **Foundation layer only** in current build. See IMPLEMENT-SUMMARY for the deferred surface.
**For:** Mixed audience — DevOps for M1/M2/M3, manual QA for M4/M5/M6 UAT.
**Last updated:** 2026-06-13

> **Important:** Scenarios are marked **READY** (testable on current build), **BLOCKED-IMPL** (cannot be run until corresponding C# / FE code is shipped — see deferred list in IMPLEMENT-SUMMARY), or **PARTIAL** (some steps runnable, full check needs impl). Do not skip BLOCKED scenarios; defer them to the corresponding sprint.

---

## 1. Prerequisites

### 1.1 Tools required on tester / DevOps machine
| Item | Min version | Used for |
|---|---|---|
| Docker Engine | 24+ | Compose, Postgres, Redis containers |
| `psql` (Postgres CLI) | 14+ | DB inspections (M1, M3, M5) |
| `redis-cli` | 6+ | Redis session inspections (M4) |
| `openssl` | 3+ | Generate JWT_SECRET |
| `curl` or Postman | any | API smoke tests |
| Chrome ≥ 100 (primary), Edge ≥ 100, Safari ≥ 15 | — | FE checks |
| Node 20+ + npm | — | `npm run dev` for FE local |
| .NET 8 SDK | 8.0+ | (Only when application-layer code lands — Sprint A+) |

### 1.2 Test environment (.env values)
| Key | Example value for staging |
|---|---|
| `POSTGRES_USER` | `inventory` |
| `POSTGRES_PASSWORD` | strong random ≥ 24 chars |
| `POSTGRES_DB` | `inventory` |
| `REDIS_PASSWORD` | strong random ≥ 24 chars |
| `JWT_SECRET` | `openssl rand -base64 48` output |
| `JWT_EXPIRY_HOURS` | `8` |
| `DEFAULT_ADMIN_USERNAME` | `admin` |
| `DEFAULT_ADMIN_PASSWORD` | strong temp pw — change on first login |

### 1.3 Test accounts (created post-Sprint B)
| Username | Role | Permissions | Note |
|---|---|---|---|
| `admin` | admin | all | Default seed; force-change pw on first login |
| `qa-user1` | user | inventory: view+create+update; transactions: view+create | Set up by admin |
| `qa-user2` | user | inventory: view only | Set up by admin |
| `qa-locked` | user | n/a | Used to test lockout (5 wrong pw) |

### 1.4 Test data
| Fixture | Source |
|---|---|
| `test-inventory-EPIC001.xlsx` (≥ 500 products) | Reuse from EPIC001 |
| `test-inventory-large.xlsx` (≥ 10,000 products) | New — DevOps generates |
| `test-inventory-malformed.xlsx` (rows missing maSKU) | New — for AC12 |

### 1.5 One-time environment setup
1. `git checkout feature/EPIC-002-platform-upgrade`
2. `cp .env.example .env` and fill values per §1.2
3. `docker compose config` → no errors (proves YAML + env-var refs valid)
4. `docker compose up -d postgres redis` → wait until both report `(healthy)` in `docker compose ps`
5. Once API code lands: `docker compose up -d` and verify `/api/health` returns `{ok:true, postgres:ok, redis:ok}`

---

## 2. Scenarios

### Module M1 — Postgres backing store

#### SC-M1-01 — Schema auto-creates on first boot *(covers EPIC-002-AC01)* — READY
**What we're testing:** Postgres container, when started with empty data folder, auto-runs `001_schema.sql` from the init dir.

| Step | Action | Expected result |
|---|---|---|
| 1 | Ensure `data/postgres/` is empty (or delete it): `docker compose down -v && rm -rf data/postgres` | Folder absent. |
| 2 | Run `docker compose up -d postgres` | Container starts; `docker compose logs postgres` shows lines like "running /docker-entrypoint-initdb.d/001_schema.sql". |
| 3 | Wait until `docker compose ps postgres` shows `(healthy)` | Within 60s. |
| 4 | Run `docker compose exec postgres psql -U inventory -d inventory -c "\dt"` | List shows tables: `users`, `user_permissions`, `products`, `transactions`, `audit_logs`, `migration_state`. |
| 5 | Run `docker compose exec postgres psql -U inventory -d inventory -c "\d products"` | Shows column `ma_sku TEXT NOT NULL` and a unique index on `ma_sku`. |
| 6 | Run `docker compose exec postgres psql -U inventory -d inventory -c "\d audit_logs"` | Shows columns `before_json jsonb`, `after_json jsonb`, indexes on `at desc`, `actor_user_id`, etc. |

#### SC-M1-02 — Schema is idempotent *(covers EPIC-002-AC01 robustness, EPIC-002-UT-SCHEMA-IDEMPOTENT)* — READY
| Step | Action | Expected result |
|---|---|---|
| 1 | After SC-M1-01, run `docker compose exec postgres psql -U inventory -d inventory -f /docker-entrypoint-initdb.d/001_schema.sql` | Returns success with `NOTICE: relation "..." already exists, skipping` for each table. No error. |
| 2 | Re-run `\dt` | Same table list; row counts unchanged. |

#### SC-M1-03 — Unique SKU constraint enforced *(covers EPIC-002-AC05)* — READY (DB) / PARTIAL (API)
| Step | Action | Expected result |
|---|---|---|
| 1 | `psql ... -c "INSERT INTO products(ma_sku, ten_san_pham) VALUES ('SKU-X', 'A');"` | 1 row inserted. |
| 2 | Re-run same INSERT | Postgres error: `duplicate key value violates unique constraint "ix_products_ma_sku"`. |
| 3 | (BLOCKED-IMPL — Sprint A) Try POST `/api/products` with duplicate SKU | API returns 409 with body `{"error":"SKU đã tồn tại"}`. |

#### SC-M1-04 — `GET /api/inventory` returns data from Postgres *(covers EPIC-002-AC02)* — BLOCKED-IMPL (Sprint A)
| Step | Action | Expected result |
|---|---|---|
| 1 | Seed Postgres with 3 products via SQL | OK. |
| 2 | `curl http://localhost:3001/api/inventory -H "Authorization: Bearer <token>"` | 200, body shape `{products:[...], transactions:[...]}` with camelCase Vietnamese keys (`maSKU`, `tenSanPham`, `tonKho`, ...). |
| 3 | Verify field types | `tonKho`, `giaVon`, `giaTriKho` are numbers; `date` in transactions is ISO 8601 string. |

#### SC-M1-05 — Concurrent writes do not lose data *(covers EPIC-002-AC03)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Using `hey` or `k6`: 50 concurrent POST /api/products with unique SKUs | All 50 return 2xx; SELECT COUNT shows 50 rows; no 5xx, no deadlock log lines. |

#### SC-M1-06 — Latency p95 ≤ 300ms with 10k rows *(covers EPIC-002-AC04)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Seed 10,000 products | OK. |
| 2 | Run `k6 run` with 100 GET /api/inventory requests | p95 latency ≤ 300ms. |

---

### Module M2 — Docker bootstrap

#### SC-M2-01 — `docker compose up` brings 4 services healthy in ≤ 60s *(covers EPIC-002-AC06)* — PARTIAL (3 of 4 services until API ships)
| Step | Action | Expected result |
|---|---|---|
| 1 | From clean state, run `docker compose up -d` | Output starts all services. |
| 2 | Watch `docker compose ps` for 60s | postgres `(healthy)`, redis `(healthy)`, api `(healthy)` once Sprint A lands, web `Up`. |
| 3 | Total wall-clock from step 1 to all healthy | ≤ 60 seconds. |

#### SC-M2-02 — Required env vars rejected when absent *(covers EPIC-002-AC06 fail-secure)* — READY
| Step | Action | Expected result |
|---|---|---|
| 1 | Remove `POSTGRES_PASSWORD` line from `.env` | Saved. |
| 2 | Run `docker compose up` | Compose fails with clear error: `POSTGRES_PASSWORD must be set in .env`. |
| 3 | Restore line and rerun | Boots normally. |
| 4 | Repeat steps 1-3 for `REDIS_PASSWORD` then `JWT_SECRET` | Each missing var produces same fail-fast error. |

#### SC-M2-03 — Runtime data is git-ignored *(covers EPIC-002-AC07)* — READY
| Step | Action | Expected result |
|---|---|---|
| 1 | After SC-M1-01, run `git status` | Output does NOT include `data/postgres/`, `data/redis/`, `.env`, `server/bin/`, `server/obj/`. |
| 2 | Place a dummy file `data/inventory.xlsx`, `git status` | File does NOT appear. |
| 3 | Create `.env`, `git status` | File does NOT appear. |
| 4 | Create `.env.example` change, `git status` | File DOES appear (only template is tracked). |

#### SC-M2-04 — `.env.example` is complete *(covers EPIC-002-AC08)* — READY
| Step | Action | Expected result |
|---|---|---|
| 1 | `grep -E "^[A-Z_]+=" .env.example | cut -d= -f1 | sort` | List contains at minimum: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRY_HOURS`, `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD`, `LEGACY_INVENTORY_FILE`, `ASPNETCORE_URLS`. |
| 2 | Inspect placeholder values | No real secrets; e.g. `change-me-strong-password`. |

#### SC-M2-05 — API waits for Postgres ready *(covers EPIC-002-AC09)* — READY (compose level) / BLOCKED-IMPL (API retry log)
| Step | Action | Expected result |
|---|---|---|
| 1 | `docker compose up -d` from clean state | Compose schedules `api` after postgres + redis report healthy (verified by `depends_on: service_healthy`). |
| 2 | (BLOCKED-IMPL — Sprint A) Force postgres to be slow: `docker compose up -d postgres redis api` while postgres takes 30s to be healthy | API container logs "waiting for postgres" but doesn't crash; once Postgres healthy, API connects and serves /api/health. |
| 3 | (BLOCKED-IMPL — Sprint A) Block Postgres entirely (stop pg container after start) | API retries ≤ 30x over 60s then exits with non-zero code. |

---

### Module M3 — Data migration

#### SC-M3-01 — Excel → Postgres migration on first boot *(covers EPIC-002-AC10)* — BLOCKED-IMPL (Sprint A)
| Step | Action | Expected result |
|---|---|---|
| 1 | Place `test-inventory-EPIC001.xlsx` (500 products, 0 transactions) at `data/inventory.xlsx` | OK. |
| 2 | Clean Postgres data (`docker compose down -v && rm -rf data/postgres`) then `docker compose up -d` | API logs "Migrated 500 products, 0 transactions from Excel" within 60s. |
| 3 | `psql ... -c "SELECT COUNT(*) FROM products;"` | 500. |
| 4 | `ls data/` | File renamed to `inventory.xlsx.migrated-<timestamp>`. |

#### SC-M3-02 — Migration is idempotent *(covers EPIC-002-AC11)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | After SC-M3-01, restart API: `docker compose restart api` | API logs "Skipped: already migrated." |
| 2 | Product count unchanged | 500. |

#### SC-M3-03 — Malformed Excel row skipped, not crashed *(covers EPIC-002-AC12)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Use `test-inventory-malformed.xlsx` (one row missing maSKU) as `data/inventory.xlsx` | OK. |
| 2 | Clean Postgres + restart | Logs "Migrated N, skipped 1: row 47 missing maSKU"; API healthy. |
| 3 | DB row count | N (skipped row not present). |

#### SC-M3-04 — Manual migration via CLI *(covers EPIC-002-AC13)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Postgres already has data | OK. |
| 2 | Run `docker compose exec api dotnet Server.dll migrate-from-excel /data/other.xlsx` | Prompts confirm; without `--force` aborts. |
| 3 | Re-run with `--force` flag | Overwrites; logs new counts. |

---

### Module M4 — Auth & RBAC

#### SC-M4-01 — Login with correct credentials *(covers EPIC-002-AC14)* — BLOCKED-IMPL (Sprint B)
| Step | Action | Expected result |
|---|---|---|
| 1 | Open `https://app/login` | Login page renders with username + password fields + submit button. |
| 2 | Enter `admin` / `<DEFAULT_ADMIN_PASSWORD>` → click "Đăng nhập" | Response 200; redirect to `/dashboard`; user avatar shows "admin". |
| 3 | DevTools → Application → Cookies (or LocalStorage) | Token stored. |
| 4 | `redis-cli -a <pw> KEYS "session:*"` on host | At least 1 key with TTL ~ 8h. |

#### SC-M4-02 — Login with wrong password (no user enumeration) *(covers EPIC-002-AC15)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login with `admin` / `wrong-pass` | Returns 401 with message "Sai tài khoản hoặc mật khẩu". |
| 2 | Login with `nonexistent-user` / `whatever` | **Same** 401 + **same** message — no leak that user doesn't exist. |
| 3 | Check Postgres `audit_logs` | New row with `action='login.failed'` for each attempt. |

#### SC-M4-03 — Account lockout after 5 failed attempts *(covers EPIC-002-AC16)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login `qa-locked` with wrong pw 5 times within 5 min | First 5 attempts return 401. |
| 2 | 6th attempt | Returns 423 "Tài khoản bị tạm khoá. Thử lại sau 15 phút." |
| 3 | Try correct password immediately | Still 423. |
| 4 | Wait 15 min, retry correct password | Success 200. |
| 5 | Check `audit_logs` | `login.locked` row recorded. |

#### SC-M4-04 — Logout invalidates token immediately *(covers EPIC-002-AC17, EPIC-002-AC42)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login as `qa-user1`. Copy token from devtools. | Token in hand. |
| 2 | `curl /api/auth/logout -H "Authorization: Bearer <token>"` | 204. |
| 3 | Immediately `curl /api/inventory -H "Authorization: Bearer <token>"` | 401 within 2 seconds. |
| 4 | `redis-cli KEYS "session:*"` | The logged-out session key absent. |

#### SC-M4-05 — Token without Redis session = 401 *(covers EPIC-002-AC18)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login, grab token, then manually `redis-cli DEL session:<jti>` | OK. |
| 2 | `curl /api/inventory -H "Authorization: Bearer <token>"` | 401 "Phiên đã kết thúc". |

#### SC-M4-06 — Redis down → 503, NOT bypass *(covers EPIC-002-AC19)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login and get token | OK. |
| 2 | `docker compose stop redis` | Redis down. |
| 3 | `curl /api/inventory -H "Authorization: Bearer <token>"` | Returns 503 "Auth service unavailable". **Never** 200. |
| 4 | `docker compose start redis` | Service restored. |

#### SC-M4-07 — `X-Role: admin` header has zero effect *(covers EPIC-002-AC20)* — BLOCKED-IMPL — **SECURITY-CRITICAL**
| Step | Action | Expected result |
|---|---|---|
| 1 | Without any Bearer token, `curl /api/admin/users -H "X-Role: admin" -H "X-Username: admin"` | Returns 401. NOT 200. |
| 2 | Login as `qa-user2` (user role, no admin perm). With user's token, `curl /api/admin/users -H "Authorization: Bearer <user-token>" -H "X-Role: admin"` | Returns 403 "Không có quyền". The X-Role header MUST be ignored. |

#### SC-M4-08 — Permission denial on protected action *(covers EPIC-002-AC21)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin sets `qa-user2`: `inventory.view=true, inventory.update=false` | Saved. |
| 2 | Login as `qa-user2`. Open `/inventory` | Bảng hiện. Nút Edit/Delete KHÔNG hiển thị. |
| 3 | Manually `curl PUT /api/products ...` with user token | 403 "Không có quyền chỉnh sửa kho." |

#### SC-M4-09 — Admin creates new user *(covers EPIC-002-AC22)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin → `/admin/users` → click "Thêm user" | Modal opens. |
| 2 | Fill `username=test1`, `fullName=Test User`, `role=user`, `password=Temp@1234` → Save | Toast "Đã tạo user". User appears in table. |
| 3 | Check audit_logs | Row with `action='user.create'`, `after_json` includes user details (password NOT in log). |

#### SC-M4-10 — Duplicate username rejected *(covers EPIC-002-AC23)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Try create user with username `admin` (already exists) | 400 "Username đã tồn tại". |
| 2 | Try `Admin` (different case) | 400 (case-insensitive). |

#### SC-M4-11 — Admin deletes another user (soft delete) *(covers EPIC-002-AC24)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin → row of `test1` → click "Xoá" → confirm | Toast "Đã xoá". Row disappears from active list. |
| 2 | `psql ... SELECT deleted_at FROM users WHERE username='test1';` | `deleted_at` is NOT NULL. |
| 3 | Login attempt as `test1` | 401. |
| 4 | Audit logs untouched (test1's history still queryable by username snapshot) | Verified via `/admin/audit?actor=test1`. |

#### SC-M4-12 — Admin cannot self-delete *(covers EPIC-002-AC25)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin logged in. Click "Xoá" on own row. | 400 "Không thể tự xoá tài khoản của mình." Toast error. |

#### SC-M4-13 — Cannot delete the last admin *(covers EPIC-002-AC26)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Have only 1 admin in system. Login as that admin. | OK. |
| 2 | Promote another user to admin to test, then demote back so only 1 admin remains. | OK. |
| 3 | Tester acting as that admin tries to delete the (only) other admin — wait, that's themselves. Re-setup: create admin2, login as admin2, delete the original admin. | After deleting original admin, try to delete admin2 (self) → 400 self-delete. Try to demote admin2 via PUT permissions to user role → 400 "Phải còn ít nhất 1 admin." |

#### SC-M4-14 — Set permissions matrix *(covers EPIC-002-AC27)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin → `qa-user1` → click "Phân quyền" | Modal shows 5×4 checkbox matrix. |
| 2 | Toggle `inventory.update` from on to off → Save | Toast success. |
| 3 | `psql ... SELECT * FROM user_permissions WHERE user_id=...` | Row reflects change. |
| 4 | `audit_logs` last row | Has both `before_json` and `after_json` showing the diff. |
| 5 | `qa-user1` (logged in another browser) hits an update endpoint | Within 30s, gets 403. |

#### SC-M4-15 — Admin reset password *(covers EPIC-002-AC28)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin → `qa-user1` row → "Reset password" → confirm | Modal shows generated temp password (12 chars: letters + digits + special), copy button. Closing modal removes from view. |
| 2 | `psql ... SELECT must_change_password FROM users WHERE username='qa-user1';` | true. |
| 3 | Audit log | `action='password.reset'`, NO password in any json field. |

#### SC-M4-16 — Force change password on first login *(covers EPIC-002-AC29)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | `qa-user1` logs in with temp password | Redirected to `/change-password` regardless of original target page. |
| 2 | Try navigating to `/dashboard` manually | Force-redirected back to `/change-password`. |
| 3 | Submit new password (meets policy ≥ 12 chars) | Redirect to `/dashboard`; `must_change_password=false`. |

#### SC-M4-17 — Admin force-logout user from all devices *(covers EPIC-002-AC30)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | `qa-user1` logged in on Browser A and Browser B (2 sessions). `redis-cli KEYS "session:*"` shows ≥ 2 entries for them. | OK. |
| 2 | Admin → `qa-user1` row → "Logout user khỏi mọi thiết bị" | Confirm. |
| 3 | Browser A makes any API call | 401 within 2s. |
| 4 | Browser B same | 401. |
| 5 | Redis | All `session:*` keys for `qa-user1` gone. |

---

### Module M5 — Audit log

#### SC-M5-01 — Every write action audited *(covers EPIC-002-AC31)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin creates user, updates product, deletes transaction. | 3 actions performed. |
| 2 | `SELECT action, before_json IS NOT NULL AS has_before, after_json IS NOT NULL AS has_after FROM audit_logs ORDER BY at DESC LIMIT 3;` | 3 rows: `user.create` (no before, yes after), `product.update` (both), `transaction.delete` (yes before, no after). |
| 3 | Each row has `ip_address`, `user_agent`, `actor_user_id`, `at` populated | Verified. |

#### SC-M5-02 — Login lifecycle events audited *(covers EPIC-002-AC32)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login OK, then logout, then 1 failed login, then 5 fails → lock. | Sequence done. |
| 2 | Query audit_logs | Rows: `login.success`, `logout`, `login.failed`, `login.failed`×5, `login.locked`. |

#### SC-M5-03 — Admin views audit list *(covers EPIC-002-AC33)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin opens `/admin/audit` | Filter bar + table render. |
| 2 | Default view | 50 newest rows, sorted by `at` desc. |
| 3 | Click row | Modal shows `before_json` and `after_json` side-by-side (diff highlight). |

#### SC-M5-04 — Filter truncation on huge result *(covers EPIC-002-AC34)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Seed 11,000 audit rows. Query without filter. | Returns 50 + flag `truncated:true` + message "Kết quả lớn, hãy thu hẹp filter." |

#### SC-M5-05 — Non-admin blocked from audit endpoint *(covers EPIC-002-AC35)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login as `qa-user1`. Manually `curl /api/admin/audit` with user token. | 403. |
| 2 | UI: user does not see "Audit" link in nav. | Confirmed. |

#### SC-M5-06 — Audit survives user deletion *(covers EPIC-002-AC36)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | User `test2` does some actions, then admin deletes `test2`. | OK. |
| 2 | Query `/admin/audit?actor_username=test2` | Rows still present with `actor_username='test2'`. |

#### SC-M5-07 — Audit table is append-only at app level *(covers EPIC-002-AC37, EPIC-002-UT-SCHEMA-AUDIT-APPEND)* — PARTIAL (DB grant config needs Sprint D)
| Step | Action | Expected result |
|---|---|---|
| 1 | Connect as application role (not superuser) | OK. |
| 2 | `UPDATE audit_logs SET action='tampered' WHERE id=1;` | Permission denied. |
| 3 | `DELETE FROM audit_logs WHERE id=1;` | Permission denied. |
| 4 | `INSERT INTO audit_logs (...) VALUES (...);` | Allowed. |

> Note: this requires the schema migration to GRANT only SELECT + INSERT to the app role. Tracked as Sprint D enhancement.

---

### Module M6 — UI polish

#### SC-M6-01 — Sidebar fixed on desktop *(covers EPIC-002-AC38)* — READY
| Step | Action | Expected result |
|---|---|---|
| 1 | Login (or stub login by setting localStorage `currentUser` if auth not yet shipped). Open at viewport ≥ 1280px. | Dashboard renders, sidebar visible on left. |
| 2 | Note vertical position of sidebar nav buttons. | E.g., "Dashboard" button at y ≈ 100px. |
| 3 | Scroll page content down 500px (e.g., on `/inventory` with many products). | Sidebar buttons remain at the **same y** (≈ 100px) — sidebar does not move. |
| 4 | Scroll sidebar nav itself (if it overflows) | Sidebar scrolls internally (overflow-y-auto), independent of main content. |

**Screenshot:** Capture before + after scroll showing sidebar unchanged.

#### SC-M6-02 — Sidebar drawer on mobile *(covers EPIC-002-AC39)* — READY
| Step | Action | Expected result |
|---|---|---|
| 1 | DevTools device toolbar → iPhone 14 (390×844). | Header still visible, but sidebar hidden. |
| 2 | Click hamburger icon (top-left) | Sidebar slides in from left over content, dark overlay behind. |
| 3 | Click overlay (outside sidebar) | Sidebar slides out. |
| 4 | Click hamburger again, click a menu item | Sidebar closes and route changes. |

#### SC-M6-03 — Dashboard KPI cards colored & contrast OK *(covers EPIC-002-AC40)* — READY
| Step | Action | Expected result |
|---|---|---|
| 1 | Login and open `/dashboard`. | 4 KPI cards visible. |
| 2 | Visually check each card has a distinct color | Tổng sản phẩm = indigo, Tổng tồn kho = emerald (green), Giá trị kho = amber, Giao dịch hôm nay = purple. Each has a colored left border and gradient bg. |
| 3 | Use Chrome DevTools → Lighthouse → Accessibility, OR Axe DevTools | No new color-contrast violations introduced. |
| 4 | Use Chrome DevTools → Rendering → Emulate vision: deuteranopia (red-blind) | All 4 cards still distinguishable from each other (border color is the primary differentiator, not the bg alone). |

**Screenshot:** Capture dashboard top section.

#### SC-M6-04 — Chart palette colorblind-safe *(covers EPIC-002-AC41 — SHOULD)* — BLOCKED-IMPL (no chart in current dashboard)
| Step | Action | Expected result |
|---|---|---|
| 1 | After charts ship (Reports page upgrade), open Reports. | ≥ 4 distinct colors used in legend. |
| 2 | Run through Coblis or Chrome vision emulation | All series remain distinguishable. |

---

### Cross-cutting / regression

#### SC-X-01 — Excel export still works *(covers EPIC-002-AC43)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Login as admin. Go `/inventory`. Click "Export Excel". | `.xlsx` downloads with data sourced from Postgres (not from `data/inventory.xlsx`). |
| 2 | Open the file | Same column headers, all DB rows present. |

#### SC-X-02 — Excel import replaces products in DB *(covers EPIC-002-AC44)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Admin click "Import Excel" → upload new file with 200 products. | Toast "Đã import 200 sản phẩm…" |
| 2 | `SELECT COUNT(*) FROM products;` | 200 (replaced, not appended). |
| 3 | `audit_logs` shows `inventory.import` with `after_json: {rowCount:200}`. | OK. |

#### SC-X-03 — All tabs of same user logged out by logout *(covers EPIC-002-AC42)* — BLOCKED-IMPL
| Step | Action | Expected result |
|---|---|---|
| 1 | Same user logged in Browser A tab 1 and tab 2. Both can call protected API. | OK. |
| 2 | In tab 1, click "Đăng xuất". | Tab 1 redirects to login. |
| 3 | In tab 2, click any nav link (or wait for next polled request) | Within 2 seconds, tab 2 gets 401 and redirects to login. |

---

## 3. Edge-case scenarios (cross-module)

#### SC-EDGE-01 — Postgres goes down mid-session — BLOCKED-IMPL
| Step | Expected |
|---|---|
| Stop postgres while a user is using `/inventory` | API returns 503 for protected endpoints; FE shows "Mất kết nối tới máy chủ"; restart postgres → app recovers without restart. |

#### SC-EDGE-02 — Server clock jumps backward 1 hour (NTP correction) — BLOCKED-IMPL
| Step | Expected |
|---|---|
| Set system clock back 1h while sessions exist | Existing JWTs still valid (issuedAt < now); no spurious "token from future" rejections. |

#### SC-EDGE-03 — Unicode usernames — BLOCKED-IMPL
| Step | Expected |
|---|---|
| Admin creates user `nguyễn.văn.a` | Saved as-is. Login with that exact username works (case-insensitive only for ASCII). |

#### SC-EDGE-04 — SQL injection in audit filter — BLOCKED-IMPL
| Step | Expected |
|---|---|
| `GET /api/admin/audit?actor=' OR 1=1--` | Treated as literal string. No SQL error. No table dump. |

#### SC-EDGE-05 — Very large `before_json`/`after_json` — BLOCKED-IMPL
| Step | Expected |
|---|---|
| Update a product with ~1 MB description (boundary) | Audit row stored (jsonb handles up to 1 GB); audit list page paginates fine. |

#### SC-EDGE-06 — Migration runs while Postgres data dir not empty — READY
| Step | Expected |
|---|---|
| Restart postgres with existing data dir | Init scripts in `docker-entrypoint-initdb.d` skipped (postgres documented behavior). Schema not re-applied. |

---

## 4. Regression Quick Check (run after any deploy)

| # | Action | Expected |
|---|---|---|
| R1 | `docker compose up -d`, all 4 services healthy in ≤ 60s | OK (AC06) |
| R2 | Login as admin works | OK (AC14) |
| R3 | `/dashboard` shows colored cards | OK (AC40) |
| R4 | Sidebar stays put when scrolling on lg+ | OK (AC38) |
| R5 | Inventory list loads | OK (AC02) |
| R6 | Add a product → succeeds, audit row inserted | OK (AC31) |
| R7 | Edit a product → audit shows before/after | OK (AC31) |
| R8 | Logout → next API call 401 | OK (AC17) |
| R9 | EPIC001 search still works on `/inventory` | OK (no regression) |
| R10 | `git status` clean of data dirs | OK (AC07) |

---

## 5. Verdict & Sign-off

### Pass / Fail criteria
- **PASS**: All READY scenarios PASS. All BLOCKED-IMPL scenarios are deferred to their target sprint and not blocking this milestone. Regression R1–R10 all green.
- **PASS-WITH-DEFECTS**: ≥ 90% of READY scenarios pass; defects logged with Medium severity or below.
- **FAIL**: Any of these:
  - Any READY scenario fails.
  - SC-M4-07 (X-Role bypass) ever returns 200 — **security blocker**.
  - SC-M4-06 (Redis-down bypass) ever returns 200 — **security blocker**.
  - SC-M5-07 (audit tampering allowed) — **compliance blocker**.

### Sign-off

| Field | Value |
|---|---|
| Tester name | __________________________ |
| Date tested | __________________________ |
| Build / commit SHA | __________________________ |
| Sprint scope tested | Foundation / Sprint A / Sprint B / Sprint C / Sprint D |
| Environment | local / staging / prod |
| Verdict | PASS / PASS-WITH-DEFECTS / FAIL |
| Tester signature | __________________________ |
| Reviewer (security) | __________________________ (required for M4 + M5 scenarios) |

### Defect log

| # | Scenario | Severity | Description | Screenshot | Ticket |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |

---

## 6. Traceability Matrix

| AC | Scenario(s) | Status in current build |
|---|---|---|
| EPIC-002-AC01 | SC-M1-01, SC-M1-02 | READY |
| EPIC-002-AC02 | SC-M1-04 | BLOCKED-IMPL (Sprint A) |
| EPIC-002-AC03 | SC-M1-05 | BLOCKED-IMPL |
| EPIC-002-AC04 | SC-M1-06 | BLOCKED-IMPL |
| EPIC-002-AC05 | SC-M1-03 | PARTIAL (DB-level READY, API-level BLOCKED) |
| EPIC-002-AC06 | SC-M2-01, SC-M2-02 | PARTIAL (3 of 4 services READY) |
| EPIC-002-AC07 | SC-M2-03 | READY |
| EPIC-002-AC08 | SC-M2-04 | READY |
| EPIC-002-AC09 | SC-M2-05 | PARTIAL (compose-level READY, retry-loop BLOCKED) |
| EPIC-002-AC10 | SC-M3-01 | BLOCKED-IMPL |
| EPIC-002-AC11 | SC-M3-02 | BLOCKED-IMPL |
| EPIC-002-AC12 | SC-M3-03 | BLOCKED-IMPL |
| EPIC-002-AC13 | SC-M3-04 | BLOCKED-IMPL |
| EPIC-002-AC14 | SC-M4-01 | BLOCKED-IMPL (Sprint B) |
| EPIC-002-AC15 | SC-M4-02 | BLOCKED-IMPL |
| EPIC-002-AC16 | SC-M4-03 | BLOCKED-IMPL |
| EPIC-002-AC17 | SC-M4-04 | BLOCKED-IMPL |
| EPIC-002-AC18 | SC-M4-05 | BLOCKED-IMPL |
| EPIC-002-AC19 | SC-M4-06 | BLOCKED-IMPL |
| EPIC-002-AC20 | SC-M4-07 | BLOCKED-IMPL — **SECURITY-CRITICAL** |
| EPIC-002-AC21 | SC-M4-08 | BLOCKED-IMPL |
| EPIC-002-AC22 | SC-M4-09 | BLOCKED-IMPL (Sprint C) |
| EPIC-002-AC23 | SC-M4-10 | BLOCKED-IMPL |
| EPIC-002-AC24 | SC-M4-11 | BLOCKED-IMPL |
| EPIC-002-AC25 | SC-M4-12 | BLOCKED-IMPL |
| EPIC-002-AC26 | SC-M4-13 | BLOCKED-IMPL |
| EPIC-002-AC27 | SC-M4-14 | BLOCKED-IMPL |
| EPIC-002-AC28 | SC-M4-15 | BLOCKED-IMPL |
| EPIC-002-AC29 | SC-M4-16 | BLOCKED-IMPL |
| EPIC-002-AC30 | SC-M4-17 | BLOCKED-IMPL |
| EPIC-002-AC31 | SC-M5-01 | BLOCKED-IMPL (Sprint D) |
| EPIC-002-AC32 | SC-M5-02 | BLOCKED-IMPL |
| EPIC-002-AC33 | SC-M5-03 | BLOCKED-IMPL |
| EPIC-002-AC34 | SC-M5-04 | BLOCKED-IMPL |
| EPIC-002-AC35 | SC-M5-05 | BLOCKED-IMPL |
| EPIC-002-AC36 | SC-M5-06 | BLOCKED-IMPL |
| EPIC-002-AC37 | SC-M5-07 | PARTIAL (DB grant config to add) |
| EPIC-002-AC38 | SC-M6-01 | READY |
| EPIC-002-AC39 | SC-M6-02 | READY |
| EPIC-002-AC40 | SC-M6-03 | READY |
| EPIC-002-AC41 | SC-M6-04 | BLOCKED-IMPL (no chart in dashboard yet) |
| EPIC-002-AC42 | SC-X-03, SC-M4-04 | BLOCKED-IMPL |
| EPIC-002-AC43 | SC-X-01 | BLOCKED-IMPL |
| EPIC-002-AC44 | SC-X-02 | BLOCKED-IMPL |
| EPIC-002-AC45..47 | (Won't) | OUT OF SCOPE |

**Summary:**
- 7 scenarios READY today (Foundation milestone): AC01, AC07, AC08, AC38, AC39, AC40, and partials of AC05/AC06/AC09.
- 35 scenarios BLOCKED-IMPL across Sprints A–D.
- 3 must-pass security/compliance gates: AC20 (header spoof), AC19 (Redis fail-secure), AC37 (audit append-only). All currently BLOCKED-IMPL.
