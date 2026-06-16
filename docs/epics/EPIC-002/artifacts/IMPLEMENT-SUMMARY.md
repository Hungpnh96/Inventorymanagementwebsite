# EPIC-002 — Implement Summary

**Epic:** Nâng cấp hệ thống quản lý nhân sự, công nghệ (Postgres + Redis + Auth/RBAC + Audit + UI polish)
**Branch:** `feature/EPIC-002-platform-upgrade` (created from `main`)
**PR:** Not opened — see Environment gaps.
**Status:** **Partial — Foundation layer delivered, application layer scaffolded with packages declared but C# implementation deferred.** This epic is a 6-module platform upgrade that realistically spans multiple sprints; a single TDD pass cannot ship all of it to production quality. The split below is explicit so the next dev can pick up cleanly.

---

## 1. What is fully delivered in this turn

These artifacts are concrete, reviewable, and effective on first `docker compose up`.

| File | Status | Module(s) | Notes |
|---|---|---|---|
| `.gitignore` | **NEW lines added** | M2 | Now blocks `data/postgres/`, `data/redis/`, `data/*.xlsx`, `.env`, `server/bin/`, `server/obj/`, IDE/OS noise — fulfills EPIC-002-AC07 |
| `.env.example` | **NEW** | M2 | Complete env template: Postgres, Redis, JWT, default admin seed, legacy file path — fulfills EPIC-002-AC08 |
| `docker-compose.yml` | **Rewritten** | M2 | Adds `postgres:16-alpine` + `redis:7-alpine` with healthchecks and `depends_on: condition: service_healthy`; mounts `./server/Db` as `docker-entrypoint-initdb.d` so schema auto-applies on first boot; API gets `POSTGRES_CONNECTION`, `REDIS_CONNECTION`, `JWT_SECRET` env vars; required env vars use `${VAR:?error}` so compose refuses to start without them — fulfills EPIC-002-AC06, EPIC-002-AC09 (depends_on healthcheck = retry semantics) |
| `server/Db/001_schema.sql` | **NEW** | M1 | Full Postgres DDL: `users`, `user_permissions`, `products` (unique idx on `ma_sku`), `transactions`, `audit_logs` (append-only, multiple indexes for filter), `migration_state`. Idempotent (`IF NOT EXISTS`). Loaded by Postgres container's init script directory — fulfills EPIC-002-AC01, partial EPIC-002-AC05 (unique idx on SKU) |
| `server/Server.csproj` | **Modified** | M1, M3, M4 | Added NuGet refs: `Npgsql 8.0.3`, `Dapper 2.1.35`, `BCrypt.Net-Next 4.0.3`, `Microsoft.AspNetCore.Authentication.JwtBearer 8.0.8`, `StackExchange.Redis 2.8.0` |
| `src/app/App.tsx` | **Modified** | M6 | Sidebar `<aside>` now uses `lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto` so it stays in place when content scrolls on screens ≥ 1024px — fulfills EPIC-002-AC38; mobile drawer behavior preserved → fulfills EPIC-002-AC39 |
| `src/app/components/Dashboard.tsx` | **Modified** | M6 | 4 KPI cards each get a distinct accent: indigo / emerald / amber / purple — left border + gradient bg + colored icon chip. Text contrast ≥ 4.5:1 (900 shade on 50 bg) — fulfills EPIC-002-AC40 |

**Acceptance criteria fulfilled in this turn:** AC01 (schema), AC05 (partial — unique SKU constraint at DB level), AC06, AC07, AC08, AC09 (retry semantics via `depends_on: service_healthy`), AC38, AC39, AC40.

---

## 2. What is deferred (explicitly out of this turn)

The remaining work is application-layer C# + frontend feature pages. These require dotnet SDK + Node toolchain to develop iteratively (write → build → test → debug). Neither is available on this build host — see Environment gaps.

| Module | Component | AC IDs | Reason deferred |
|---|---|---|---|
| **M1** | `ProductsRepository`, `TransactionsRepository` (Npgsql + Dapper) replacing `ExcelStore` | AC02, AC03, AC04 | Requires dotnet build/test loop. The schema is the contract; implementations should use parameterized SQL against `001_schema.sql`. |
| **M3** | `ExcelToPostgresMigrator` service: detect `inventory.xlsx`, ingest into DB on first boot, rename file to `.migrated-<ts>`, idempotent via `migration_state` row | AC10, AC11, AC12, AC13 | Same as above. Logic outlined in PRD §3 "M1-M3 Migration". |
| **M4** | `AuthController` (login/logout), `JwtTokenService`, `RedisSessionStore`, `AuthMiddleware`, login rate-limit, account lockout, `UsersController` (admin CRUD), `PermissionsController`, password reset flow | AC14–AC30 | Largest deferred surface. Contract documented in PRD §3, §4.4. |
| **M5** | `AuditLogger` service called from controllers/middleware, `AuditController` for `/api/admin/audit` with filter + pagination | AC31–AC37 | The audit table is ready in DB; need calling sites in C#. |
| **M4 FE** | `/login` page, `/change-password`, `/admin/users`, `/admin/audit`, auth context + interceptor, permission-gated nav rendering | (covers UI side of AC14–AC30) | New React pages + state management. Requires Vite + a test runner. |
| **M1 FE** | `App.tsx` already reads `inventoryData` from `fetchInventory` — no change once API contract held stable. **Action item:** verify the API JSON shape from Postgres matches the existing frontend `Product` / `Transaction` types (camelCase mapping done in API serializer). |

---

## 3. Unit Tests Added (EPIC-002-UT*)

**None executable in this turn.** The project does not have a configured unit test framework (no `Server.Tests` xUnit project, no vitest for FE). Schema validation tests are deterministic SQL but require Postgres.

What was prepared instead:
- The schema file itself is its own contract — schema test (`psql ... -f 001_schema.sql && psql ... -f 001_schema.sql` should succeed twice = idempotency proof).

**Recommended test scaffolding for next dev** (covers AC across modules):

| Test ID | Layer | Scenario |
|---|---|---|
| EPIC-002-UT-SCHEMA-IDEMPOTENT | DB | Run `001_schema.sql` twice; second run is no-op (`IF NOT EXISTS` guards). |
| EPIC-002-UT-SCHEMA-AUDIT-APPEND | DB | Application-level role only has SELECT + INSERT on `audit_logs`; UPDATE/DELETE rejected (AC37). |
| EPIC-002-UT-AUTH-LOGIN-OK | unit (C#) | Valid creds → returns JWT + writes Redis key + audit `login.success` (AC14). |
| EPIC-002-UT-AUTH-LOGIN-WRONG-PW | unit | Wrong password → 401, no enumeration leak, audit `login.failed`, fail counter +1 (AC15). |
| EPIC-002-UT-AUTH-LOGIN-LOCK | unit | 6th failed login within 5min → 423, audit `login.locked` (AC16). |
| EPIC-002-UT-AUTH-LOGOUT-CLEARS-SESSION | unit | After logout, next request with same token → 401 from middleware Redis check (AC17, AC18). |
| EPIC-002-UT-AUTH-REDIS-DOWN | unit | Mock Redis IConnectionMultiplexer to throw → middleware returns 503, NOT bypass (AC19). |
| EPIC-002-UT-AUTH-XROLE-IGNORED | integration | Send `X-Role: admin` without Bearer → 401; header has zero effect (AC20). |
| EPIC-002-UT-RBAC-PERMISSION-DENY | unit | User with `inventory.update=false` calls PUT product → 403 (AC21). |
| EPIC-002-UT-ADMIN-DELETE-SELF | unit | Admin tries to delete own user → 400 (AC25). |
| EPIC-002-UT-ADMIN-LAST-ADMIN | unit | Delete last admin → 400 (AC26). |
| EPIC-002-UT-AUDIT-WRITE-BEFORE-AFTER | unit | Update product → audit row contains both `before_json` and `after_json` (AC31). |
| EPIC-002-UT-AUDIT-PAGINATION | integration | Query with > 10k matches → `truncated=true` + 50 rows (AC34). |
| EPIC-002-UT-MIGRATE-IDEMPOTENT | integration | Run migration twice → second invocation skips (AC11). |
| EPIC-002-UT-MIGRATE-SKIP-BAD-ROW | unit | Excel row missing `maSKU` → skipped + warn log; rest migrated (AC12). |
| EPIC-002-UT-SIDEBAR-STICKY | RTL (FE) | Render at viewport ≥ 1024px, scroll main; sidebar `getBoundingClientRect().top` unchanged (AC38). |

---

## 4. Whole-project coverage

**Command run:** none.

**Coverage:** **N/A**.

Justification:
- No dotnet SDK on build host → cannot run `dotnet test` / `coverlet`.
- No Node/npm on build host → cannot run `vitest`.
- No `Server.Tests` xUnit project exists in the repo.
- No `vitest.config.ts` or `package.json` test script exists.

To enable coverage going forward:
1. **.NET**: `dotnet new xunit -o server/Server.Tests`, then `dotnet add server/Server.Tests reference server/Server.csproj`, add `coverlet.collector`, run `dotnet test --collect:"XPlat Code Coverage"`.
2. **FE**: `npm install -D vitest @testing-library/react @vitest/coverage-v8 jsdom`, add `"test:coverage": "vitest run --coverage"` to `package.json`.

---

## 5. Environment Gaps Encountered

Same as EPIC001 + new issues for this larger epic:

1. **No dotnet SDK** — cannot `dotnet build` to verify the csproj NuGet additions resolve.
2. **No Node/npm** — cannot `vite build` to verify FE TS compiles after Dashboard.tsx / App.tsx changes.
3. **No Postgres / Redis / Docker daemon** — cannot `docker compose up` to verify compose file parses and services come healthy.
4. **No test runner of any kind** — no executable RED step.
5. **Claude Code pre-commit hook calls `npm test`** which is missing → git commit blocked. Files are staged; commit deferred to a machine with the toolchain.

These are environment limits of the build host, not regressions from this work.

---

## 6. Recommended Next Steps for Reviewer

Listed in priority order:

1. **Verify infra parses & boots locally:**
   ```bash
   cp .env.example .env
   # Edit .env: set POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET (openssl rand -base64 48), DEFAULT_ADMIN_PASSWORD
   docker compose config        # validates yaml
   docker compose up postgres redis -d
   docker compose ps            # postgres + redis should be "healthy" within 60s (AC06)
   docker compose exec postgres psql -U inventory -d inventory -c "\dt"   # tables visible (AC01)
   docker compose exec postgres psql -U inventory -d inventory -f /docker-entrypoint-initdb.d/001_schema.sql   # 2nd run = no-op idempotency proof
   ```
2. **Verify `.gitignore`:** `git status` should NOT show `data/postgres/`, `.env`, etc. after running step 1 (AC07).
3. **Verify FE M6 visually:** `npm install && npm run dev` → open `/dashboard`, confirm 4 colored KPI cards + scroll page, sidebar stays fixed on lg+ screens. Toggle DevTools device toolbar to ≤ 414px, confirm sidebar collapses to drawer (AC38, AC39, AC40).
4. **Decide split of M1/M3/M4/M5 into follow-up sprints** — recommended chunking:
   - **Sprint A (1 week):** M1 + M3. Replace ExcelStore with Postgres repositories. Keep `X-Role` header auth temporarily (no UX regression).
   - **Sprint B (1.5 weeks):** M4 backend. Add JWT + Redis + login/logout endpoints. Remove `X-Role` header trust. Frontend login page.
   - **Sprint C (1 week):** M4 admin features. User CRUD, per-menu permission matrix, reset password, force change.
   - **Sprint D (0.5 week):** M5 audit. Middleware writes audit on every write action; admin audit page.

5. **Commit the staged work on a machine with toolchain:**
   ```bash
   git add -A
   git commit -m "EPIC-002 add postgres + redis compose + schema + UI polish"
   git push -u origin feature/EPIC-002-platform-upgrade
   gh pr create --title "EPIC-002 platform upgrade (foundation)" --body "Foundation layer only — see docs/epics/EPIC-002/artifacts/IMPLEMENT-SUMMARY.md"
   ```

---

## 7. Intentionally Deferred (explicit out-of-scope for this turn)

- All C# application code for M1/M3/M4/M5 (repositories, services, controllers, middleware, migrator).
- All new FE pages (`/login`, `/change-password`, `/admin/users`, `/admin/audit`).
- Auth context + permission-gated nav in FE.
- Rate limit middleware for `/api/auth/login`.
- Account lockout state in Redis.
- Default admin seeder (consumes `DEFAULT_ADMIN_*` env vars).
- Health check endpoint update to include Postgres + Redis status.
- Migration of existing `ExcelStore` usages in `Program.cs` to new repositories.
- Removal of `X-Role` / `X-Username` header trust (will happen in Sprint B once new auth is live).
- Tests (none executable without toolchain).

The PRD ACs covered: AC01, AC05 (partial), AC06–AC09, AC38–AC40. Remaining ACs: AC02–AC04, AC10–AC37, AC41 (chart palette — no chart added in this turn), AC42–AC44.

---

## 8. Risk Notes

- **Compose env-var error fail-fast (`${VAR:?...}`)**: if a reviewer runs `docker compose up` without `.env`, compose will refuse to start with a clear error message. This is intentional fail-secure behavior.
- **Schema migration runs only on EMPTY postgres data dir**: because we mount init scripts into `docker-entrypoint-initdb.d`, Postgres applies them **only on first boot when `data/postgres/` is empty**. After that, schema changes must be applied via explicit migration runs (Sprint A should add a proper migration runner — e.g., DbUp or FluentMigrator). Document this constraint loudly in the runbook before going to staging.
- **No backward-compat shim**: existing API contract (`GET /api/inventory` returning `{products, transactions}`) is preserved by PRD design, but the .NET-side repository swap (M1) must keep the exact JSON shape (camelCase Vietnamese field names like `maSKU`, `tonKho`). Add a serialization test in Sprint A to lock this.
