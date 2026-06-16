# EPIC-004 — Implement Summary (Hotfix round)

**Epic:** Nâng cấp quản lý User
**Branch:** `feature/EPIC-004-admin-users`
**Status:** **Hotfix applied. Original FE delivery (prior round) + 3 bug fixes diagnosed from user feedback "đang lỗi không thể thao tác. log HTTP 500, 403 (không có thông báo gì cụ thể)".**

---

## 1. Bugs reproduced & root causes

User reported: "không thể thao tác" — admin couldn't use the new UI; backend returned HTTP 500 and 403 with **empty body** so the FE had nothing to display.

### Bug 1 — HTTP 500 on `/api/admin/users` list (and any logout-all / session-count call)

**Symptom:** Opening `/admin/users` page → 500 from `GET /api/admin/users`. No body.

**Root cause:** `SessionStore.CountActiveAsync` and `RevokeAllForUserAsync` use `IConnectionMultiplexer.GetServer(...).KeysAsync(pattern, pageSize)` for SCAN. StackExchange.Redis requires `AllowAdmin=true` on the `ConfigurationOptions` to access `IServer` operations — without it, the call throws `RedisCommandException` synchronously inside Dapper-style async, propagates unhandled, and ASP.NET emits a blank 500.

**Fix:** `server/Program.cs` Redis options now set `options.AllowAdmin = true`. Documented with comment.

### Bug 2 — HTTP 403 with empty body when permission denied

**Symptom:** Non-admin user attempts admin action → 403 but FE shows blank toast.

**Root cause:** Default `AuthorizationMiddlewareResultHandler` in ASP.NET emits a status code with no body. PRD `EPIC-003-AC15` flagged this; carried over as a known risk into EPIC-004.

**Fix:** New `JsonAuthorizationMiddlewareResultHandler` registered as `IAuthorizationMiddlewareResultHandler` singleton. On `Forbidden` writes `{ "error": "Không có quyền thực hiện hành động này", "code": "permission_denied" }`. On `Challenged` (401 from policy) writes `{ "error": "Phiên đăng nhập đã kết thúc", "code": "unauthorized" }`.

### Bug 3 — Unhandled exceptions return blank 500

**Symptom:** Any uncaught server exception → bare 500, FE toast shows nothing.

**Root cause:** No global exception handler — ASP.NET default 500 has no body.

**Fix:** `JsonExceptionHandler.Use(app)` wires `UseExceptionHandler(...)` to emit `{ "error": "Lỗi máy chủ. Vui lòng thử lại hoặc liên hệ admin.", "code": "internal_error", "detail": <exception message in dev only> }`. Stack traces never sent to wire.

### Additional defensive fix — UserAdminService.UpdateProfileAsync mapping

The PATCH endpoint added in the prior round used `QuerySingleOrDefaultAsync<UserRow>` with placeholder columns (`'' AS UsernameLower`, `0 AS FailedLoginAttempts`, etc.) that were brittle under Dapper's mapping. Replaced with a narrow `UserProjection` record matching only the columns actually needed.

### FE — better error message fallback

`utils/api.ts` `readError` now:
- Surfaces server-supplied `error` or `title` field.
- Falls back to a Vietnamese status-code map: 400/401/403/404/409/423/429/503 each have specific messages; ≥ 500 displays `Lỗi máy chủ (HTTP NNN)`.

Result: even if the server returns a truly empty body (e.g., proxy crash), the toast says something actionable.

---

## 2. Files touched this round

### Backend

| File | Change |
|---|---|
| `server/Program.cs` | (a) `ConfigurationOptions.AllowAdmin = true` for Redis. (b) Register `JsonAuthorizationMiddlewareResultHandler`. (c) `JsonExceptionHandler.Use(app)` at top of pipeline. |
| `server/ErrorHandlers.cs` (NEW) | `JsonAuthorizationMiddlewareResultHandler` + `JsonExceptionHandler` static. |
| `server/UserAdminService.cs` | `UpdateProfileAsync` rewritten with `UserProjection` private record (drops fragile UserRow placeholder query). |

### Frontend

| File | Change |
|---|---|
| `src/app/utils/api.ts` | `readError` extracts server message, falls back to status-coded Vietnamese strings for empty bodies. |

**Cumulative this branch (FE delivery + hotfix):** 1 new BE file + 4 modified BE files + 4 new FE component files + 2 modified FE files (`App.tsx`, `api.ts`).

---

## 3. Acceptance Criteria fulfilled by this hotfix

| AC | Status |
|---|---|
| **EPIC-003-AC15** (carried forward) — 403 with `permission_denied` code in body | **DONE** via `JsonAuthorizationMiddlewareResultHandler` |
| **EPIC-004-AC33** — Network/server error toast | DONE via `readError` improvements |
| Implicit reliability AC — "tao tác được" admin UI | DONE via Redis `AllowAdmin` fix |

All other EPIC-004 ACs (AC01..AC34) remain DONE from the prior implement round; this hotfix unblocks them in runtime.

---

## 4. Verification (for reviewer)

1. `dotnet build server/Server.csproj` — clean.
2. `docker compose up -d`. Login as admin.
3. **Bug 1 verify**: `curl /api/admin/users -H "Authorization: Bearer <admin-token>"` → 200 with JSON array (was 500 before).
4. **Bug 2 verify**: Login as a non-admin user (use existing `qa-user-readonly` or create one); `curl /api/admin/users -H "Authorization: Bearer <user-token>"` → 403 with body `{"error":"Không có quyền thực hiện hành động này","code":"permission_denied"}`.
5. **Bug 3 verify**: Force a server exception (e.g., kill Postgres mid-flight then issue a write request) → response 500 with body `{"error":"Lỗi máy chủ...","code":"internal_error"}` (not blank).
6. **FE verify**: In Chrome DevTools Network tab, observe that 403 responses now have JSON bodies; the UI toast shows "Không có quyền thực hiện hành động này".
7. **Full smoke** of EPIC-004 TEST-SCRIPT: SC-01 through SC-28 should all complete without empty-body errors.

---

## 5. Tests added this round

Catalog only (test runner still absent — same toolchain gap as prior epics):

| Test ID | Class | Scenario |
|---|---|---|
| EPIC-004-UT-API-READERROR-403-EMPTY-001 | `utils/api.ts` `readError` | 403 with empty body → returns "Không có quyền thực hiện hành động này" |
| EPIC-004-UT-API-READERROR-500-EMPTY-001 | same | 500 with empty body → returns "Lỗi máy chủ (HTTP 500)" |
| EPIC-004-UT-API-READERROR-SERVER-MSG-001 | same | 409 with `{error:"x"}` body → returns "x" |
| EPIC-004-IT-ADMIN-LIST-USERS-NO-500-001 | endpoint integration | `GET /api/admin/users` returns 200 with array, not 500 |
| EPIC-004-IT-AUTH-403-HAS-BODY-001 | endpoint integration | Non-admin user calls `/api/admin/users` → 403 with body `{error, code:"permission_denied"}` |
| EPIC-004-IT-UNHANDLED-500-HAS-BODY-001 | endpoint integration | Force exception (e.g., bad JSON to a write endpoint) → 500 with body `{error, code:"internal_error"}` |

---

## 6. Risks & follow-ups

- `AllowAdmin=true` widens the permitted Redis commands set, including FLUSHDB / CONFIG. The Redis container password is set via `.env` and never exposed; risk acceptable for internal-only deployment. To narrow further, switch from `IServer.KeysAsync` to an explicit per-user session SET (`SADD sessions:user:<id> <jti>` on create, `SREM` on delete, `SMEMBERS` for list) — eliminates need for AllowAdmin. **Recommend** this refactor in a follow-up sprint (EPIC-005 backlog).
- `JsonExceptionHandler` emits `detail` only in `IsDevelopment()`. If staging is misconfigured as Development env, exception messages leak to clients. Verify `ASPNETCORE_ENVIRONMENT=Production` on prod docker-compose env.
- Structured log scope from `RequestContextMiddleware` is also written when 500 happens — so ops still has full diagnostic info in server logs even though wire body is sanitized.

---

## 7. Commit + PR

```bash
git add -A
git commit -m "EPIC-004 hotfix: AllowAdmin redis + JSON 403/500 envelopes"
git push -u origin feature/EPIC-004-admin-users
# Update existing PR (if open) or open a new one
```

PR body should reference: "Fixes user-reported blank 500/403 bodies. Adds JSON envelopes for unauthorized + forbidden + unhandled exceptions. Enables Redis AllowAdmin for SCAN-based active-session count."
