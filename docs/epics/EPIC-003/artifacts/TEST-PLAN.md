# TEST-PLAN — EPIC-003: Hoàn thiện EPIC-002

**Epic:** EPIC-003
**Author:** QA
**Status:** Draft v1
**Last updated:** 2026-06-13
**Source PRD:** `docs/epics/EPIC-003/artifacts/PRD.md`
**Source design:** `docs/epics/EPIC-003/artifacts/TECH-DESIGN.md`

> **Note**: EPIC-003 closes the gap left by EPIC-002. This plan covers:
> 1. **All remaining ACs from EPIC-002** that were BLOCKED-IMPL before EPIC-003.
> 2. **New ACs from EPIC-003** (EPIC-003-AC01..AC14).
> 3. **Regression check** that EPIC-002 functionality already working still works after EPIC-003.

---

## 1. Test scope

### In scope
- All AC EPIC-002 (M + S priorities) — re-verify after EPIC-003 lands.
- All AC EPIC-003 (M + S priorities).
- Three must-pass **security gates**: EPIC-002-AC19 (Redis-down fail-secure), AC20 (X-Role bypass), AC37 (audit append-only).
- Regression of EPIC-001 search feature (already shipped).

### Out of scope (W priorities + things outside epic)
- EPIC-002-AC45 (SSO/OAuth/2FA) — v2.
- EPIC-002-AC46 (multi-tenant) — out of roadmap.
- EPIC-002-AC47 (realtime websocket permission push) — v2.
- EPIC-003-AC14 (auto-archive audit > 2 years) — v2.
- Performance tuning beyond AC04 target.

---

## 2. Environment / Compatibility matrix

| Surface | Must-test | Spot-check | CI vs real |
|---|---|---|---|
| **Backend runtime** | .NET 8.0 on linux/amd64 (docker image) | .NET 8 macOS arm64 dev | CI: linux container; real: same |
| **Database** | Postgres 16-alpine | Postgres 17 (newest, for forward-compat) | Real container in CI |
| **Cache** | Redis 7-alpine | — | Real container in CI |
| **Web frontend** | Chrome ≥ 100 + Edge ≥ 100 | Safari ≥ 15, Firefox ≥ 100 | Playwright headless in CI |
| **Viewport** | 1280px (desktop) + 414px (mobile) | 1920px | Playwright matrix |
| **Locale** | vi-VN | en-US (smoke only — no i18n in v1) | Manual |
| **Clock** | UTC + Asia/Ho_Chi_Minh (+07:00) | DST jump (N/A — VN has no DST) | Inject IClock in unit tests |

CI runs the **must-test** column. Spot-check column = quarterly manual sweep + release-candidate checklist.

---

## 3. Test scope by AC (traceability)

Each AC must have at least one test. Security gates must have UT + IT + SEC test (defense in depth).

| AC | Type(s) | Test ID(s) | Notes |
|---|---|---|---|
| **EPIC-002 carry-over (BLOCKED-IMPL → must now READY)** | | | |
| EPIC-002-AC03 concurrent write no data loss | IT, CC | EPIC-003-IT-PG-CONCURRENT | k6 / hey 50 parallel POST /api/products |
| EPIC-002-AC04 p95 ≤ 300ms with 10k rows | PF | EPIC-003-PF-INVENTORY-10K | Seed 10k, k6 100req, p95 measured |
| EPIC-002-AC05 409 on duplicate SKU | UT, IT | EPIC-003-UT-409, EPIC-003-IT-DUP-SKU | Catch `PostgresException 23505` wrap |
| EPIC-002-AC09 API retry waiting for Postgres | IT, LC | EPIC-003-LC-PG-WAIT | Start API before Postgres; verify log "waiting" and recovery |
| EPIC-002-AC12 row-level migration tolerance | UT | EPIC-003-UT-XLSX-SKIP-BAD-ROW | Inject xlsx with 1 bad row |
| EPIC-002-AC13 CLI migrate command | IT | EPIC-003-IT-CLI-MIGRATE | DEFERRED if S5 not done |
| EPIC-002-AC16 lockout 5 fails in 5min | UT, IT, SEC | EPIC-003-UT-THROTTLE-LOCKS-5TH, EPIC-003-IT-LOGIN-LOCKED, EPIC-003-SEC-BRUTE-FORCE | |
| EPIC-002-AC17 logout invalidates session | UT, IT | EPIC-003-UT-SESSION-REVOKE, EPIC-003-IT-LOGOUT-REPLAYED | |
| EPIC-002-AC18 missing session → 401 | UT, IT | EPIC-003-UT-MIDDLEWARE-MISSING-401, EPIC-003-IT-MIDDLEWARE-401 | |
| **EPIC-002-AC19 Redis down → 503, NOT bypass — SECURITY GATE** | UT, IT, SEC | EPIC-003-UT-MIDDLEWARE-REDIS-DOWN, EPIC-003-IT-REDIS-DOWN, EPIC-003-SEC-REDIS-DOWN-NO-BYPASS | Triple-coverage |
| **EPIC-002-AC20 X-Role bypass impossible — SECURITY GATE** | SEC, IT | EPIC-003-SEC-XROLE-IGNORED, EPIC-003-IT-XROLE-NO-EFFECT | grep + runtime |
| EPIC-002-AC21 perm-denial 403 | UT, IT, PM | EPIC-003-PM-INV-UPDATE-DENIED | DEFERRED to S4 |
| EPIC-002-AC22 admin creates user | IT | EPIC-003-IT-ADMIN-CREATE-USER | DEFERRED to S3 |
| EPIC-002-AC23 dup username 400 | UT, IT | EPIC-003-UT-USER-DUP, EPIC-003-IT-USER-DUP | DEFERRED to S3 |
| EPIC-002-AC24 soft delete user | IT | EPIC-003-IT-USER-SOFT-DELETE | DEFERRED to S3 |
| EPIC-002-AC25 self-delete 400 | UT, IT | EPIC-003-IT-SELF-DELETE | DEFERRED to S3 |
| EPIC-002-AC26 last-admin 400 | UT, IT | EPIC-003-IT-LAST-ADMIN | DEFERRED to S3 |
| EPIC-002-AC27 permissions matrix + ≤ 30s propagation | IT, UI | EPIC-003-IT-PERMS-UPDATE, EPIC-003-PF-PERM-CACHE-TTL | DEFERRED to S3+S4 |
| EPIC-002-AC28 reset password by admin | IT | EPIC-003-IT-RESET-PW | DEFERRED to S3 |
| EPIC-002-AC29 force change first login | UI | EPIC-003-UI-FORCE-CHANGE | Already DONE per implement summary; smoke regression |
| EPIC-002-AC30 logout-all devices | IT, UT | EPIC-003-UT-REVOKE-ALL, EPIC-003-IT-LOGOUT-ALL | S1 ready (`SessionStore.RevokeAllForUserAsync`); endpoint is S3 |
| EPIC-002-AC31 every write audited | UT, IT | EPIC-003-UT-AUDIT-WRITE, EPIC-003-IT-AUDIT-COVERAGE | |
| EPIC-002-AC32 login lifecycle audited | UT, IT | EPIC-003-IT-AUDIT-LOGIN-LIFECYCLE | |
| EPIC-002-AC33 admin views audit list | IT, UI | EPIC-003-IT-AUDIT-LIST | DEFERRED to S4 |
| EPIC-002-AC34 > 10k filter → truncated | IT | EPIC-003-IT-AUDIT-TRUNCATED | DEFERRED to S4 |
| EPIC-002-AC35 non-admin 403 audit | IT, PM | EPIC-003-IT-AUDIT-NON-ADMIN | DEFERRED to S4 |
| EPIC-002-AC36 audit survives user deletion | IT | EPIC-003-IT-AUDIT-SNAPSHOT | DEFERRED to S3 |
| **EPIC-002-AC37 audit append-only at DB level — SECURITY GATE** | SEC, IT | EPIC-003-SEC-AUDIT-APPEND-ONLY, EPIC-003-IT-AUDIT-REVOKE-UPDATE | Run as `inventory_app` role |
| EPIC-002-AC41 colorblind palette chart | UI, A11Y | EPIC-003-A11Y-CHART-PALETTE | DEFERRED — no chart in v1 |
| EPIC-002-AC42 logout invalidates all tabs | IT | EPIC-003-IT-LOGOUT-ALL-TABS | |
| EPIC-002-AC43 export Excel from Postgres | IT | EPIC-003-IT-EXPORT-FROM-PG | |
| EPIC-002-AC44 import Excel into Postgres | IT | EPIC-003-IT-IMPORT-TO-PG | Existing; verify still working |
| **EPIC-003 new** | | | |
| EPIC-003-AC01 full EPIC-002 test script ≥ 95% PASS on EPIC-003 build | UAT | EPIC-003-UAT-EPIC-002-RERUN | Run TEST-SCRIPT EPIC-002 on staging |
| EPIC-003-AC02 TECH-DESIGN.md exists + maps each gap | DOC | (manual review) | Reviewed at design phase |
| EPIC-003-AC03 API retry Postgres slow start | IT, LC | EPIC-003-LC-PG-RETRY | S5 |
| EPIC-003-AC04 API retry Redis slow start | IT, LC | EPIC-003-LC-REDIS-RETRY | Partial done (ConfigurationOptions ConnectRetry=5) |
| EPIC-003-AC05 verbose /api/health | IT | EPIC-003-IT-HEALTH-VERBOSE | DONE in S5 partial |
| EPIC-003-AC06 CORS allow-list | IT, SEC | EPIC-003-SEC-CORS-DENY-WILDCARD | DONE in S5 partial |
| EPIC-003-AC07 every write endpoint calls AuditLogger | UT (lint-like grep) | EPIC-003-UT-AUDIT-COVERAGE-GREP | Grep test in CI: `\.MapPost\|\.MapDelete\|\.MapPut` not `/api/health\|/api/auth/login` must have `audit.LogAsync` in body |
| EPIC-003-AC08 ≥ 90% AC EPIC-002 PASS | UAT | EPIC-003-UAT-EPIC-002-RERUN | Same as AC01 |
| EPIC-003-AC09 audit page < 1s load 50 rows | PF, UI | EPIC-003-PF-AUDIT-PAGE-LOAD | DEFERRED to S4 |
| EPIC-003-AC10 no magic-string audit actions | UT (static check) | EPIC-003-UT-NO-MAGIC-STRINGS | Grep test: only `AuditActions.*` constants used |
| EPIC-003-AC11 regression R1–R10 pass | RG | EPIC-003-RG-EPIC-002 | See §10 |
| EPIC-003-AC12 no inter-slice regression | RG | EPIC-003-RG-SLICE-MATRIX | Each slice smoke runs prior slices' tests |
| EPIC-003-AC13 active session count badge | UI | EPIC-003-UI-SESSION-COUNT | DEFERRED to S3 |

**Coverage check:** every M+S AC has ≥ 1 test. 3 security gates each have ≥ 3 different test types (UT + IT + SEC).

---

## 4. Unit Tests (`EPIC-003-UT-*`)

Framework: xUnit 2.x + FluentAssertions + Moq (or NSubstitute). Project to create: `server/Server.Tests/`.

Each unit test must be deterministic: inject `IClock`, no network, no real Postgres, no real Redis (use `Microsoft.Extensions.Caching.StackExchangeRedis` test harness or fake `IConnectionMultiplexer`).

### SessionStore

| Test ID | Scenario |
|---|---|
| EPIC-003-UT-SESSION-CREATE | `CreateAsync(jti, userId, role, ttl)` → both `session:<jti>` and `session:user:<id>:<jti>` set in fake Redis with the same TTL |
| EPIC-003-UT-SESSION-EXISTS | After `CreateAsync`, `ExistsAsync(jti)` returns true |
| EPIC-003-UT-SESSION-NOT-EXISTS | Fresh fake Redis, `ExistsAsync("nope")` returns false |
| EPIC-003-UT-SESSION-REVOKE | `RevokeAsync(jti, userId)` deletes both keys; `ExistsAsync` returns false |
| EPIC-003-UT-SESSION-REVOKE-ALL | Insert 3 sessions for user `42` + 1 for user `99`; `RevokeAllForUserAsync(42)` returns 3 and deletes only user 42 sessions; user 99 untouched |
| EPIC-003-UT-SESSION-COUNT-ACTIVE | 4 active sessions for user; `CountActiveAsync(id)` returns 4 |
| EPIC-003-UT-SESSION-USES-SCAN-NOT-KEYS | Inspect `SessionStore.RevokeAllForUserAsync` source: no `IDatabase.KeyDelete(pattern)` or `Server.Keys(pattern: ...)` w/ blocking — must use `KeysAsync` |

### LoginThrottle

| Test ID | Scenario |
|---|---|
| EPIC-003-UT-THROTTLE-IP-FIRST | First request for new IP: `INCR` to 1, `EXPIRE` 60s, returns `Allowed=true` |
| EPIC-003-UT-THROTTLE-IP-LIMIT | 11th request from same IP within window: `Allowed=false`, `RetryAfterSeconds > 0` and ≤ 60 |
| EPIC-003-UT-THROTTLE-USER-LIMIT | 6th request for same username within window: `Allowed=false` |
| EPIC-003-UT-THROTTLE-DIFFERENT-IPS | 10 requests from IP A allowed; one more from IP B allowed (per-IP counters independent) |
| EPIC-003-UT-THROTTLE-GETLOCKOUT-NULL | User with `LockedUntil=null` → `GetLockoutAsync` returns null |
| EPIC-003-UT-THROTTLE-GETLOCKOUT-PAST | User with `LockedUntil` < `clock.UtcNow` → returns null (lock expired) |
| EPIC-003-UT-THROTTLE-GETLOCKOUT-ACTIVE | User with `LockedUntil` > `clock.UtcNow` → returns that datetime |
| EPIC-003-UT-THROTTLE-LOCKS-5TH | `RegisterFailureAsync` on user with `FailedLoginAttempts=4` → DB updated with attempts=5 + locked_until=now+15min; Redis key `login:lock:<id>` set |
| EPIC-003-UT-THROTTLE-NOT-LOCK-4TH | `RegisterFailureAsync` on user with `FailedLoginAttempts=3` → DB updated to 4, `locked_until=NULL`, no Redis key |
| EPIC-003-UT-THROTTLE-RESET | `ResetFailureAsync(id)` clears DB counter + Redis lock key |
| EPIC-003-UT-THROTTLE-CLOCK-INJECTED | Inject fake clock at `2026-06-13T10:00:00Z`; `LockedUntil` computed = `2026-06-13T10:15:00Z` exactly |

### AuthService

| Test ID | Scenario |
|---|---|
| EPIC-003-UT-TOKEN-HAS-JTI | `IssueToken(user)` returns `IssuedToken` whose `Token` decodes to a JWT containing `jti` claim == `IssuedToken.Jti` |
| EPIC-003-UT-TOKEN-JTI-UNIQUE | 2 successive `IssueToken` for same user → different `Jti` values |
| EPIC-003-UT-TOKEN-TTL | `IssuedToken.Ttl == TimeSpan.FromHours(_expiryHours)` |
| EPIC-003-UT-PASSWORD-BCRYPT-VERIFY | `HashPassword("foo")` produces hash for which `VerifyPassword("foo", hash) == true` and `VerifyPassword("foox", hash) == false` |

### AuditLogger

| Test ID | Scenario |
|---|---|
| EPIC-003-UT-AUDIT-WRITE-OK | `LogAsync(...)` inserts row with all fields populated correctly; `before_json` and `after_json` are valid JSON strings cast to jsonb |
| EPIC-003-UT-AUDIT-WRITE-NULL-BEFORE | Create event with `before=null` → `before_json` column is SQL NULL, not literal `"null"` |
| EPIC-003-UT-AUDIT-WRITE-DB-ERROR-SWALLOWED | Mock DB throws on INSERT → `LogAsync` does not throw; `ILogger.LogError` was called once |
| EPIC-003-UT-AUDIT-SERIALIZES-CAMELCASE | Pass object `{ MaSku = "X" }` → `after_json` contains `"maSku"` key |

### SessionValidationMiddleware

| Test ID | Scenario |
|---|---|
| EPIC-003-UT-MIDDLEWARE-PASSTHROUGH-ANON | Anonymous request (no auth scheme): middleware calls next, status NOT modified |
| EPIC-003-UT-MIDDLEWARE-MISSING-JTI | Authenticated but no `jti` claim → 401 with `code:"missing_jti"` |
| EPIC-003-UT-MIDDLEWARE-MISSING-SESSION-401 | `ExistsAsync` returns false → 401 with `code:"session_revoked"`; body is JSON |
| EPIC-003-UT-MIDDLEWARE-VALID-PASSES | `ExistsAsync` returns true → calls `next`, status not modified |
| EPIC-003-UT-MIDDLEWARE-REDIS-EXCEPTION-503 | `ExistsAsync` throws `RedisException` → 503 with `code:"auth_unavailable"`. **NOT 200.** |
| EPIC-003-UT-MIDDLEWARE-UNEXPECTED-EXCEPTION-503 | Any other exception in `ExistsAsync` → 503 (fail-secure) |
| EPIC-003-UT-MIDDLEWARE-KILL-SWITCH | Env `DISABLE_REDIS_SESSION_CHECK=true` → middleware calls next without calling `ExistsAsync`; `ILogger.LogWarning` called |

### Static / lint-like

| Test ID | Scenario |
|---|---|
| EPIC-003-UT-NO-MAGIC-STRINGS | Roslyn analyzer or grep: in `Program.cs`, every `audit.LogAsync(...)` first arg is a `AuditActions.*` constant reference, not a string literal |
| EPIC-003-UT-AUDIT-COVERAGE-GREP | grep — every `app.MapPost\|app.MapPut\|app.MapDelete` line in `Program.cs` (except `/api/health`) has a `audit.LogAsync` call within its lambda body |
| EPIC-003-UT-NO-X-ROLE | grep `Request\.Headers\["X-Role"\]\|Request\.Headers\["X-Username"\]` — must return 0 matches (AC20 enforcement) |

### Frontend

| Test ID | Scenario |
|---|---|
| EPIC-003-UT-FE-LOGOUT-CALLS-API | Vitest + MSW: `apiLogout()` POSTs to `/api/auth/logout` with bearer token from storage |
| EPIC-003-UT-FE-LOGOUT-SWALLOWS-NETWORK-ERR | `apiLogout()` resolves to undefined even when fetch rejects (network down) |
| EPIC-003-UT-FE-APP-LOGOUT-CLEARS-TOKEN | RTL: clicking "Đăng xuất" → `localStorage.getItem('auth_token')` returns null afterward |

---

## 5. Contract Tests (`EPIC-003-CT-*`)

The API contract is shared with the FE. Capture in OpenAPI-like form for FE/QA reference; assert shape per endpoint.

| Test ID | Endpoint | Asserts |
|---|---|---|
| EPIC-003-CT-LOGIN-200 | POST /api/auth/login (valid) | Body: `{token, username, role, fullName, mustChangePassword, expiresInSeconds}`. `expiresInSeconds` int > 0 |
| EPIC-003-CT-LOGIN-401 | POST /api/auth/login (bad pw) | Body: `{error: string}`; status 401 |
| EPIC-003-CT-LOGIN-423 | POST /api/auth/login (locked) | Body: `{error, code:"account_locked", lockedUntil:ISO}`; status 423 |
| EPIC-003-CT-LOGIN-429 | POST /api/auth/login (rate-limited) | Header `Retry-After` present (int seconds); body `{error, code:"rate_limited"}`; status 429 |
| EPIC-003-CT-LOGOUT-204 | POST /api/auth/logout | Status 204; empty body |
| EPIC-003-CT-LOGOUT-401 | POST /api/auth/logout (no token) | Status 401 |
| EPIC-003-CT-ME-200 | GET /api/auth/me | Body: `{id, username, fullName, role, mustChangePassword}` |
| EPIC-003-CT-HEALTH-200 | GET /api/health (all up) | Body: `{api:"ok", postgres:"ok", redis:"ok", time:ISO}`; status 200 |
| EPIC-003-CT-HEALTH-503-PG | GET /api/health (PG stopped) | Body: `{api:"ok", postgres:"down", redis:"ok", ...}`; status 503 |
| EPIC-003-CT-HEALTH-503-REDIS | GET /api/health (Redis stopped) | Body: `{... postgres:"ok", redis:"down" ...}`; status 503 |
| EPIC-003-CT-PROTECTED-401-REVOKED | GET /api/inventory after logout | Status 401; body `{error, code:"session_revoked"}` |
| EPIC-003-CT-PROTECTED-503-REDIS-DOWN | GET /api/inventory while Redis down | Status 503; body `{error, code:"auth_unavailable"}` |

---

## 6. Integration Tests (`EPIC-003-IT-*`)

Framework: xUnit + `WebApplicationFactory<Program>` + Testcontainers (`Testcontainers.PostgreSql`, `Testcontainers.Redis`). Each test class starts a clean container + applies `001_schema.sql` and (where relevant) `002_epic003_grants.sql`.

| Test ID | Scenario | Slice gate |
|---|---|---|
| EPIC-003-IT-LOGIN-OK | POST /login valid → 200, token, Redis key created | S1 |
| EPIC-003-IT-LOGIN-WRONG-PW | POST /login wrong pw → 401; `users.failed_login_attempts` += 1; audit row `login.failed` | S1+S2 |
| EPIC-003-IT-LOGIN-NO-ENUMERATION | POST /login unknown user vs known user with wrong pw return same body + 401 (no leak) | S1 |
| EPIC-003-IT-LOGIN-LOCKED | Pre-set `locked_until > NOW`; login → 423 with `lockedUntil` body | S1 |
| EPIC-003-IT-LOGIN-LOCKS-ON-5TH | 5 wrong-pw POSTs → 6th returns 423; `users.locked_until` set; audit `login.locked` | S1+S2 |
| EPIC-003-IT-LOGIN-RESETS-COUNTER | After lockout expires + correct pw → success; `users.failed_login_attempts=0` | S1 |
| EPIC-003-IT-LOGIN-RATELIMIT-IP | 11 logins from same IP within 60s → 11th = 429 with `Retry-After` | S1 |
| EPIC-003-IT-LOGIN-RATELIMIT-USER | 6 logins same username (different IPs) → 6th = 429 | S1 |
| EPIC-003-IT-LOGOUT-INVALIDATES | login → POST /logout 204 → GET /me 401 | S1 |
| EPIC-003-IT-LOGOUT-MULTIPLE-TABS | Login produces 1 jti; logout (single tab) revokes that jti; same token in other tab also gets 401 | S1 |
| EPIC-003-IT-LOGOUT-ALL-DEVICES | 2 logins (2 jtis); call `SessionStore.RevokeAllForUserAsync` directly; both tokens get 401 | S1 |
| EPIC-003-IT-MIDDLEWARE-401 | Manually `KeyDelete session:<jti>` while session "active"; next request → 401 within 2s | S1 |
| EPIC-003-IT-REDIS-DOWN | Stop Redis container; GET /api/inventory → 503; restart Redis → 200 again | S1 |
| EPIC-003-IT-REDIS-DOWN-NO-BYPASS | Stop Redis; GET /api/admin/* (any) → 503; body NOT contain `products`/sensitive payload | S1 |
| EPIC-003-IT-PG-CONCURRENT | 50 parallel POST /api/products with unique SKUs → all 200; DB count = 50 | S5 |
| EPIC-003-IT-DUP-SKU | POST product with existing SKU → 409 not 500 | S5 |
| EPIC-003-IT-AUDIT-COVERAGE | After login, import, replace, delete, transaction, change-pw, logout — audit_logs has exactly 7 rows with correct action constants and non-null `at` | S2 |
| EPIC-003-IT-AUDIT-LOGIN-LIFECYCLE | Trigger login.failed×5 + login.locked + login.success + logout — 8 rows with correct actions | S2 |
| EPIC-003-IT-AUDIT-WRITE-FAILS-DOESNT-BREAK-AUTH | Inject DB exception in AuditLogger; login still returns 200; metric increment observed | S2 |
| EPIC-003-IT-AUDIT-REVOKE-UPDATE | Connect to PG as `inventory_app` role; attempt UPDATE audit_logs → permission denied | S5 |
| EPIC-003-IT-AUDIT-REVOKE-DELETE | Same role; DELETE FROM audit_logs → permission denied | S5 |
| EPIC-003-IT-HEALTH-VERBOSE | GET /api/health → JSON has api/postgres/redis/time | S5 |
| EPIC-003-IT-HEALTH-PG-DOWN-503 | Stop PG; GET /api/health → 503; body postgres:"down" | S5 |
| EPIC-003-IT-XROLE-NO-EFFECT | curl with `X-Role: admin` header + NO bearer → 401 | All |
| EPIC-003-IT-XROLE-USER-CANT-ESCALATE | Login as user; call /api/admin/* with `X-Role: admin` header added → 401 or 403; never 200 | S3 (when admin endpoints exist) |
| EPIC-003-IT-EXPORT-FROM-PG | Login admin; GET inventory; check products served from DB (not file) | S5 |
| EPIC-003-IT-IMPORT-TO-PG | POST /inventory/import with xlsx; verify `products` row count matches xlsx | DONE |
| EPIC-003-IT-XLSX-SKIP-BAD-ROW | Migration with malformed xlsx skips bad rows, logs warning, continues | S5 |
| EPIC-003-IT-PG-WAIT | Compose: start API before Postgres healthy; API logs "waiting"; once PG up, /api/health green | S5 |
| EPIC-003-IT-EPIC-001-SEARCH-REGRESSION | Use EPIC-001 search on /inventory page still works (FE only) | All |

---

## 7. UI / Component Tests (`EPIC-003-UI-*`)

Framework: Vitest + @testing-library/react + MSW (for API mocking). Where DOM behavior depends on layout, switch to Playwright.

| Test ID | Scenario |
|---|---|
| EPIC-003-UI-LOGIN-PAGE-RENDERS | `<LoginPage onLogin={fn}>` renders username + password input + button + label-association |
| EPIC-003-UI-LOGIN-SUBMIT-CALLS-API | User types username/pw + clicks button → `login()` fetch called with right body |
| EPIC-003-UI-LOGIN-SHOWS-ERROR-401 | MSW returns 401 → user sees toast "Sai username hoặc password"; button re-enabled |
| EPIC-003-UI-LOGIN-SHOWS-LOCKED-423 | MSW returns 423 → user sees "Tài khoản bị tạm khoá. Thử lại sau 15 phút." |
| EPIC-003-UI-LOGIN-SHOWS-RATELIMITED-429 | MSW returns 429 → user sees "Quá nhiều lần thử. Vui lòng thử lại sau." |
| EPIC-003-UI-LOGOUT-CLEARS-LOCAL | Click "Đăng xuất" → `localStorage.auth_token` removed; LoginPage renders again |
| EPIC-003-UI-CHANGE-PW-FORCED | Mount App with `me.mustChangePassword=true` → ChangePasswordDialog visible AND non-closable |
| EPIC-003-UI-CHANGE-PW-SUCCESS | Submit valid new pw → dialog closes; mustChangePassword=false |
| EPIC-003-UI-SIDEBAR-FIXED-DESKTOP | Render at 1280px viewport; scroll main; sidebar `getBoundingClientRect().top` unchanged (regression EPIC-002-AC38) |
| EPIC-003-UI-DASHBOARD-COLORED | Dashboard renders 4 KPI cards each with distinct background-color CSS computed value (regression EPIC-002-AC40) |
| EPIC-003-UI-ADMIN-USERS-PAGE | DEFERRED to S3 |
| EPIC-003-UI-AUDIT-PAGE | DEFERRED to S4 |

---

## 8. Security Tests (`EPIC-003-SEC-*`)

Independent SEC tests beyond IT — these stress the security boundary directly.

| Test ID | Scenario | Linked AC |
|---|---|---|
| EPIC-003-SEC-XROLE-IGNORED | grep + runtime: send `X-Role: admin` with no Bearer → 401. With user Bearer → 403/401 on admin endpoint. With admin Bearer → 200. Header has zero contribution to outcome | AC20 (gate) |
| EPIC-003-SEC-AUDIT-APPEND-ONLY | psql as `inventory_app`: `UPDATE audit_logs SET action='x';` → permission denied. `DELETE FROM audit_logs;` → permission denied. `INSERT INTO audit_logs (...)` → allowed | AC37 (gate) |
| EPIC-003-SEC-REDIS-DOWN-NO-BYPASS | Stop Redis; brute-force script tries to access protected endpoints with stolen JWT → 100% 503, 0% 200/2xx | AC19 (gate) |
| EPIC-003-SEC-BRUTE-FORCE | k6: 1000 login attempts/min with random passwords from 1 IP → rate-limited within 11 requests; lockout within 5 fails on same username | AC16 |
| EPIC-003-SEC-SQL-INJECTION-LOGIN | POST /login with username `' OR 1=1; --` → no SQL error, 401 with normal body | AC15 |
| EPIC-003-SEC-SQL-INJECTION-AUDIT-QUERY | GET /api/admin/audit?actor=' OR 1=1-- → 200 with 0 results (literal string), no SQL leak | DEFERRED to S4 |
| EPIC-003-SEC-JWT-SECRET-NOT-LOGGED | Trigger error in login; verify logs do NOT contain `JWT_SECRET` env value or partial secret | AC NFR |
| EPIC-003-SEC-PASSWORD-NOT-IN-AUDIT | Audit row for `password.reset` / `password.change` — neither `before_json` nor `after_json` contains plaintext password | NFR |
| EPIC-003-SEC-CORS-DENY-WILDCARD | OPTIONS preflight from origin not in `ALLOWED_ORIGINS` → no `Access-Control-Allow-Origin` header returned | AC06 |
| EPIC-003-SEC-CORS-NO-STAR | Inspect response headers on any request: `Access-Control-Allow-Origin` never `*`, always specific origin or absent | AC06 |
| EPIC-003-SEC-NO-SECRETS-IN-LOGS | Grep last 1k log lines for: `Password`, `password_hash`, `JWT_SECRET`, `Authorization: Bearer` (full token) — 0 matches | NFR |
| EPIC-003-SEC-KILL-SWITCH-WARNS | Set `DISABLE_REDIS_SESSION_CHECK=true`, hit any protected endpoint, check API logs contain warning every ≤ 10s | tech-design §10.2 |

---

## 9. Performance Tests (`EPIC-003-PF-*`)

Framework: `k6`. Run in CI on a fixed-size container.

| Test ID | Scenario | Threshold |
|---|---|---|
| EPIC-003-PF-LOGIN-P95 | 100 concurrent logins (different users) | p95 ≤ 500ms |
| EPIC-003-PF-INVENTORY-10K | Seed 10k products; 100 GET /api/inventory | p95 ≤ 300ms (AC04) |
| EPIC-003-PF-AUTH-MIDDLEWARE-OVERHEAD | Compare /api/health (no auth) vs /api/inventory (auth) latency on no-op load | Delta ≤ 8ms p99 |
| EPIC-003-PF-PERM-CACHE-TTL | Repeated /api/inventory: 1st call DB hit (`perms:user:<id>` set), 2nd–30th calls within 30s = Redis hit only (no `user_permissions` SELECT) | Verified via metrics; cache hit ratio ≥ 90% within 30s window |
| EPIC-003-PF-AUDIT-PAGE-LOAD | 100k audit rows; GET /api/admin/audit?limit=50 | p95 ≤ 800ms (AC09) |
| EPIC-003-PF-AUDIT-WRITE-P99 | Concurrent writes triggering audit insert | p99 ≤ 5ms overhead |

---

## 10. Regression Checklist (run pre-merge each slice)

Must pass after every slice merge. Goal: EPIC-003-AC12 — no slice breaks the previous.

| # | Action | Expected | Coverage |
|---|---|---|---|
| R1 | `docker compose up -d`; all 4 services healthy in ≤ 60s | All `(healthy)` | EPIC-002-AC06 |
| R2 | `cat .gitignore`; run `git status` after creating `data/postgres/` and `.env` | Neither tracked | EPIC-002-AC07 |
| R3 | Login as admin via FE → reach dashboard | OK + 4 colored KPI cards | EPIC-002-AC14, AC40 |
| R4 | Scroll inventory page; sidebar fixed on lg+ | OK | EPIC-002-AC38 |
| R5 | Import inventory.xlsx file with 500 rows | Toast "Đã import 500", products visible | EPIC-002-AC44 |
| R6 | Quick search by SKU still works | OK | EPIC-001 regression |
| R7 | Add a transaction (import) → success | OK; product `tonKho` increased | Existing |
| R8 | Click "Đăng xuất" | Redirect login; next API call w/ old token → 401 | EPIC-002-AC17, AC42 |
| R9 | Refresh page on inventory route | Asks login (no client routing yet) | Pre-existing limitation |
| R10 | Hit `/api/health` from terminal | 200 `{api,postgres,redis,time}` | EPIC-003-AC05 |
| R11 | (S2+) Make any write action; query `audit_logs` | At least 1 row inserted | EPIC-002-AC31 |
| R12 | (S5+) `psql -U inventory_app -c "UPDATE audit_logs SET action='x'"` | Permission denied | EPIC-002-AC37 |

---

## 11. Test Data Strategy

- **Factories**: `server/Server.Tests/Factories/` with `UserFactory.Create(username, role)`, `ProductFactory.Create(maSku)`, `TransactionFactory.Create(...)`. Default sane values; override per test.
- **Postgres isolation**: each test class gets a fresh Testcontainers Postgres instance (≈ 2s startup, acceptable). Within a class, transactions roll back each test.
- **Redis isolation**: each test class gets fresh Testcontainers Redis. Within a class, `FlushDb` between tests.
- **Time injection**: every test that asserts on time uses `Mock<IClock>` returning a fixed `2026-01-01T00:00:00Z`.
- **Random seed**: any code using `Random` must accept `int? seed`. Tests pass `42`.
- **FE fixtures**: `src/test/fixtures.ts` exports a `makeUser()`, `makeProduct()` builder.
- **Audit fixtures for AuditPage test (S4)**: SQL seed file `server/Server.Tests/seeds/audit_50.sql` inserts 50 rows with distinct actions.

---

## 12. Flaky-Test Policy

- **No `Thread.Sleep` / `setTimeout` for synchronization** — use `await Task.Delay` + `until` polling on observable state.
- **No real network in unit tests** — only Testcontainers in integration tests.
- **Each test owns its data** — no shared DB rows between tests in a class.
- **No order dependencies** — every test must pass when run in isolation (`dotnet test --filter FullyQualifiedName~XYZ`).
- **Quarantine, don't retry** — if a test fails intermittently 2x in 1 week, move to `Quarantine.cs` category and create a ticket. Do NOT add `[Retry]`.
- **Clock injection mandatory** for any test asserting time arithmetic or expiry.

---

## 13. Coverage Targets

Per `CLAUDE.md` TRUST 5 framework: 85% coverage floor. EPIC-003 specific targets:

| Module | Target | Justification |
|---|---|---|
| `SessionStore.cs` | ≥ 90% | Security-critical; every branch tested |
| `LoginThrottle.cs` | ≥ 90% | Security-critical; rate-limit + lockout fully tested |
| `SessionValidationMiddleware.cs` | ≥ 95% | The crux of AC18/AC19; one failure mode = catastrophe |
| `AuditLogger.cs` | ≥ 85% | Failure paths matter; happy paths trivial |
| `AuthService.cs` | ≥ 80% | Token issuance + password ops |
| `Program.cs` (endpoint logic) | ≥ 70% | Tested mostly via IT, less via UT |
| FE `App.tsx`, `api.ts` | ≥ 70% | Component logic |

Whole-project coverage report: `dotnet test --collect:"XPlat Code Coverage"` → `coverlet` HTML report. FE: `vitest run --coverage` → V8 reporter.

---

## 14. Risk-based prioritization

Sorted by impact × likelihood (after Slice S1+S2 ship — current state):

1. **High**: Redis-down bypass (AC19) — must have UT + IT + SEC coverage before any prod traffic.
2. **High**: X-Role bypass (AC20) — grep-level test must run in CI to prevent regression.
3. **High**: Audit append-only (AC37) — needs the `002_epic003_grants.sql` migration applied AND runtime connection switched. Until both done, AC37 NOT enforced.
4. **Medium**: Lockout (AC16) — DB column already exists; logic in `LoginThrottle`; needs IT coverage.
5. **Medium**: Audit coverage (AC31) — grep test in CI to prevent future endpoints from forgetting `audit.LogAsync`.
6. **Low**: Performance ACs (AC04, AC09) — measure once, monitor in production.

---

## 15. Handoff

This test plan is the **execution contract** for QA. Developer must:
- Create xUnit project `server/Server.Tests/`.
- Implement tests under prefixes specified in §3.
- Wire CI to fail on any test in §10 regression or any §8 security gate.

QA (next round in pipeline) will:
- Run this plan against the staging build.
- Update statuses to PASS/FAIL/BLOCKED in a fresh TEST-EXECUTION-RESULTS.md.
- Hand off to release manager.
