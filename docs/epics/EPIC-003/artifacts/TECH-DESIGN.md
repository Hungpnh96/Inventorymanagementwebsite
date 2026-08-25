# TECH-DESIGN — EPIC-003 v2 (refresh)

**Epic:** EPIC-003
**Author:** Tech Lead
**Status:** Draft v2 (2026-06-13) — supersedes v1; focuses on remaining slices
**Source PRD:** `docs/epics/EPIC-003/artifacts/PRD.md` v2

---

## 1. Summary

v1 of this doc designed all of EPIC-003 from scratch. Since v1, **two implement rounds** landed S1 (Redis session + logout + lockout), S2 (audit logger), S3-backend (admin user CRUD), and partial S5 (verbose health, CORS allowlist, 409 dup SKU, Db retry, DB grants migration). v2 focuses on the **5 remaining slices**:

1. **S4-backend — Permission middleware**: enforce `user_permissions` server-side so non-admin users actually get 403 on disallowed actions (closes AC21 + EPIC-003-AC15/16).
2. **S3-FE — Admin Users page**: `/admin/users` UI with create / delete / set-permissions / reset-password / logout-all (closes AC22..AC30 from the UI side).
3. **S4-FE — Admin Audit page + sidebar gating**: `/admin/audit` UI consuming the backend endpoint already built, plus permission-aware sidebar rendering (closes AC33 UI + EPIC-003-AC17/21).
4. **S5-final — Polish**: per-row Excel migration tolerance (AC12), structured JSON logging with `requestId` correlation (EPIC-003-AC25), ops runbook (EPIC-003-AC27).
5. **S6 — Cleanup**: remove `DISABLE_REDIS_SESSION_CHECK` kill-switch entirely (EPIC-003-AC23).

No new infrastructure, no new framework, no schema change. All work is additive on top of the existing flat 3-layer Minimal API + React/Vite/shadcn structure.

---

## 2. Architecture (delta only)

### 2.1 Existing layering — recap

```
L1 Endpoints (Program.cs)
  ↓
L2 Services (AuthService, SessionStore, LoginThrottle, AuditLogger,
              UserAdminService, AuditQueryService, PostgresStore, ExcelStore)
  ↓
L3 Infrastructure (Db, IConnectionMultiplexer, IClock)
```

### 2.2 What v2 adds

**L2 — new service:**
- `PermissionService` — loads + caches per-user permission matrix; invalidates on permission write.

**L1 — new middleware/policy:**
- `PermissionPolicyProvider` + endpoint extension method `.RequirePermission("inventory", "update")` — wraps `[Authorize]` with permission requirement.
- One policy per `<menu>.<action>` combination (5 × 4 = 20 named policies).

**L3 — unchanged.** `PermissionService` uses existing `Db` + `IConnectionMultiplexer`.

**Frontend layering (recap):**
```
App.tsx → components/<page>.tsx → components/ui/<primitive>.tsx
            ↓
         utils/api.ts, utils/permissions.ts (NEW), utils/storage.ts
```

**Frontend — new files:**
- `src/app/utils/permissions.ts` — `hasPermission(perms, menu, action)` helper.
- `src/app/components/admin/UsersPage.tsx`, `AuditPage.tsx`, `PermissionMatrix.tsx`, `UserFormDialog.tsx`, `ResetPasswordDialog.tsx`, `AuditDiffDialog.tsx`.

### 2.3 Key design choices (v2 only)

| # | Choice | Decision | Rationale | Rejected |
|---|---|---|---|---|
| 1 | Permission cache invalidation | **Invalidate-on-write** + 30s TTL safety net | Answers PRD §10 Q1. Cheap: PUT `/permissions` is rare (admin action); DEL one Redis key is trivial. Eliminates the 30s window of staleness. | TTL-only (PRD §10 leaned this way originally) — rejected because UX of "wait 30s for permission change" is poor. |
| 2 | Permission payload location | In `LoginResponse.permissions` + `MeResponse.permissions` | FE needs the matrix on first render; piggy-back on existing endpoints avoids extra round trip | Separate `GET /api/me/permissions` — rejected, extra round trip |
| 3 | Policy registration | One `Authorize(Policy="<menu>.<action>")` per protected endpoint | Declarative; ASP.NET native; testable via `WebApplicationFactory` | Inline `if (!await perms.Allowed(...)) return 403` — rejected, repetitive, easy to forget |
| 4 | Admin short-circuit | `IsInRole("admin")` always returns true in `PermissionHandler` | Admin always has full access; no need to populate matrix rows for admins | Forcing admins to have full matrix rows — rejected, more state to sync |
| 5 | Sidebar gating | FE reads `currentUser.permissions[menu].view`, hides item if false | Defense in depth (server is still authoritative) | Server-rendered menu — N/A (SPA) |
| 6 | FE admin page state | Local component state + refetch on every mutation | Simple, no Redux/Zustand needed for ≤ 50 user records | Optimistic UI — rejected for v1 admin pages (low traffic, errors visible) |
| 7 | Audit diff display | Plain side-by-side JSON `<pre>` blocks; no diff library | shadcn doesn't ship one; cheap to add later if needed | Library — out of scope |
| 8 | Structured logging | `Microsoft.Extensions.Logging` JSON formatter (`AddJsonConsole`) + middleware that attaches `requestId` to `LogContext` | Built-in; no new dep | Serilog — rejected, scope creep |
| 9 | requestId source | Honor `X-Request-ID` if present; else `Guid.NewGuid("N")` | Lets upstream LBs / proxies propagate IDs | Always generate — rejected, breaks distributed tracing later |
| 10 | Per-row Excel tolerance | Catch + log per row in `ExcelStore.ReadAsync` (already in code) — verify each row has required cells | Smallest change to existing parser | Rewrite parser — overkill |
| 11 | Kill-switch cleanup | Single cleanup PR: delete env-var handling block from `SessionValidationMiddleware`, remove `.env.example` entry; add CI lint that fails if `DISABLE_REDIS_SESSION_CHECK` reappears | Permanent removal | Keep with default false — rejected, presence of dead code is its own risk |

---

## 3. API / Interface Contract (delta)

### 3.1 Modified responses (additive — backward compatible)

**`LoginResponse`** (`server/Models.cs`) — add `permissions` field:
```json
{
  "token": "...",
  "username": "qa-user1",
  "role": "user",
  "fullName": "QA One",
  "mustChangePassword": false,
  "expiresInSeconds": 28800,
  "permissions": {
    "dashboard":    { "view": true,  "create": false, "update": false, "delete": false },
    "inventory":    { "view": true,  "create": false, "update": false, "delete": false },
    "transactions": { "view": true,  "create": true,  "update": false, "delete": false },
    "reports":      { "view": false, "create": false, "update": false, "delete": false },
    "users":        { "view": false, "create": false, "update": false, "delete": false }
  }
}
```

**`MeResponse`** — same `permissions` field added.

**Backward compatibility**: old FE clients ignoring `permissions` keep working. Server-side enforcement does NOT depend on client.

### 3.2 New endpoints

None. All necessary endpoints already exist (`/api/admin/users/*`, `/api/admin/audit`). v2 only adds **server-side enforcement** via policies on existing protected endpoints.

### 3.3 Endpoint authorization changes

| Endpoint | Old | New |
|---|---|---|
| `GET /api/inventory` | `.RequireAuthorization()` | `.RequirePermission("inventory", "view")` |
| `POST /api/products` | `.RequireAuthorization()` + manual `IsAdmin` check | `.RequirePermission("inventory", "update")` (also satisfies admin via short-circuit) |
| `DELETE /api/products/{sku}` | same | `.RequirePermission("inventory", "delete")` |
| `POST /api/inventory/import` | manual admin | `.RequirePermission("inventory", "update")` |
| `POST /api/transactions` | auth only | `.RequirePermission("transactions", "create")` |
| `/api/admin/*` | manual admin | `.RequireRole("admin")` (already implicit; make explicit) |

The `manual IsAdmin` checks inside the lambda bodies will be **removed** in favor of policy registration. This is a cleanup, not a behavioral change — admin role short-circuits in `PermissionHandler`.

### 3.4 Error envelope

All 403s use:
```json
{ "error": "Không có quyền thực hiện hành động này", "code": "permission_denied" }
```

### 3.5 Versioning

All changes additive. No API version bump.

---

## 4. Data Model (no change)

EPIC-003 v2 makes **zero schema changes**. The `user_permissions` table already exists from EPIC-002 with the index added in `002_epic003_grants.sql`. The `PermissionService` reads + writes existing rows.

---

## 5. State Management

### 5.1 Server-side (per-request)

| State | Location | Lifecycle | Invalidation |
|---|---|---|---|
| Resolved permissions matrix for the current request | `HttpContext.Items["perms"]` set by `PermissionService.LoadAsync` (called once at start of request via middleware OR lazy in handler) | Request-scoped (auto-GC) | n/a |
| Permission cache | Redis `perms:user:<id>` JSON, TTL 30s | Created on first lookup | Invalidated on PUT `/api/admin/users/{id}/permissions` — delete key |
| Per-user role | JWT claim (cached in token) | Until JWT expiry | n/a (admin/user role doesn't change in v1) |

### 5.2 Frontend

| State | Location | Lifecycle |
|---|---|---|
| `currentUser.permissions` | `App.tsx` React state, hydrated from `fetchMe()` | Re-fetched on every `/api/auth/me` call (bootstrap + post-login). After admin updates own permissions (impossible in v1) or after reset — N/A. |
| Sidebar visibility | Derived computed from `permissions` | Pure render-time |
| Admin users list | `UsersPage.tsx` local state | Refetched on every mutation |
| Audit rows | `AuditPage.tsx` local state | Refetched on filter change; appends on "Tải thêm" |

---

## 6. Sequence flows (new)

### 6.1 Permission check on protected request

```
FE                  API: SessionMW           API: PolicyHandler        Redis              Postgres
 │ GET /products    │                         │                        │                   │
 │─────────────────►│ JWT ok + session ok    │                        │                   │
 │                  │────────────────────────►│ "inventory.update"     │                   │
 │                  │                         │ GET perms:user:<id>    │                   │
 │                  │                         │───────────────────────►│                   │
 │                  │                         │◄───────────────────────│ HIT (cached)      │
 │                  │                         │ check matrix[inv][upd] │                   │
 │                  │                         │   = false → 403        │                   │
 │◄───── 403 ────────────────────────────────│                        │                   │
```

### 6.2 Permission cache miss

```
PolicyHandler         Redis            Postgres
   │ GET perms        │                 │
   │─────────────────►│ MISS            │
   │ load             │                 │
   │────────────────────────────────────►│ SELECT menu, action, allowed FROM user_permissions WHERE user_id = ?
   │◄────────────────────────────────────│ rows
   │ SETEX perms:user:<id> 30 <json>     │
   │─────────────────►│                 │
   │ proceed          │                 │
```

### 6.3 Invalidate on write

```
Admin → PUT /api/admin/users/<X>/permissions
  → UserAdminService.UpdatePermissionsAsync (existing)
    → after DB commit:
      → IConnectionMultiplexer.GetDatabase().KeyDeleteAsync(RedisKeys.PermsUser(X))
    → audit
```

The cache invalidation step is **the only new logic** in this flow. Add to existing `UserAdminService.UpdatePermissionsAsync` after the transaction commits.

---

## 7. Dependency wiring

In `Program.cs`:

```csharp
// L2 — new service
builder.Services.AddSingleton<PermissionService>();

// Policies: 1 per menu.action combo (20 total). Helper extension to keep this tidy.
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddSingleton<IAuthorizationHandler, PermissionHandler>();
```

`PermissionPolicyProvider` dynamically returns a policy for any string of form `<menu>.<action>` (no need to register 20 policies up front). The handler reads `PermissionService.LoadAsync(userId)` (cached) and checks the matrix.

Lifetime: singleton (stateless, holds no per-request state).

---

## 8. Frontend routing changes

Already covered by v1 design: route enum in `App.tsx` extended:

```ts
type Page = 'dashboard' | 'inventory' | 'transaction' | 'search' | 'reports' | 'admin-users' | 'admin-audit';
```

Sidebar items table extended with a `requires?: {menu: string; action: string} | { role: 'admin' }` field. Hidden if check fails.

---

## 9. Non-Functional Design (delta)

### 9.1 Performance

| Operation | Budget (p95) | How |
|---|---|---|
| Permission check (cache hit) | ≤ 3ms | Single `StringGetAsync` on Redis |
| Permission check (cache miss) | ≤ 15ms | + 1 `SELECT * FROM user_permissions WHERE user_id=?` (indexed) |
| Middleware overhead per protected request | ≤ 8ms p99 | Already measured in EPIC-003 v1; +1 Redis trip for permissions on top |
| Admin Users page initial load | ≤ 1s | 1 GET listing all users + N x `activeSessions` SCAN — optimize by precomputing counts server-side already done |
| Admin Audit page initial load | ≤ 1s for 50 rows | Cursor-paginated query already indexed |

### 9.2 Reliability

- Permission cache miss falls back to DB. DB failure → 503 (handled by existing middleware error handler).
- Cache invalidation failure on PUT → log error + emit metric; do NOT fail the PUT. Stale cache will expire in 30s anyway.

### 9.3 Security

- AC21 closure: every protected endpoint now has `.RequirePermission(...)`. No more silent admin-only check missing on a future endpoint — policies are explicit.
- Admin role short-circuit is documented and tested.
- `PermissionPolicyProvider` validates policy name format (`<menu>.<action>` with allowlisted values) — invalid policy names fail closed (return false).

### 9.4 Observability (new requirements from PRD AC25)

Structured JSON logging:
- Configure in `Program.cs`: `builder.Logging.AddJsonConsole(opts => { opts.IncludeScopes = true; });`
- New middleware `RequestContextMiddleware` runs first:
  - Reads `X-Request-ID` header or generates `Guid.NewGuid("N")`.
  - Sets it back on response.
  - Pushes `LogContext.PushProperty("requestId", id)` + `userId` (if authenticated).
- Every log line is now JSON with `{level, ts, requestId, userId, msg, ...}`.

Example log line:
```json
{"timestamp":"2026-06-13T10:30:00Z","level":"Information","requestId":"a1b2c3...","userId":"42","msg":"login.success","latencyMs":230}
```

### 9.5 Accessibility (FE pages)

- `UsersPage` table uses shadcn `Table` (semantic `<table>`).
- All buttons have `aria-label`.
- `PermissionMatrix` uses `<input type="checkbox">` with associated `<label htmlFor="...">`.
- `ResetPasswordDialog`: temp pw `<code>` has `aria-label="Mật khẩu tạm"`; "Copy" button announces via `aria-live`.
- Focus trap in dialogs (Radix built-in).

### 9.6 i18n

vi-VN only. No new strings externalized.

---

## 10. Rollout & reversibility

### 10.1 Slice plan

| Slice | PR | Adds | Blast radius | Revert |
|---|---|---|---|---|
| **S4-backend** | `EPIC-003 S4 permission middleware` | `PermissionService.cs`, `PermissionPolicyProvider.cs`, `PermissionHandler.cs`, policy registrations, `LoginResponse`/`MeResponse` extended | Every protected endpoint (changed `.RequireAuthorization()` → `.RequirePermission(...)`) | Single PR revert — endpoints fall back to `RequireAuthorization()` |
| **S3-FE** | `EPIC-003 S3 FE admin users page` | `/admin/users` route + dialogs | FE only | Single PR revert |
| **S4-FE** | `EPIC-003 S4 FE audit page + sidebar gating` | `/admin/audit` page + `App.tsx` sidebar gating + `permissions.ts` helper | FE only | Single PR revert |
| **S5-final** | `EPIC-003 S5 polish` | Structured JSON logging + requestId middleware + per-row Excel tolerance + ops runbook doc | Affects logs format (downstream log parsers may care) | Easy revert; if log format consumers exist, communicate beforehand |
| **S6** | `EPIC-003 S6 cleanup kill-switch` | Remove `DISABLE_REDIS_SESSION_CHECK` handling from middleware + .env.example; add CI lint | Bypass capability removed forever — verify in staging first | Re-add the env-var block if disaster |

### 10.2 Feature flags

- **`PERMISSION_ENFORCEMENT_ENABLED`** (NEW, in S4-backend) — env var, default `true`. If `false`, policies fall back to `RequireAuthorization()` (legacy behavior). Removed in a S7 cleanup PR 14 days after S4 GA.
- **`DISABLE_REDIS_SESSION_CHECK`** — removed in S6.

### 10.3 Rollback

- S4-backend rollback procedure: set `PERMISSION_ENFORCEMENT_ENABLED=false` → restart API. Users regain full access (legacy behavior).
- Frontend rollbacks: revert PR. Backend still enforces — UI just won't render admin pages.

### 10.4 Manual ops gate before S4-backend GA

Same as v1 design: ops MUST apply `002_epic003_grants.sql` AND switch `POSTGRES_CONNECTION` to `inventory_app` before S4 ships. Otherwise AC37 is not in force.

---

## 11. File / Module Impact

### Backend — new

| File | Purpose |
|---|---|
| `server/PermissionService.cs` | Load + cache user permission matrix; invalidate on write |
| `server/PermissionPolicyProvider.cs` | Dynamic policy creation for `<menu>.<action>` names |
| `server/PermissionHandler.cs` | `AuthorizationHandler<PermissionRequirement>` — checks cached matrix, admin short-circuit |
| `server/PermissionRequirement.cs` | `IAuthorizationRequirement` carrying `Menu` + `Action` |
| `server/RequestContextMiddleware.cs` | Sets `requestId` log context |

### Backend — modified

| File | Change |
|---|---|
| `server/Models.cs` | `LoginResponse` + `MeResponse` get `Permissions` property |
| `server/AuthService.cs` | `FindByUsernameAsync` + `FindByIdAsync` return matrix or null (matrix loaded by PermissionService in endpoint) |
| `server/UserAdminService.cs` | `UpdatePermissionsAsync` invalidates `perms:user:<id>` Redis key after commit |
| `server/Program.cs` | Wire `PermissionService` + policy provider + `RequestContextMiddleware`; add JSON console logging; switch protected endpoints from `RequireAuthorization()` to `.RequirePermission(menu, action)`; extend login/me response shapes |
| `server/ExcelStore.cs` | Per-row try/catch in `ParseProductsFromFileAsync` (and the equivalent for transactions); aggregate skipped rows + return count |
| `.env.example` | Add `PERMISSION_ENFORCEMENT_ENABLED=true`; remove `DISABLE_REDIS_SESSION_CHECK` line in S6 |

### Frontend — new

| File | Purpose |
|---|---|
| `src/app/utils/permissions.ts` | `hasPermission(perms, menu, action)`, `canViewMenu(perms, menu)` helpers + 1 const for menu/action names |
| `src/app/components/admin/UsersPage.tsx` | Table + Add/Edit/Delete/Permissions/Reset/Logout-all controls |
| `src/app/components/admin/AuditPage.tsx` | Filter bar + table + load more + diff modal |
| `src/app/components/admin/PermissionMatrix.tsx` | 5×4 checkbox grid + "all" toggles |
| `src/app/components/admin/UserFormDialog.tsx` | Create user form |
| `src/app/components/admin/ResetPasswordDialog.tsx` | One-time-display temp pw |
| `src/app/components/admin/AuditDiffDialog.tsx` | Side-by-side JSON pre-tag display |

### Frontend — modified

| File | Change |
|---|---|
| `src/app/App.tsx` | Add admin-users + admin-audit routes; sidebar items map gated by `permissions` + `role` |
| `src/app/types.ts` | Add `Permissions = Record<string, Record<string, boolean>>` and `User` extended with `permissions?` |
| `src/app/utils/api.ts` | Extend `LoginResult` and `MeResponse` shapes with `permissions` |

### Docs — new

| File | Purpose |
|---|---|
| `docs/runbook/epic-003-ops.md` | Ops procedures: apply grants migration, switch POSTGRES_CONNECTION, rotate JWT_SECRET (with Redis flush), reset root admin via CLI, archive audit older than 2 years |

Total: **5 new BE files**, **6 modified BE files**, **7 new FE files**, **3 modified FE files**, **1 new doc file**.

---

## 12. Risks & technical debt

| Risk | Severity | Mitigation |
|---|---|---|
| Policy fan-out (20 named policies) makes onboarding harder | Low | `PermissionPolicyProvider` documents the naming convention with examples in xmldoc |
| Forgetting `.RequirePermission()` on a new endpoint = silent regression | High | CI lint test: every `.MapPost/Put/Delete/Get("/api/inventory/...` line must be followed by `.RequirePermission(...)` or `.AllowAnonymous()` within 5 lines. Reuse the static-analysis pattern from EPIC-003-AC07 (audit coverage grep) |
| Permission cache invalidation race | Low | Worst case: 30s TTL kicks in. Server is always authoritative on next DB read |
| Sidebar visibility leaks names of hidden features | Low | Accepted — FE is not the security boundary; server is. Acceptable to know "there is an Admin section" |
| Removing kill-switch breaks emergency recovery | Medium | Before S6 merge: practice the emergency procedure on staging by flipping `PERMISSION_ENFORCEMENT_ENABLED` instead. Document in runbook |
| Structured JSON logs break developer console readability | Low | In `Development` environment, use Simple console; in `Production`, JSON. Standard ASP.NET pattern |
| `ExcelStore` per-row tolerance changes counts in import response | Low | Update response shape: `{imported: N, skipped: M}` — additive field, backward compat |

### Intentional shortcuts (debt log)

- **No DB migration tool** carry-forward. Numbered SQL files remain. Pay back when schema churn exceeds 1 file/sprint.
- **No real client-side routing** in FE (still no react-router). New routes use `Page` enum + conditional render. Tolerated; not on the critical path.
- **Audit diff display = raw JSON** — acceptable for v1; if admins demand human-readable diffs, swap in `diff-match-patch` library in a UX epic.

---

## 13. Open questions (deferred from PRD §10)

| # | Question | Answer this design proposes | Owner |
|---|---|---|---|
| 1 | Permission cache invalidation strategy | **Invalidate-on-write + 30s TTL safety** — see §2.3 #1 | TL (proposed) |
| 2 | `/admin/users` edit fullName endpoint | Add `PATCH /api/admin/users/{id}` in S3-FE round (small backend addition); body `{fullName}` | TL — proposed |
| 3 | Audit retention forensic hash | Out of scope EPIC-003; track in compliance ticket | Legal |
| 4 | `actor_username` denormalization OK? | Confirmed acceptable for the snapshot model | Legal |
| 5 | "Cần đổi PW" surfacing | Use icon (key with exclamation) in Username column | Designer — proposed |
| 6 | CI lint for kill-switch reappearance | Add a `dotnet test` static-analysis case `EPIC-003-UT-NO-KILL-SWITCH` checking `grep DISABLE_REDIS_SESSION_CHECK` returns 0 across `server/**/*.cs` | TL — proposed |

---

## 14. Diff vs v1

- **§1 Summary** rewritten to reflect what's already shipped.
- **§2 Architecture** trimmed to delta only (no full re-print of L1/L2/L3).
- **§3 API contract** focused on additive changes to `LoginResponse`/`MeResponse` + authorization policy swap.
- **§6 Sequence flows** added permission check + cache miss + invalidate-on-write flows.
- **§10 Rollout** new slice list (S4-backend through S6) with kill-switch removal sequence.
- **§11 File impact** rescoped to ~5+6+7+3+1 files (vs v1's larger list which covered already-done work).
- **§13 Open questions** answered with proposed decisions in-doc; PO/Legal need confirm Q2, Q3, Q4 before S3-FE / S5 ship.

---

## 15. Handoff

- **Next:** QA extends TEST-PLAN.md and TEST-CASES.md with cases for AC15..AC27. Specifically:
  - `EPIC-003-IT-PERM-INV-DENY-001` — user with `inventory.update=false` calls PUT → 403.
  - `EPIC-003-IT-PERM-CACHE-INVALIDATE-001` — admin updates perms → user's next request sees new perms within 1s (not 30s).
  - `EPIC-003-IT-POLICY-ADMIN-SHORTCIRCUIT-001` — admin role bypasses permission matrix.
  - `EPIC-003-UI-USERS-PAGE-001..006` — RTL tests for `UsersPage` flows.
  - `EPIC-003-UI-AUDIT-PAGE-001..003` — RTL + Playwright for filter + truncation banner.
  - `EPIC-003-UT-LOGGER-REQUEST-ID-001` — log line contains `requestId`.
- **Then:** Developer ships S4-backend → S3-FE → S4-FE → S5-final → S6.
- **Then:** QA runs final UAT (TEST-SCRIPT will need to drop "DEFERRED" tags from corresponding scenarios).
