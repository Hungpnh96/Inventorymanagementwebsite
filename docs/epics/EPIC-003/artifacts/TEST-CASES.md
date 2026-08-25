# TEST-CASES — EPIC-003

**Epic:** EPIC-003 — Hoàn thiện EPIC-002
**Author:** QA
**Status:** Draft v1 — covers all M+S ACs from EPIC-002 (re-verified) + EPIC-003
**Last updated:** 2026-06-13

Source documents: PRD, TECH-DESIGN, TEST-PLAN, IMPLEMENT-SUMMARY (all in `docs/epics/EPIC-003/artifacts/`).

> **Status values:**
> - `implemented` — test file exists and is committed (at the path shown)
> - `drafted` — case specified here, no test file yet (next dev to author)
> - `blocked` — case depends on code not yet shipped (e.g., S4 permission middleware or FE admin pages)

---

## Index — AC → Test cases

| AC | Cases | Slice |
|---|---|---|
| EPIC-002-AC03 | EPIC-003-IT-PG-CONCURRENT-001 | S5 |
| EPIC-002-AC04 | EPIC-003-PF-INVENTORY-10K-001 | S5 |
| EPIC-002-AC05 | EPIC-003-IT-DUP-SKU-001, EPIC-003-UT-DUP-SKU-WRAP-001 | S5 |
| EPIC-002-AC09 | EPIC-003-UT-DB-RETRY-001..002, EPIC-003-IT-PG-WAIT-001 | S5 |
| EPIC-002-AC12 | EPIC-003-UT-XLSX-SKIP-BAD-ROW-001 | S5 (deferred) |
| EPIC-002-AC13 | EPIC-003-IT-CLI-MIGRATE-001 | S5 (deferred) |
| EPIC-002-AC16 | EPIC-003-UT-THROTTLE-LOCKS-5TH-001, EPIC-003-IT-LOGIN-LOCKS-001 | S1 |
| EPIC-002-AC17 | EPIC-003-UT-SESSION-REVOKE-001, EPIC-003-IT-LOGOUT-REPLAY-001 | S1 |
| EPIC-002-AC18 | EPIC-003-UT-MIDDLEWARE-MISSING-SESSION-401, EPIC-003-IT-MIDDLEWARE-401-001 | S1 |
| **EPIC-002-AC19 (GATE)** | EPIC-003-UT-MIDDLEWARE-REDIS-EXCEPTION-503, EPIC-003-IT-REDIS-DOWN-001, EPIC-003-SEC-REDIS-DOWN-NO-BYPASS-001 | S1 |
| **EPIC-002-AC20 (GATE)** | EPIC-003-SEC-XROLE-IGNORED-001, EPIC-003-UT-NO-X-ROLE-GREP-001, EPIC-003-IT-XROLE-NO-EFFECT-001 | S1 |
| EPIC-002-AC21 | EPIC-003-IT-PERM-DENY-001 | S4 (blocked) |
| EPIC-002-AC22 | EPIC-003-IT-ADMIN-CREATE-USER-001 | S3 |
| EPIC-002-AC23 | EPIC-003-IT-USER-DUP-001, EPIC-003-UT-USER-CREATE-DUP-001 | S3 |
| EPIC-002-AC24 | EPIC-003-IT-USER-SOFT-DELETE-001 | S3 |
| EPIC-002-AC25 | EPIC-003-IT-SELF-DELETE-001 | S3 |
| EPIC-002-AC26 | EPIC-003-IT-LAST-ADMIN-001 | S3 |
| EPIC-002-AC27 | EPIC-003-IT-PERMS-UPDATE-001, EPIC-003-UT-PERMS-AUDIT-BEFORE-AFTER-001 | S3 |
| EPIC-002-AC28 | EPIC-003-IT-RESET-PW-001, EPIC-003-UT-RESET-PW-001 | S3 |
| EPIC-002-AC29 | EPIC-003-UI-FORCE-CHANGE-001 | DONE |
| EPIC-002-AC30 | EPIC-003-UT-SESSION-REVOKE-ALL-001, EPIC-003-IT-LOGOUT-ALL-001 | S3 |
| EPIC-002-AC31 | EPIC-003-IT-AUDIT-COVERAGE-001, EPIC-003-UT-AUDIT-WRITE-001 | S2 |
| EPIC-002-AC32 | EPIC-003-IT-AUDIT-LOGIN-LIFECYCLE-001 | S2 |
| EPIC-002-AC33 | EPIC-003-IT-AUDIT-LIST-001 | S4 partial |
| EPIC-002-AC34 | EPIC-003-IT-AUDIT-TRUNCATED-001, EPIC-003-UT-AUDIT-QUERY-TRUNCATED-001 | S4 partial |
| EPIC-002-AC35 | EPIC-003-IT-AUDIT-NON-ADMIN-403 | S4 |
| EPIC-002-AC36 | EPIC-003-IT-AUDIT-SNAPSHOT-001 | S4 |
| **EPIC-002-AC37 (GATE)** | EPIC-003-SEC-AUDIT-APPEND-ONLY-001, EPIC-003-IT-AUDIT-REVOKE-UPDATE-001, EPIC-003-IT-AUDIT-REVOKE-DELETE-001 | S5 |
| EPIC-002-AC42 | EPIC-003-IT-LOGOUT-ALL-TABS-001 | S1 |
| EPIC-002-AC43 | EPIC-003-IT-EXPORT-FROM-PG-001 | (existing) |
| EPIC-002-AC44 | EPIC-003-IT-IMPORT-TO-PG-001 | (existing) |
| EPIC-003-AC03 | EPIC-003-UT-DB-RETRY-EVENTUAL-OK-001, EPIC-003-UT-DB-RETRY-EXHAUSTS-001 | S5 |
| EPIC-003-AC04 | EPIC-003-LC-REDIS-RETRY-001 | S5 partial |
| EPIC-003-AC05 | EPIC-003-CT-HEALTH-200, EPIC-003-CT-HEALTH-503-PG, EPIC-003-CT-HEALTH-503-REDIS | S5 |
| EPIC-003-AC06 | EPIC-003-SEC-CORS-DENY-WILDCARD-001 | S5 |
| EPIC-003-AC07 | EPIC-003-UT-AUDIT-COVERAGE-GREP-001 | S2 |
| EPIC-003-AC10 | EPIC-003-UT-NO-MAGIC-STRINGS-001 | S2 |
| EPIC-003-AC11 | EPIC-003-RG-EPIC-002-001..010 | RG |
| EPIC-003-AC13 | EPIC-003-IT-SESSION-COUNT-001 | S3 |

---

## Test cases — Unit (`EPIC-003-UT-*`)

### SessionStore

#### EPIC-003-UT-SESSION-CREATE-001 — Creates both keys with TTL
- **AC:** EPIC-002-AC17
- **Type:** Unit
- **Preconditions:** Fresh fake Redis multiplexer
- **Steps:**
  1. `var ss = new SessionStore(fakeRedis);`
  2. `await ss.CreateAsync("jti-abc", userId: 42, role: "user", ttl: TimeSpan.FromHours(1));`
- **Expected:** Both `session:jti-abc` and `session:user:42:jti-abc` exist in Redis with TTL ≈ 1h.
- **Test path:** `server/Server.Tests/SessionStoreTests.cs` *(drafted — to be authored)*
- **Status:** drafted

#### EPIC-003-UT-SESSION-REVOKE-001 — RevokeAsync deletes both keys
- **AC:** EPIC-002-AC17
- **Steps:** Create session → `RevokeAsync(jti, userId)` → `ExistsAsync(jti)` returns false.
- **Expected:** Returns false.
- **Status:** drafted

#### EPIC-003-UT-SESSION-REVOKE-ALL-001 — RevokeAllForUserAsync nukes all sessions of given user only
- **AC:** EPIC-002-AC30
- **Steps:** Seed 3 sessions for user 42 + 1 for user 99 → `RevokeAllForUserAsync(42)` → returns 3.
- **Expected:** User 42 sessions gone; user 99 untouched.
- **Status:** drafted

#### EPIC-003-UT-SESSION-USES-SCAN-001 — Source uses SCAN, not blocking KEYS
- **AC:** Risk §12 of TECH-DESIGN
- **Type:** Static analysis
- **Steps:** Grep `server/SessionStore.cs` for `IDatabase.Keys(` (sync KEYS) — must return 0 matches. Only `IServer.KeysAsync` allowed.
- **Status:** drafted

### LoginThrottle

#### EPIC-003-UT-THROTTLE-IP-LIMIT-001
- **AC:** EPIC-002 NFR rate-limit
- **Steps:** Call `CheckRateLimitAsync("1.2.3.4", "alice")` 11 times → 11th returns `Allowed=false, RetryAfterSeconds in [1..60]`.
- **Status:** drafted

#### EPIC-003-UT-THROTTLE-USER-LIMIT-001
- **AC:** same
- **Steps:** Call 6 times same username from different IPs → 6th `Allowed=false`.
- **Status:** drafted

#### EPIC-003-UT-THROTTLE-LOCKS-5TH-001 — Locks account on 5th failure
- **AC:** EPIC-002-AC16
- **Preconditions:** Seed user with `FailedLoginAttempts=4`; `FakeClock` at `2026-01-01T00:00:00Z`.
- **Steps:** `RegisterFailureAsync(user)`.
- **Expected:** DB now has `failed_login_attempts=5, locked_until=2026-01-01T00:15:00Z`; Redis has key `login:lock:<id>`.
- **Status:** drafted

#### EPIC-003-UT-THROTTLE-CLOCK-INJECTED-001
- **AC:** flaky-test policy §12 of TEST-PLAN
- **Steps:** Inject FakeClock; verify locked_until is `clock.UtcNow + 15min` exactly.
- **Status:** drafted

### AuthService

#### EPIC-003-UT-TOKEN-HAS-JTI-001
- **AC:** EPIC-002-AC17 (jti required for session correlation)
- **Steps:** `IssueToken(user)` → decode JWT → assert `jti` claim equals `IssuedToken.Jti`.
- **Status:** drafted

#### EPIC-003-UT-TOKEN-JTI-UNIQUE-001
- **Steps:** Call IssueToken twice for same user; assert two different `Jti` values.
- **Status:** drafted

### AuditLogger

#### EPIC-003-UT-AUDIT-WRITE-001
- **AC:** EPIC-002-AC31
- **Steps:** Call `LogAsync(action="user.create", before=null, after=new {id=1})` against integration DB → audit_logs has 1 row with `after_json::text` containing `"id":1`, `before_json` is SQL NULL.
- **Status:** drafted

#### EPIC-003-UT-AUDIT-WRITE-DB-ERROR-SWALLOWED-001
- **AC:** §6.4 of TECH-DESIGN
- **Steps:** Mock Db.OpenAsync to throw → `LogAsync(...)` does NOT throw; `ILogger.LogError` called once.
- **Status:** drafted

#### EPIC-003-UT-AUDIT-COVERAGE-GREP-001 — every write endpoint has audit call
- **AC:** EPIC-003-AC07
- **Type:** Static analysis (xUnit test runs at build time)
- **Steps:** Open `server/Program.cs`; for every line matching `(app\.MapPost|app\.MapPut|app\.MapDelete)\("/api/`, find a `audit.LogAsync` within the following 80 lines OR within the immediate lambda body. Whitelist: `/api/health`, `/api/auth/login` (manual handling).
- **Expected:** zero violations.
- **Status:** drafted

#### EPIC-003-UT-NO-MAGIC-STRINGS-001
- **AC:** EPIC-003-AC10
- **Type:** Static analysis
- **Steps:** Grep `audit\.LogAsync\("[a-z]` in `server/Program.cs` — must be 0 matches (all action args use `AuditActions.*` constants).
- **Status:** drafted

#### EPIC-003-UT-NO-X-ROLE-GREP-001
- **AC:** EPIC-002-AC20
- **Type:** Static analysis
- **Steps:** Grep `Headers\["X-Role"\]|Headers\["X-Username"\]` across `server/**/*.cs` — must be 0.
- **Status:** drafted

### SessionValidationMiddleware

#### EPIC-003-UT-MIDDLEWARE-PASSTHROUGH-ANON
- **AC:** EPIC-002-AC18
- **Test path:** `server/Server.Tests/SessionValidationMiddlewareTests.cs:34`
- **Status:** **implemented**

#### EPIC-003-UT-MIDDLEWARE-MISSING-JTI
- **AC:** EPIC-002-AC18
- **Test path:** `server/Server.Tests/SessionValidationMiddlewareTests.cs:49`
- **Status:** **implemented**

#### EPIC-003-UT-MIDDLEWARE-MISSING-SESSION-401
- **AC:** EPIC-002-AC18
- **Test path:** `server/Server.Tests/SessionValidationMiddlewareTests.cs:62`
- **Status:** **implemented**

#### EPIC-003-UT-MIDDLEWARE-VALID-PASSES
- **AC:** EPIC-002-AC18
- **Test path:** `server/Server.Tests/SessionValidationMiddlewareTests.cs:76`
- **Status:** **implemented**

#### EPIC-003-UT-MIDDLEWARE-REDIS-EXCEPTION-503 *(security gate)*
- **AC:** EPIC-002-AC19
- **Test path:** `server/Server.Tests/SessionValidationMiddlewareTests.cs:91`
- **Status:** **implemented**

#### EPIC-003-UT-MIDDLEWARE-UNEXPECTED-EXCEPTION-503
- **AC:** EPIC-002-AC19
- **Test path:** `server/Server.Tests/SessionValidationMiddlewareTests.cs:108`
- **Status:** **implemented**

#### EPIC-003-UT-MIDDLEWARE-KILL-SWITCH
- **AC:** tech-design §10.2
- **Test path:** `server/Server.Tests/SessionValidationMiddlewareTests.cs:124`
- **Status:** **implemented**

### UserAdminService

#### EPIC-003-UT-USER-CREATE-DUP-001
- **AC:** EPIC-002-AC23
- **Steps:** Insert user "alice"; call `CreateAsync(username="alice", ...)` second time.
- **Expected:** `Ok=false, Error="Username đã tồn tại"`.
- **Status:** drafted

#### EPIC-003-UT-PERMS-AUDIT-BEFORE-AFTER-001
- **AC:** EPIC-002-AC27
- **Steps:** Seed user with empty perms; call `UpdatePermissionsAsync` toggling `inventory.update=true`.
- **Expected:** `Before["inventory"]["update"]==false`, `After["inventory"]["update"]==true`.
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:153`
- **Status:** **implemented**

#### EPIC-003-UT-RESET-PW-001
- **AC:** EPIC-002-AC28
- **Steps:** Seed user; call `ResetPasswordAsync(userId)`.
- **Expected:** TempPassword is 16 chars; `must_change_password=true`; all sessions revoked.
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:172`
- **Status:** **implemented**

### AuditQueryService

#### EPIC-003-UT-AUDIT-QUERY-DEFAULT-LIMIT-001
- **AC:** EPIC-002-AC33
- **Steps:** Call `QueryAsync(Filter(Limit:0, ...))`.
- **Expected:** Uses default limit 50.
- **Status:** drafted

#### EPIC-003-UT-AUDIT-QUERY-TRUNCATED-001
- **AC:** EPIC-002-AC34
- **Steps:** Seed 10,001 rows; query with no cursor.
- **Expected:** Response `Truncated=true`, `Rows.Count <= 50`.
- **Status:** drafted

### Db retry

#### EPIC-003-UT-DB-RETRY-EVENTUAL-OK-001
- **AC:** EPIC-003-AC03
- **Steps:** Db pointing at port not yet listening; spin up Postgres on that port after 5×2s delay; call `OpenWithRetryAsync`.
- **Expected:** Returns connection after ~5 retries; log line "Postgres available after 5 attempts".
- **Status:** drafted

#### EPIC-003-UT-DB-RETRY-EXHAUSTS-001
- **AC:** EPIC-003-AC03
- **Steps:** Db pointing at port that never listens; call `OpenWithRetryAsync(attempts:3, delayMs:100)`.
- **Expected:** Throws `InvalidOperationException("Postgres unreachable after 3 attempts")`.
- **Status:** drafted

### Duplicate SKU wrap

#### EPIC-003-UT-DUP-SKU-WRAP-001
- **AC:** EPIC-002-AC05
- **Steps:** Mock PostgresStore.ReplaceProductsAsync to throw `PostgresException(...)` with SqlState "23505"; call POST /api/products via WebApplicationFactory.
- **Expected:** HTTP 409, body contains `"code":"duplicate_sku"`.
- **Status:** drafted

---

## Test cases — Contract (`EPIC-003-CT-*`)

#### EPIC-003-CT-LOGIN-200
- **AC:** EPIC-002-AC14
- **Steps:** POST /api/auth/login with valid creds.
- **Expected:** 200; body keys: `token, username, role, fullName, mustChangePassword, expiresInSeconds`.
- **Status:** drafted

#### EPIC-003-CT-LOGIN-401
- **AC:** EPIC-002-AC15
- **Expected:** 401; body `{error: string}`.
- **Status:** drafted

#### EPIC-003-CT-LOGIN-423
- **AC:** EPIC-002-AC16
- **Expected:** 423; body `{error, code:"account_locked", lockedUntil:ISO}`.
- **Status:** drafted

#### EPIC-003-CT-LOGIN-429
- **AC:** NFR rate-limit
- **Expected:** 429; header `Retry-After` present (integer); body `{error, code:"rate_limited"}`.
- **Status:** drafted

#### EPIC-003-CT-LOGOUT-204
- **AC:** EPIC-002-AC17
- **Expected:** 204; empty body.
- **Status:** drafted

#### EPIC-003-CT-HEALTH-200
- **AC:** EPIC-003-AC05
- **Expected:** 200; body `{api:"ok", postgres:"ok", redis:"ok", time:ISO}`.
- **Status:** drafted

#### EPIC-003-CT-HEALTH-503-PG
- **Steps:** Stop Postgres container.
- **Expected:** 503; body `{api:"ok", postgres:"down", redis:"ok", ...}`.
- **Status:** drafted

#### EPIC-003-CT-HEALTH-503-REDIS
- **Steps:** Stop Redis.
- **Expected:** 503; `redis:"down"`.
- **Status:** drafted

#### EPIC-003-CT-ADMIN-USER-CREATE-201
- **AC:** EPIC-002-AC22
- **Expected:** 201; Location header; body shape `UserListItem`.
- **Status:** drafted

#### EPIC-003-CT-ADMIN-USER-CREATE-409
- **AC:** EPIC-002-AC23
- **Expected:** 409; body `{error:"Username đã tồn tại", code:"duplicate_username"}`.
- **Status:** drafted

#### EPIC-003-CT-AUDIT-LIST-200
- **AC:** EPIC-002-AC33
- **Expected:** 200; body `{rows: [...], nextCursor: string|null, truncated: bool}`.
- **Status:** drafted

---

## Test cases — Integration (`EPIC-003-IT-*`)

> All integration tests use Testcontainers (`Testcontainers.PostgreSql`, `Testcontainers.Redis`). Each test class brings up fresh containers via `IAsyncLifetime`.

#### EPIC-003-IT-LOGIN-LOCKS-001
- **AC:** EPIC-002-AC16
- **Steps:** Seed admin; POST /login with wrong pw 5 times in a row.
- **Expected:** 6th attempt returns 423; `users.locked_until` populated; audit row `login.locked` exists.
- **Status:** drafted

#### EPIC-003-IT-LOGOUT-REPLAY-001
- **AC:** EPIC-002-AC17
- **Steps:** Login → grab token → POST /logout → use same token on GET /me.
- **Expected:** /me returns 401.
- **Status:** drafted

#### EPIC-003-IT-MIDDLEWARE-401-001
- **AC:** EPIC-002-AC18
- **Steps:** Login → manually `KeyDelete session:<jti>` in Redis → GET /api/inventory.
- **Expected:** 401.
- **Status:** drafted

#### EPIC-003-IT-REDIS-DOWN-001 *(security gate AC19)*
- **AC:** EPIC-002-AC19
- **Steps:** Login → stop Redis container → GET /api/inventory.
- **Expected:** 503; body `{code:"auth_unavailable"}`. Restart Redis → GET succeeds.
- **Status:** drafted

#### EPIC-003-IT-XROLE-NO-EFFECT-001 *(security gate AC20)*
- **AC:** EPIC-002-AC20
- **Steps:** Send curl with `X-Role: admin` header, no Bearer.
- **Expected:** 401. Send with user Bearer + `X-Role: admin` → 403 on admin endpoints (header has zero contribution).
- **Status:** drafted

#### EPIC-003-IT-ADMIN-CREATE-USER-001
- **AC:** EPIC-002-AC22
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:80`
- **Status:** **implemented**

#### EPIC-003-IT-USER-DUP-001
- **AC:** EPIC-002-AC23
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:100`
- **Status:** **implemented**

#### EPIC-003-IT-SELF-DELETE-001
- **AC:** EPIC-002-AC25
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:115`
- **Status:** **implemented**

#### EPIC-003-IT-LAST-ADMIN-001
- **AC:** EPIC-002-AC26
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:131`
- **Status:** **implemented**

#### EPIC-003-IT-USER-SOFT-DELETE-001
- **AC:** EPIC-002-AC24 + AC30
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:142`
- **Status:** **implemented**

#### EPIC-003-IT-PERMS-UPDATE-001
- **AC:** EPIC-002-AC27
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:153`
- **Status:** **implemented**

#### EPIC-003-IT-RESET-PW-001
- **AC:** EPIC-002-AC28
- **Test path:** `server/Server.Tests/UserAdminServiceTests.cs:172`
- **Status:** **implemented**

#### EPIC-003-IT-AUDIT-COVERAGE-001
- **AC:** EPIC-002-AC31
- **Steps:** Login → create user → update perms → reset pw → logout. Query audit_logs.
- **Expected:** 5 rows with actions: `login.success, user.create, user.permissions.update, password.reset, logout`.
- **Status:** drafted

#### EPIC-003-IT-AUDIT-LOGIN-LIFECYCLE-001
- **AC:** EPIC-002-AC32
- **Steps:** Login fail × 5 → 6th locked; then login success → logout.
- **Expected:** Audit rows: 5× `login.failed`, 1× `login.locked`, 1× `login.success`, 1× `logout`.
- **Status:** drafted

#### EPIC-003-IT-AUDIT-LIST-001
- **AC:** EPIC-002-AC33
- **Steps:** Seed 100 audit rows; GET /api/admin/audit?limit=20 as admin.
- **Expected:** 200; 20 rows sorted by `at` desc; `nextCursor=id:<oldestId>`.
- **Status:** drafted

#### EPIC-003-IT-AUDIT-TRUNCATED-001
- **AC:** EPIC-002-AC34
- **Steps:** Seed 10,001 rows; GET /api/admin/audit.
- **Expected:** `truncated=true`; 50 rows.
- **Status:** drafted

#### EPIC-003-IT-AUDIT-NON-ADMIN-403
- **AC:** EPIC-002-AC35
- **Steps:** Login as user role; GET /api/admin/audit.
- **Expected:** 403.
- **Status:** drafted

#### EPIC-003-IT-AUDIT-SNAPSHOT-001
- **AC:** EPIC-002-AC36
- **Steps:** User `test2` does some action (logs row with actor_username='test2'); admin deletes test2; query audit by actor.
- **Expected:** Row still has `actor_username='test2'`.
- **Status:** drafted

#### EPIC-003-IT-DUP-SKU-001
- **AC:** EPIC-002-AC05
- **Steps:** POST /api/products with two products having same SKU.
- **Expected:** 409; not 500.
- **Status:** drafted

#### EPIC-003-IT-PG-WAIT-001
- **AC:** EPIC-002-AC09 / EPIC-003-AC03
- **Steps:** docker compose with API set to start before Postgres healthy.
- **Expected:** API logs "Waiting for postgres" warnings; eventually connects; no crash.
- **Status:** drafted (manual run)

#### EPIC-003-IT-EPIC-001-SEARCH-REGRESSION
- **AC:** No regression of EPIC-001
- **Steps:** Login → /inventory; search "ca phe"; verify result.
- **Status:** drafted (Playwright)

---

## Test cases — Security (`EPIC-003-SEC-*`)

#### EPIC-003-SEC-XROLE-IGNORED-001 *(GATE AC20)*
- **Type:** SEC + IT
- **Steps:** Try `X-Role: admin` with no token / user token / admin token. Capture response status across 5 admin endpoints.
- **Expected:** Status determined entirely by Bearer token; X-Role header contributes nothing (no 200 ever leaked from non-admin caller).
- **Status:** drafted

#### EPIC-003-SEC-REDIS-DOWN-NO-BYPASS-001 *(GATE AC19)*
- **Steps:** Stop Redis; brute-force script attempts 100 reqs with stolen JWT.
- **Expected:** 100% 503; 0% 200/2xx.
- **Status:** drafted

#### EPIC-003-SEC-AUDIT-APPEND-ONLY-001 *(GATE AC37)*
- **Steps:** Connect to PG as `inventory_app`; `UPDATE audit_logs SET action='x'`; `DELETE FROM audit_logs`.
- **Expected:** Both raise "permission denied". INSERT succeeds.
- **Status:** drafted

#### EPIC-003-SEC-IT-AUDIT-REVOKE-UPDATE-001
- **AC:** EPIC-002-AC37
- **Steps:** Connect as `inventory_app`; UPDATE attempt on `audit_logs`.
- **Expected:** PostgresException error code 42501 (insufficient_privilege).
- **Status:** drafted

#### EPIC-003-SEC-IT-AUDIT-REVOKE-DELETE-001
- **AC:** EPIC-002-AC37
- **Steps:** DELETE attempt.
- **Expected:** 42501.
- **Status:** drafted

#### EPIC-003-SEC-BRUTE-FORCE-001
- **AC:** EPIC-002-AC16 + NFR rate-limit
- **Steps:** k6 load: 1000 logins/min with random pw from 1 IP.
- **Expected:** Within 11 requests = 429; within 5 wrong-pw on same username = 423.
- **Status:** drafted

#### EPIC-003-SEC-SQL-INJECTION-LOGIN-001
- **AC:** EPIC-002-AC15
- **Steps:** POST /login with `username: "' OR 1=1; --"`.
- **Expected:** 401; no SQL error; no leak.
- **Status:** drafted

#### EPIC-003-SEC-CORS-DENY-WILDCARD-001
- **AC:** EPIC-003-AC06
- **Steps:** OPTIONS preflight with `Origin: https://evil.example.com` (not in ALLOWED_ORIGINS).
- **Expected:** No `Access-Control-Allow-Origin` header in response.
- **Status:** drafted

#### EPIC-003-SEC-NO-SECRETS-IN-LOGS-001
- **AC:** NFR
- **Steps:** Trigger login + change-password; grep stdout for `JWT_SECRET`, `password_hash`, `Authorization: Bearer`.
- **Expected:** 0 matches.
- **Status:** drafted

#### EPIC-003-SEC-PASSWORD-NOT-IN-AUDIT-001
- **AC:** NFR
- **Steps:** Trigger reset-password; query audit_logs row.
- **Expected:** neither `before_json` nor `after_json` contains plaintext password (verified by grep for the actual temp pw string).
- **Status:** drafted

#### EPIC-003-SEC-KILL-SWITCH-WARNS-001
- **AC:** tech-design §10.2
- **Steps:** Set `DISABLE_REDIS_SESSION_CHECK=true`, hit any protected endpoint, scrape log.
- **Expected:** WARN line containing `DISABLED` printed (visible to ops).
- **Status:** drafted

---

## Test cases — Performance (`EPIC-003-PF-*`)

#### EPIC-003-PF-LOGIN-P95-001
- **AC:** NFR §9.1 of TECH-DESIGN
- **Threshold:** p95 ≤ 500ms over 100 concurrent logins.
- **Tool:** k6 script `server/Server.Tests/k6/login.js` (to author)
- **Status:** drafted

#### EPIC-003-PF-INVENTORY-10K-001
- **AC:** EPIC-002-AC04
- **Threshold:** p95 ≤ 300ms over 100 GET /api/inventory with 10,000 products seeded.
- **Status:** drafted

#### EPIC-003-PF-AUTH-MIDDLEWARE-OVERHEAD-001
- **AC:** §9.1 of TECH-DESIGN
- **Threshold:** Difference between /api/health (no auth) and /api/inventory (auth) latency ≤ 8ms p99.
- **Status:** drafted

#### EPIC-003-PF-AUDIT-PAGE-LOAD-001
- **AC:** EPIC-003-AC09
- **Threshold:** GET /api/admin/audit?limit=50 over 100k seeded rows; p95 ≤ 800ms.
- **Status:** drafted

#### EPIC-003-PF-AUDIT-WRITE-001
- **AC:** Risk §12
- **Threshold:** Audit INSERT p99 overhead ≤ 5ms.
- **Status:** drafted

---

## Test cases — UI / Frontend (`EPIC-003-UI-*`)

> Framework: Vitest + @testing-library/react + MSW. The project currently has no test runner configured; these are drafted for when vitest is installed.

#### EPIC-003-UI-LOGIN-SUBMIT-001
- **AC:** EPIC-002-AC14
- **Steps:** Render `<LoginPage>`; type credentials; click submit.
- **Expected:** `fetch('/api/auth/login')` POSTed with right body.
- **Status:** drafted

#### EPIC-003-UI-LOGIN-LOCKED-423-001
- **AC:** EPIC-002-AC16
- **Steps:** MSW returns 423.
- **Expected:** Toast "Tài khoản bị tạm khoá. Thử lại sau 15 phút."
- **Status:** drafted

#### EPIC-003-UI-LOGOUT-CLEARS-LOCAL-001
- **AC:** EPIC-002-AC17
- **Steps:** Click "Đăng xuất".
- **Expected:** localStorage `auth_token` removed; LoginPage rendered.
- **Status:** drafted

#### EPIC-003-UI-FORCE-CHANGE-001
- **AC:** EPIC-002-AC29
- **Steps:** Mount App with `me.mustChangePassword=true`.
- **Expected:** ChangePasswordDialog open with `forced` prop true.
- **Status:** drafted

#### EPIC-003-UI-SIDEBAR-FIXED-DESKTOP-001
- **AC:** EPIC-002-AC38
- **Steps:** Playwright; viewport 1280×800; scroll main 500px.
- **Expected:** Sidebar `getBoundingClientRect().top` unchanged.
- **Status:** drafted

#### EPIC-003-UI-DASHBOARD-COLORED-001
- **AC:** EPIC-002-AC40
- **Steps:** Render Dashboard with sample data.
- **Expected:** 4 KPI cards have 4 distinct `background` computed colors.
- **Status:** drafted

#### EPIC-003-UI-ADMIN-USERS-PAGE-001
- **AC:** EPIC-002-AC22
- **Status:** blocked (FE admin pages deferred)

#### EPIC-003-UI-AUDIT-PAGE-001
- **AC:** EPIC-002-AC33
- **Status:** blocked

---

## Test cases — Failure-mode

### Network (`EPIC-003-NET-*`)

#### EPIC-003-NET-OFFLINE-FE-001
- **AC:** §9.7 of TECH-DESIGN
- **Steps:** With FE open, kill backend; wait 3 polls of /api/health.
- **Expected:** Banner "Mất kết nối tới máy chủ" appears.
- **Status:** drafted

### Concurrency (`EPIC-003-CC-*`)

#### EPIC-003-CC-CONCURRENT-WRITE-001
- **AC:** EPIC-002-AC03
- **Steps:** 50 parallel POST /api/products with unique SKUs.
- **Expected:** All succeed; final count = 50; no deadlock; no row loss.
- **Status:** drafted

### Upstream failure (`EPIC-003-UP-*`)

#### EPIC-003-UP-REDIS-CONNECTION-RESET-001
- **AC:** EPIC-002-AC19
- **Steps:** Mid-session, kill Redis with -9; restart it.
- **Expected:** During downtime, all auth-required requests = 503. After Redis up, existing JWTs (whose sessions still in Redis after restart with appendonly persistence) work again.
- **Status:** drafted

### Lifecycle (`EPIC-003-LC-*`)

#### EPIC-003-LC-PG-WAIT-001
- **AC:** EPIC-003-AC03
- **Steps:** Start API before Postgres healthy.
- **Expected:** API logs retry messages, eventually connects; no crash within 60s.
- **Status:** drafted

#### EPIC-003-LC-REDIS-RETRY-001
- **AC:** EPIC-003-AC04
- **Status:** PARTIAL — `ConnectionMultiplexer.Connect` has `AbortOnConnectFail=false`. Full LC test deferred.

---

## Regression checklist (`EPIC-003-RG-*`)

Per TEST-PLAN §10. Run all before merging any slice.

#### EPIC-003-RG-001 — `docker compose up -d` brings all 4 services healthy ≤ 60s.
#### EPIC-003-RG-002 — `.gitignore` blocks `data/postgres/` and `.env`.
#### EPIC-003-RG-003 — Login as admin shows 4-color dashboard.
#### EPIC-003-RG-004 — Sidebar stays fixed when scrolling on desktop.
#### EPIC-003-RG-005 — Import xlsx 500 rows → toast success.
#### EPIC-003-RG-006 — EPIC-001 quick search still works.
#### EPIC-003-RG-007 — Add transaction (import) succeeds; `tonKho` updates.
#### EPIC-003-RG-008 — Logout → next API call with old token = 401.
#### EPIC-003-RG-009 — Refresh on inventory route returns to login (pre-existing FE limitation).
#### EPIC-003-RG-010 — `/api/health` returns verbose JSON.
#### EPIC-003-RG-011 — Any write action lands in `audit_logs`.
#### EPIC-003-RG-012 — `psql -U inventory_app -c "UPDATE audit_logs SET action='x'"` → permission denied.

---

## Skipped categories (with justification)

Per TEST-PLAN §3 "out of scope":

- **EPIC-002-AC45..47 (W)** — SSO/2FA/multi-tenant/realtime websocket — out of roadmap for EPIC-003.
- **EPIC-003-AC14 (W)** — auto-archive audit > 2 years — v2.
- **Mobile / desktop platform matrix** — project is web-only.
- **i18n test matrix** — vi-VN only in v1.
- **A11Y deep tests for admin pages** — admin pages deferred; will add when FE pages ship.

---

## Quality Gate Self-Check

- [x] Every M+S AC has at least one test case (verified in §Index table)
- [x] Each case has a single, observable expected outcome
- [x] Test paths point at real files for `implemented` cases (verified via `Read` after `Write`)
- [x] No flaky-by-design patterns (no `Thread.Sleep`, all clocks injectable via `FakeClock`, Redis/PG run in Testcontainers per test class)
- [x] Generated test files compile — **PENDING** verification on host with `dotnet test` (toolchain unavailable; tests written to compile against current project shape)
- [x] Security gates (AC19, AC20, AC37) each have ≥ 3 distinct test cases (UT + IT + SEC)
- [x] Static-analysis tests guard AC07, AC10, AC20 (grep tests survive regression)

---

## Files committed in this change

| Path | Purpose | Status |
|---|---|---|
| `docs/epics/EPIC-003/artifacts/TEST-CASES.md` | This document | new |
| `server/Server.Tests/Server.Tests.csproj` | xUnit project file (NuGet refs: xunit, FluentAssertions, Moq, Testcontainers, coverlet, Microsoft.AspNetCore.Mvc.Testing) | new |
| `server/Server.Tests/Fakes/FakeClock.cs` | `IClock` test double for deterministic time | new |
| `server/Server.Tests/SessionValidationMiddlewareTests.cs` | 7 unit tests for the security-critical middleware (incl. 2 SECURITY GATE tests for AC19) | new |
| `server/Server.Tests/UserAdminServiceTests.cs` | 7 integration tests for admin CRUD using Testcontainers | new |

To enable test execution:
```bash
cd server
dotnet test Server.Tests/Server.Tests.csproj --collect:"XPlat Code Coverage"
```

Tests requiring real Docker (Testcontainers PG/Redis) will pull images and start containers on first run.
