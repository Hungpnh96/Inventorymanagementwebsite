# TEST-SCRIPT — EPIC-003 (UAT)

**Epic:** EPIC-003 — Hoàn thiện EPIC-002
**For:** Manual / UAT testers (mixed: DevOps + non-technical end users)
**Build under test:** branch `feature/EPIC-003-redis-audit`
**Last updated:** 2026-06-13

> **Important**: This script covers what is **implemented now** (S1 Redis+Logout+Lockout, S2 Audit, S3 backend admin CRUD, S5 polish: Db retry + 409 dup SKU + verbose health + CORS + DB grants). Scenarios for **FE admin pages and permission middleware (AC21)** are flagged **DEFERRED** — not testable on this build. Run them after the next implementation round.

---

## 1. Prerequisites

### 1.1 Tools required

| Tool | Min version | Used for |
|---|---|---|
| Docker Engine | 24+ | Compose, Postgres, Redis |
| `curl` or Postman | any | API testing (no FE admin yet) |
| `psql` | 14+ | DB inspection |
| `redis-cli` | 6+ | Session inspection |
| Chrome ≥ 100 | — | FE smoke (existing pages) |
| `openssl` | 3+ | Generate JWT_SECRET |

### 1.2 .env values

Copy `.env.example` to `.env` and fill:
```
POSTGRES_USER=inventory
POSTGRES_PASSWORD=<random 24+ chars>
POSTGRES_DB=inventory
REDIS_PASSWORD=<random 24+ chars>
JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRY_HOURS=8
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=<temp pw, change on first login>
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
LEGACY_INVENTORY_FILE=/data/inventory.xlsx
```

### 1.3 One-time bootstrap

```bash
cp .env.example .env
# edit .env per §1.2
docker compose config            # validates yaml + env refs
docker compose up -d
docker compose ps                # all 4 (postgres redis api web) "healthy" in ≤ 60s
curl -s http://localhost:3001/api/health
```

### 1.4 Test accounts

| Username | Pw | Role | Purpose |
|---|---|---|---|
| `admin` | `<DEFAULT_ADMIN_PASSWORD>` | admin | All admin endpoints. **Must change pw on first login.** |
| `qa-user1` | (created in scenarios) | user | Permission tests |
| `qa-victim` | (created in scenarios) | user | Soft-delete tests |
| `qa-locked` | wrong pw 5× | user | Lockout tests |

---

## 2. Scenarios

### Module M1/M5 — Postgres + Polish

#### SC-01 — Verbose health endpoint *(EPIC-003-AC05)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `curl -s http://localhost:3001/api/health \| jq` | JSON object with keys `api, postgres, redis, time`. All three values = `"ok"`. Status code 200. |
| 2 | `docker compose stop redis` | Container stops. |
| 3 | `curl -s -w "%{http_code}" http://localhost:3001/api/health` | Body `redis: "down"`; status code **503**. |
| 4 | `docker compose start redis`; wait 10s; retry curl | All 3 = "ok"; 200. |

#### SC-02 — Postgres unique SKU returns 409 *(EPIC-002-AC05)* — READY

**Prereq:** Login admin, get token (see SC-05).

| Step | Action | Expected |
|---|---|---|
| 1 | `curl -X POST localhost:3001/api/products -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '[{"stt":1,"maSKU":"SKU-A","tenSanPham":"X","loaiHang":"Y","donViTinh":"kg","tonKho":1,"giaVon":1,"giaTriKho":1},{"stt":2,"maSKU":"SKU-A","tenSanPham":"Z","loaiHang":"Y","donViTinh":"kg","tonKho":1,"giaVon":1,"giaTriKho":1}]'` | Status **409**. Body contains `"code":"duplicate_sku"`. **NOT** 500. |

#### SC-03 — API waits for Postgres slow-start *(EPIC-003-AC03)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `docker compose down -v` | All containers + volumes removed. |
| 2 | Edit docker-compose.yml to temporarily remove `depends_on: postgres: service_healthy` from the `api` service. | (manual edit for this test only) |
| 3 | `docker compose up -d api postgres` — but `docker compose pause postgres` immediately. | API logs lines: `Waiting for postgres (attempt N/30)...`. API container does NOT crash. |
| 4 | Wait 20s, then `docker compose unpause postgres`. | API logs `Postgres available after N attempts`; `/api/health` returns 200. |
| 5 | Restore the original `docker-compose.yml`. | — |

#### SC-04 — `.gitignore` blocks runtime data *(EPIC-002-AC07)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | After `docker compose up`, run `git status --porcelain` | Output does **NOT** include `data/postgres/`, `data/redis/`, `.env`. |
| 2 | `touch data/inventory.xlsx` then `git status` | File **not** tracked. |

---

### Module M4 — Auth (S1+S2)

#### SC-05 — Login successfully *(EPIC-002-AC14)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `curl -s -X POST http://localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"<DEFAULT_ADMIN_PASSWORD>"}'` | Status 200. Body: `{"token":"eyJ...", "username":"admin","role":"admin","fullName":"Administrator","mustChangePassword":true,"expiresInSeconds":28800}`. |
| 2 | Save token: `TOKEN=$(curl ... \| jq -r .token)` | — |
| 3 | `redis-cli -a $REDIS_PASSWORD KEYS 'session:*'` (run inside redis container) | At least 1 key with TTL ≈ 8h. |
| 4 | `psql ... -c "SELECT action FROM audit_logs ORDER BY at DESC LIMIT 1"` | Returns `login.success`. |

#### SC-06 — Login with wrong password *(EPIC-002-AC15)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | POST /api/auth/login with `username=admin, password=wrong`. | Status **401**. Body `{"error":"Sai username hoặc password"}`. |
| 2 | POST same body but `username=nonexistent`. | **Same** 401 + **same** message (no user enumeration). |
| 3 | Query audit: `SELECT action FROM audit_logs ORDER BY at DESC LIMIT 2`. | Two rows `login.failed`. |

#### SC-07 — Account lockout after 5 failures *(EPIC-002-AC16)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | POST /login with `username=admin, password=wrong-pw` **5 times** in a row. | First 5 attempts return 401. |
| 2 | 6th attempt with **correct** password. | Status **423**. Body: `{"error":"Tài khoản bị tạm khoá. Thử lại sau 15 phút.","code":"account_locked","lockedUntil":"<iso>"}`. |
| 3 | `SELECT failed_login_attempts, locked_until FROM users WHERE username='admin'` | `failed_login_attempts=5`, `locked_until` ~ 15 min in future. |
| 4 | `SELECT action FROM audit_logs WHERE action='login.locked'` | At least 1 row. |
| 5 | (Optional, 15-min wait OR manual `UPDATE users SET locked_until=NULL WHERE username='admin'`) Then login correct pw. | 200 + new token. |

#### SC-08 — Logout invalidates the session immediately *(EPIC-002-AC17, AC42)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login → keep `$TOKEN`. | OK. |
| 2 | `curl -X POST localhost:3001/api/auth/logout -H "Authorization: Bearer $TOKEN"`. | 204 no content. |
| 3 | `redis-cli KEYS 'session:*'` | The session key just used is gone. |
| 4 | `curl localhost:3001/api/auth/me -H "Authorization: Bearer $TOKEN"`. | Status **401** within 2 seconds. Body contains `"code":"session_revoked"`. |
| 5 | `SELECT action FROM audit_logs WHERE action='logout'` | Row exists. |

#### SC-09 — Token with deleted Redis session *(EPIC-002-AC18)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login fresh → grab token + extract jti (decode JWT). | jti recorded. |
| 2 | `redis-cli DEL session:<jti>` | Returns 1. |
| 3 | `curl /api/inventory -H "Authorization: Bearer $TOKEN"`. | 401 with `code:"session_revoked"`. |

#### SC-10 — Redis down → 503 not bypass *(EPIC-002-AC19 — SECURITY GATE)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login → keep token. | OK. |
| 2 | `docker compose stop redis`. | Stops. |
| 3 | `curl -s -w "%{http_code}" /api/inventory -H "Authorization: Bearer $TOKEN"`. | Status **503**. Body `{"code":"auth_unavailable"}`. **NEVER** 200. |
| 4 | Repeat with admin endpoints `/api/admin/users`, `/api/admin/audit`. | Each = 503. |
| 5 | `docker compose start redis`; wait healthy. | Same calls return data again. |

#### SC-11 — X-Role header has zero effect *(EPIC-002-AC20 — SECURITY GATE)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `curl /api/admin/users -H "X-Role: admin" -H "X-Username: admin"` (no Bearer). | 401. |
| 2 | Login as a **non-admin** user (create one via SC-12 first). Use that user's token + add `X-Role: admin` header. | 403 (admin endpoint) or 401 (other). Never 200. |
| 3 | grep on running code: `grep -r 'Request.Headers\["X-Role"\]' server/` | 0 matches. |

---

### Module S3 — Admin User CRUD (backend only)

> **Note**: No FE admin pages yet. Use curl + Postman. FE pages deferred.

#### SC-12 — Admin creates a user *(EPIC-002-AC22)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login as admin → `$TOKEN`. | OK. |
| 2 | `curl -X POST localhost:3001/api/admin/users -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"username":"qa-user1","fullName":"QA One","role":"user","tempPassword":"Temp@1234"}'` | Status **201**. Body has `id, username, role, mustChangePassword:true, activeSessions:0`. |
| 3 | `psql ... -c "SELECT username, must_change_password FROM users WHERE username='qa-user1'"` | Row present with `must_change_password=t`. |
| 4 | `psql ... -c "SELECT menu, action, allowed FROM user_permissions WHERE user_id=(SELECT id FROM users WHERE username='qa-user1')"` | 3 default rows: `dashboard.view=t`, `inventory.view=t`, `transactions.view=t`. |
| 5 | Audit: `SELECT action, resource_id FROM audit_logs ORDER BY at DESC LIMIT 1` | `user.create` with the new id. |

#### SC-13 — Duplicate username rejected *(EPIC-002-AC23)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Repeat SC-12 with the same `username:"qa-user1"`. | Status **409**. Body `{"error":"Username đã tồn tại","code":"duplicate_username"}`. |
| 2 | Try `username:"QA-USER1"` (different case). | Same 409 (lowercase matching). |

#### SC-14 — Admin cannot self-delete *(EPIC-002-AC25)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Look up admin id: `psql ... -t -c "SELECT id FROM users WHERE username='admin'"`. | E.g., `1`. |
| 2 | As admin, `curl -X DELETE localhost:3001/api/admin/users/1 -H "Authorization: Bearer $TOKEN"`. | Status **400**. Body `{"error":"Không thể tự xoá tài khoản của mình."}`. |

#### SC-15 — Cannot delete last admin *(EPIC-002-AC26)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Create a second admin: POST /api/admin/users `{"username":"admin2","fullName":"","role":"admin","tempPassword":"Temp@1234"}`. | 201. |
| 2 | Login as admin2 → `$TOKEN2`. (Change pw on first login if forced.) | — |
| 3 | As admin2, DELETE original admin. | 204. |
| 4 | As admin2, DELETE admin2 (self). | 400 "Không thể tự xoá tài khoản của mình." |
| 5 | Create a non-admin `qa-attacker`. Manually call (using admin2 token but spoof actor): not possible from API — the API uses caller's id. **Skip** as the API enforces self-delete blocking. **Alternative**: directly probe `UserAdminService` via Test SC integration. |
| **Verified by:** integration test EPIC-003-IT-LAST-ADMIN-001. |

#### SC-16 — Soft-delete user + force logout-all *(EPIC-002-AC24 + AC30)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Create `qa-victim` via SC-12 flow. | Created. |
| 2 | Login as `qa-victim` twice from 2 terminals (use the temp pw → change pw → re-login). | 2 distinct tokens. |
| 3 | `redis-cli KEYS 'session:user:<victim-id>:*'` | 2 keys. |
| 4 | As admin, `curl -X DELETE localhost:3001/api/admin/users/<victim-id>` | 204. |
| 5 | `psql -c "SELECT deleted_at FROM users WHERE username='qa-victim'"` | Non-null timestamp. |
| 6 | `redis-cli KEYS 'session:user:<victim-id>:*'` | 0 keys. |
| 7 | From victim's first terminal: any API call with old token → 401 within 2s. | OK. |
| 8 | Login attempt as `qa-victim` | 401 (user soft-deleted, query excludes via `deleted_at IS NULL`). |

#### SC-17 — Permissions matrix update *(EPIC-002-AC27)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Get user id of qa-user1: `psql ...` | e.g. `<U>`. |
| 2 | `curl -X PUT localhost:3001/api/admin/users/<U>/permissions -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"permissions":{"inventory":{"view":true,"create":false,"update":true,"delete":false}}}'` | 200. Body returns the full matrix. |
| 3 | `SELECT menu, action, allowed FROM user_permissions WHERE user_id=<U> ORDER BY menu, action`. | Row `inventory.update=t` (was false). Other rows unchanged. |
| 4 | `SELECT action, before_json::text, after_json::text FROM audit_logs ORDER BY at DESC LIMIT 1`. | Row `user.permissions.update`. `before_json` and `after_json` both populated. |

> **NOTE** AC27's 30s propagation property (user sees the new permissions ≤ 30s) is **NOT YET ENFORCED** — permission middleware is deferred. Currently the user role still has full access to non-admin endpoints. See §3 Known Gaps.

#### SC-18 — Admin resets user password *(EPIC-002-AC28)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `curl -X POST localhost:3001/api/admin/users/<U>/reset-password -H "Authorization: Bearer $TOKEN"`. | 200. Body `{"tempPassword":"<16 chars>"}`. |
| 2 | `SELECT must_change_password FROM users WHERE id=<U>` | `t`. |
| 3 | `redis-cli KEYS 'session:user:<U>:*'` | 0 (sessions revoked). |
| 4 | Try to log in qa-user1 with the OLD password. | 401. |
| 5 | Log in with the new temp pw. | 200; `mustChangePassword=true`. |
| 6 | First request to /api/inventory while still on temp pw: FE forces `/change-password` dialog. | (FE behavior — already shipped in EPIC-002) |

#### SC-19 — Force logout-all *(EPIC-002-AC30)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | qa-user1 has 2 active sessions (login twice). | 2 keys in Redis. |
| 2 | `curl -X POST localhost:3001/api/admin/users/<U>/logout-all -H "Authorization: Bearer $TOKEN"`. | 200. Body `{"sessionsRevoked":2}`. |
| 3 | Both qa-user1 terminals' next call: 401 within 2s. | OK. |

---

### Module M5 — Audit (S2)

#### SC-20 — Audit covers all write actions *(EPIC-002-AC31)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Truncate audit: `psql -c "TRUNCATE audit_logs"` (as owner role, not app role). | — |
| 2 | Login → create user → update perms → reset pw → logout-all → DELETE user → logout. | — |
| 3 | `psql -c "SELECT action FROM audit_logs ORDER BY at"` | 7 rows in order: `login.success, user.create, user.permissions.update, password.reset, user.logout_all, user.delete, logout`. |
| 4 | `SELECT before_json IS NOT NULL, after_json IS NOT NULL FROM audit_logs WHERE action='user.permissions.update'` | Both true. |

#### SC-21 — Audit query endpoint *(EPIC-002-AC33)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `curl "localhost:3001/api/admin/audit?limit=10" -H "Authorization: Bearer $TOKEN" \| jq` | Body `{rows: [...], nextCursor, truncated:false}`. Up to 10 rows. |
| 2 | `curl "localhost:3001/api/admin/audit?action=login.success&limit=5"` | Only rows with `action="login.success"`. |
| 3 | `curl "localhost:3001/api/admin/audit?from=2026-01-01T00:00:00Z&to=2029-01-01T00:00:00Z"` | Filtered by time range. |

#### SC-22 — Audit truncation > 10k *(EPIC-002-AC34)* — READY (DB-heavy)

| Step | Action | Expected |
|---|---|---|
| 1 | Seed 10,001 rows: `psql -c "INSERT INTO audit_logs (actor_username, actor_role, action, resource_type) SELECT 'seed', 'admin', 'test.seed', 'r' FROM generate_series(1, 10001)"`. | — |
| 2 | `curl "localhost:3001/api/admin/audit"` | `rows.length=50`, `truncated=true`. |
| 3 | Add a filter to narrow under 10k. | `truncated=false`. |

#### SC-23 — Non-admin blocked from audit *(EPIC-002-AC35)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login as qa-user1 (role=user). | Token returned. |
| 2 | `curl /api/admin/audit -H "Authorization: Bearer $USER_TOKEN"`. | **403**. |

#### SC-24 — Audit survives user deletion *(EPIC-002-AC36)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | qa-victim has audit rows (from SC-16 actions). | OK. |
| 2 | Delete qa-victim. | OK. |
| 3 | `curl "localhost:3001/api/admin/audit?actor=qa-victim"` | Rows still present with `actor_username="qa-victim"`. |

---

### Security gates

#### SC-25 — Audit append-only at DB level *(EPIC-002-AC37 — SECURITY GATE)* — READY (after grants migration applied)

**Prereq:** Apply migration: `docker compose exec postgres psql -U inventory -d inventory -v "app_password='inventory_app_pw'" -f /docker-entrypoint-initdb.d/002_epic003_grants.sql`. Then change `POSTGRES_CONNECTION` env var to use `inventory_app` user.

| Step | Action | Expected |
|---|---|---|
| 1 | Connect as `inventory_app`: `psql -h localhost -U inventory_app -d inventory` | Connected. |
| 2 | `INSERT INTO audit_logs (actor_username, actor_role, action, resource_type) VALUES ('test', 'admin', 'manual.test', 'r');` | INSERT 1 row (success). |
| 3 | `UPDATE audit_logs SET action='tampered' WHERE id = currval('audit_logs_id_seq');` | ERROR: **permission denied for table audit_logs**. |
| 4 | `DELETE FROM audit_logs WHERE id = 1;` | ERROR: **permission denied**. |
| 5 | `TRUNCATE audit_logs;` | ERROR: **permission denied**. |
| 6 | Owner role (psql -U inventory) can still UPDATE/DELETE for compliance archives. | OK. |

#### SC-26 — CORS denies non-allowed origin *(EPIC-003-AC06)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `curl -i -X OPTIONS localhost:3001/api/health -H "Origin: https://evil.example.com" -H "Access-Control-Request-Method: GET"`. | Response **DOES NOT** include `Access-Control-Allow-Origin` header. |
| 2 | Same with `Origin: http://localhost:8080` (in ALLOWED_ORIGINS). | Response **DOES** include `Access-Control-Allow-Origin: http://localhost:8080`. |
| 3 | grep response headers across any request: never `*`. | Confirmed. |

#### SC-27 — Brute-force triggers rate-limit *(NFR)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Bash loop: `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"any","password":"x"}'; done`. | First ~10 = 401. Then 429s appear. |
| 2 | Check response of a 429: includes `Retry-After` header. | Integer seconds. |

#### SC-28 — Kill-switch warns *(tech-design §10.2)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Set env `DISABLE_REDIS_SESSION_CHECK=true`; restart API container. | — |
| 2 | Login then hit any protected endpoint. | Request succeeds even if you `DEL session:<jti>` (kill-switch bypasses). |
| 3 | `docker compose logs api \| grep DISABLED` | WARN line "SessionValidationMiddleware DISABLED via env (kill-switch active)" printed. |
| 4 | Unset the env var; restart. | Behavior returns to normal. |

---

### Module M6 — UI polish (existing, regression)

#### SC-29 — Sidebar fixed on desktop *(EPIC-002-AC38)* — READY (regression)

| Step | Action | Expected |
|---|---|---|
| 1 | Open web app at `http://localhost:8080`, login as admin, change pw if forced. | Dashboard renders. |
| 2 | Resize browser to ≥ 1280px. | Sidebar visible left. |
| 3 | Scroll content down 500–1000px on any page (e.g., Inventory after import). | Sidebar **does not move**; menu buttons stay at the same `y` position. |
| 4 | Resize to ≤ 414px. | Sidebar collapses to hamburger. |

#### SC-30 — Dashboard 4-color KPI cards *(EPIC-002-AC40)* — READY (regression)

| Step | Action | Expected |
|---|---|---|
| 1 | Go to `/dashboard`. | 4 KPI cards visible. |
| 2 | Inspect each card. | Distinct accent colors: indigo / emerald / amber / purple. Left border colored. Icon chip background colored. |
| 3 | Chrome DevTools → Lighthouse → Accessibility. | No new contrast violations. |

---

## 3. Known gaps (DEFERRED — flagged for next round)

These scenarios from EPIC-002 are **NOT** testable on the current build. Do not mark them PASS/FAIL — mark them **DEFERRED**.

| ID | What | Why deferred |
|---|---|---|
| SC-DEFERRED-AC21 | Non-admin role gets 403 on update operations | Permission middleware not implemented; user role currently has full access to non-admin endpoints |
| SC-DEFERRED-AC33-UI | Admin views audit list **in UI** | `/admin/audit` FE page not built; backend endpoint works (SC-21) |
| SC-DEFERRED-AC22-UI | Admin creates user **in UI** | `/admin/users` FE page not built; backend works (SC-12) |
| SC-DEFERRED-AC27-UI | Permission matrix **in UI** | Same |
| SC-DEFERRED-AC41 | Colorblind-safe chart palette | No chart added yet |
| SC-DEFERRED-AC13 | CLI `migrate-from-excel` command | Not implemented |
| SC-DEFERRED-CONCURRENT | 50-parallel writes load test | Requires k6 + perf env |

---

## 4. Regression Quick Check

Run **all** of the following before merging. Take ≤ 15 minutes for a competent tester.

| # | Action | Expected | Linked AC |
|---|---|---|---|
| R1 | `docker compose up -d` → wait | All 4 services healthy ≤ 60s | AC06 |
| R2 | `git status` | No `data/postgres/`, `data/redis/`, `.env` | AC07 |
| R3 | Web login as admin | Reach dashboard with 4 colored cards | AC14, AC40 |
| R4 | Scroll inventory page on desktop | Sidebar fixed | AC38 |
| R5 | Import xlsx (500 rows) | Toast success; rows visible | AC44 |
| R6 | EPIC-001 quick search "ca phe" on /inventory | Filters correctly | EPIC-001 regression |
| R7 | Add transaction (import) | `tonKho` updates | (existing) |
| R8 | Click Đăng xuất → next API call w/ old token | 401 within 2s | AC17 |
| R9 | `curl /api/health` | Verbose JSON, 200 | EPIC-003-AC05 |
| R10 | Any write action → check `audit_logs` | Row inserted | AC31 |
| R11 | As `inventory_app` role, `UPDATE audit_logs` (after migration) | Permission denied | AC37 |
| R12 | OPTIONS with bad Origin | No CORS allow header | EPIC-003-AC06 |

---

## 5. Verdict & Sign-off

### PASS criteria
- All READY scenarios PASS (SC-01..SC-30 minus deferred).
- All R1..R12 regression pass.
- **3 SECURITY GATES PASS:** SC-10 (AC19 Redis-down), SC-11 (AC20 X-Role), SC-25 (AC37 audit append-only).
- Defects logged with severity Medium or below.

### FAIL criteria (release blockers)
- Any SC fails on a SECURITY GATE.
- Any regression R1–R12 fails.
- `/api/health` returns 200 while Redis or Postgres down.
- X-Role header ever causes a non-admin to access admin endpoint.
- `inventory_app` role can UPDATE or DELETE on `audit_logs`.

### Sign-off

| Field | Value |
|---|---|
| Tester name | __________________________ |
| Date tested | __________________________ |
| Build / commit SHA | __________________________ |
| Sprint scope | EPIC-003 S1+S2+S3-backend+S5-partial |
| Verdict | PASS / PASS-WITH-DEFECTS / FAIL |
| Security reviewer | __________________________ (required) |

### Defect log

| # | Scenario | Severity (Blocker / High / Medium / Low) | Description | Repro | Ticket |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |

---

## 6. Traceability Matrix (this run)

| AC | Scenario | Status this build |
|---|---|---|
| EPIC-002-AC05 | SC-02 | READY |
| EPIC-002-AC07 | SC-04 | READY |
| EPIC-002-AC09 | SC-03 | READY |
| EPIC-002-AC14 | SC-05 | READY |
| EPIC-002-AC15 | SC-06 | READY |
| EPIC-002-AC16 | SC-07 | READY |
| EPIC-002-AC17 | SC-08 | READY |
| EPIC-002-AC18 | SC-09 | READY |
| **EPIC-002-AC19 GATE** | SC-10 | READY |
| **EPIC-002-AC20 GATE** | SC-11 | READY |
| EPIC-002-AC22 | SC-12 | READY |
| EPIC-002-AC23 | SC-13 | READY |
| EPIC-002-AC24 | SC-16 | READY |
| EPIC-002-AC25 | SC-14 | READY |
| EPIC-002-AC26 | SC-15 | READY (partial — last-admin via 2nd admin path verified by IT test) |
| EPIC-002-AC27 | SC-17 | READY backend; 30s-propagation UI DEFERRED |
| EPIC-002-AC28 | SC-18 | READY |
| EPIC-002-AC30 | SC-19 | READY |
| EPIC-002-AC31 | SC-20 | READY |
| EPIC-002-AC33 | SC-21 | READY backend |
| EPIC-002-AC34 | SC-22 | READY |
| EPIC-002-AC35 | SC-23 | READY |
| EPIC-002-AC36 | SC-24 | READY |
| **EPIC-002-AC37 GATE** | SC-25 | READY (after grants applied + connection swap) |
| EPIC-002-AC38 | SC-29 | READY (regression) |
| EPIC-002-AC40 | SC-30 | READY (regression) |
| EPIC-002-AC42 | SC-08 step 4 | READY |
| EPIC-003-AC03 | SC-03 | READY |
| EPIC-003-AC05 | SC-01 | READY |
| EPIC-003-AC06 | SC-26 | READY |
| AC21, AC33-UI, AC22-UI, AC27-UI, AC41, AC13 | (deferred — see §3) | DEFERRED |

**Summary:** **25 READY scenarios** + **2 SECURITY GATE READY** + **AC37 GATE READY** (after migration). **7 DEFERRED** to next implementation round.
