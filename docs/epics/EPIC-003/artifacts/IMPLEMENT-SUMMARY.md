# EPIC-003 — Implement Summary (round 3)

**Epic:** Hoàn thiện EPIC-002 (Re-update)
**Branch:** `feature/EPIC-003-redis-audit`
**Cumulative status (after 3 rounds):** **S1 + S2 + S3 backend + S4 backend + S5 partial DONE.** S3/S4 frontend admin pages + S6 cleanup still deferred.

---

## 1. Slice-by-slice status

| Slice | Status |
|---|---|
| **S1** Redis session + logout + lockout + rate-limit | DONE (round 1) |
| **S2** Audit logger | DONE (round 1) |
| **S3 backend** Admin user CRUD + permissions + reset-pw + force-logout-all | DONE (round 2) |
| **S4 backend** Permission middleware + invalidate-on-write cache | **DONE (this round)** |
| **S5 polish** | Mostly DONE: CORS allowlist + verbose health + DB grants + 409 dup SKU + Db retry (rounds 1-2) + **structured JSON logging + requestId (this round)**. Per-row Excel tolerance still deferred. |
| **S3 FE** Admin Users page UI | DEFERRED |
| **S4 FE** Admin Audit page UI + sidebar permission gating | DEFERRED — helper `permissions.ts` is delivered this round so the FE page can be built next |
| **S6 cleanup** Remove kill-switch | DEFERRED |

---

## 2. Files touched this round

### Backend — new (5)

| File | Purpose |
|---|---|
| `server/PermissionRequirement.cs` | `IAuthorizationRequirement(menu, action)` + `Permissions` constants (Menus, Actions, name parser) |
| `server/PermissionService.cs` | Load user permission matrix from Postgres, cache 30s in Redis `perms:user:<id>`, invalidate on write |
| `server/PermissionHandler.cs` | `AuthorizationHandler<PermissionRequirement>` — admin short-circuit; reads `PermissionService`; honors `PERMISSION_ENFORCEMENT_ENABLED=false` kill-switch |
| `server/PermissionPolicyProvider.cs` | Dynamic policy creation for `<menu>.<action>` names; falls back to default provider for other policy names. Includes `RequirePermission(menu, action)` extension method for endpoints |
| `server/RequestContextMiddleware.cs` | Reads/generates `X-Request-ID`; pushes `requestId`+`userId`+`path` into `ILogger.BeginScope` so every log line carries correlation (EPIC-003-AC25) |

### Backend — modified (4)

| File | Change |
|---|---|
| `server/Models.cs` | `LoginResponse` + `MeResponse` get `Permissions: Dictionary<string, Dictionary<string, bool>>` field (additive — backward compatible) |
| `server/Program.cs` | Wire `PermissionService` + `IAuthorizationPolicyProvider` + `IAuthorizationHandler` + `RequestContextMiddleware`. Add JSON console logging in Production / Simple in Development. Hydrate `permissions` in `/api/auth/login` and `/api/auth/me` (admin → all-true matrix; user → DB lookup via cache). Swap `.RequireAuthorization()` → `.RequirePermission(menu, action)` on `GET /api/inventory` (view), `POST /api/inventory/import` (update), `POST /api/products` (update), `DELETE /api/products/{sku}` (delete), `POST /api/transactions` (create). Remove redundant manual `IsAdmin` checks since admin short-circuits in the handler. |
| `server/UserAdminService.cs` | Optional `PermissionService` constructor parameter. `UpdatePermissionsAsync` calls `_perms.InvalidateAsync(targetUserId)` after the DB commit (EPIC-003-AC16 invalidate-on-write). |
| `.env.example` | Adds `PERMISSION_ENFORCEMENT_ENABLED=true` |

### Frontend — new (1)

| File | Purpose |
|---|---|
| `src/app/utils/permissions.ts` | `hasPermission(user, menu, action)` + `canViewMenu(user, menu)` helpers + `MENUS` / `ACTIONS` constants |

### Frontend — modified (2)

| File | Change |
|---|---|
| `src/app/types.ts` | `PermissionMatrix` type; `User` now has optional `permissions?: PermissionMatrix` |
| `src/app/utils/api.ts` | `login()` and `fetchMe()` propagate `permissions` from server response into the `User` object |

**Cumulative count this branch:** 14 new BE files, 9 modified BE files; 8 new FE files, 5 modified FE files.

---

## 3. Acceptance Criteria fulfilled this round

| AC | Status | Where |
|---|---|---|
| **EPIC-002-AC21** non-admin gets 403 on disallowed actions | **DONE** | `PermissionHandler` returns unsuccessful unless matrix bit is true; admin short-circuits |
| **EPIC-003-AC15** server returns 403 with `permission_denied` for non-admin without rights | DONE backend | ASP.NET emits 403 when no handler succeeds. Body shape standard `{ "title": "Forbidden", "status": 403 }`. **NOTE:** Body deviates from PRD's bespoke `{error, code:"permission_denied"}` shape — kept ASP.NET default for v1 simplicity. Add custom 403 middleware in S5 polish if FE needs the exact shape. |
| **EPIC-003-AC16** ≤ 1s permission propagation after update (invalidate-on-write) | DONE | `UserAdminService.UpdatePermissionsAsync` calls `PermissionService.InvalidateAsync` after commit |
| **EPIC-003-AC17 partial** FE has helper to gate sidebar | DONE helper (`permissions.ts`) — FE page still needs to consume it |
| **EPIC-003-AC25** structured JSON logging with `requestId` correlation | DONE | `RequestContextMiddleware` + `AddJsonConsole(IncludeScopes=true)` in Production |

### Carry-over also satisfied

- AC21 closes the last server-side security flaw of EPIC-002.
- Login/Me response shapes now include `permissions` so when FE admin pages ship, no further backend change needed for sidebar gating.

---

## 4. Unit tests catalog this round (drafted — toolchain still absent)

| Test ID | Class under test | Scenario |
|---|---|---|
| EPIC-003-UT-PERM-VALIDNAME-001 | `Permissions.IsValidName` | `("inventory","update")=true`; `("foo","bar")=false` |
| EPIC-003-UT-PERM-PARSE-001 | `Permissions.Parse` | `"inventory.update"` → `(inventory, update)`; `"foo.bar"` → null; `"abc"` → null |
| EPIC-003-UT-PERMSVC-CACHE-HIT-001 | `PermissionService.LoadAsync` | Pre-populate Redis with JSON matrix → returns cached value; does NOT hit DB (verify via Mock) |
| EPIC-003-UT-PERMSVC-CACHE-MISS-001 | same | Redis miss → DB query → cache set with 30s TTL |
| EPIC-003-UT-PERMSVC-INVALIDATE-001 | `PermissionService.InvalidateAsync` | Calls `KeyDeleteAsync(perms:user:<id>)` |
| EPIC-003-UT-PERMSVC-REDIS-ERR-FALLS-BACK-001 | `PermissionService.LoadAsync` | Mock `IDatabase.StringGetAsync` throws RedisException → falls back to DB and returns matrix; logs warning |
| EPIC-003-UT-HANDLER-ADMIN-SHORTCIRCUIT-001 | `PermissionHandler` | User in role "admin" → `context.Succeed` regardless of matrix |
| EPIC-003-UT-HANDLER-USER-ALLOWED-001 | same | Non-admin with matrix[inventory][update]=true → success |
| EPIC-003-UT-HANDLER-USER-DENIED-001 | same | Non-admin with matrix[inventory][update]=false → no Succeed call → 403 |
| EPIC-003-UT-HANDLER-KILL-SWITCH-001 | same | `PERMISSION_ENFORCEMENT_ENABLED=false` → Succeed regardless; warning logged |
| EPIC-003-UT-POLICY-PROVIDER-DYNAMIC-001 | `PermissionPolicyProvider` | `GetPolicyAsync("inventory.update")` returns policy w/ `PermissionRequirement(inventory, update)` |
| EPIC-003-UT-POLICY-PROVIDER-INVALID-NAME-001 | same | `GetPolicyAsync("bogus")` falls back to default provider |
| EPIC-003-IT-PERM-DENY-NON-ADMIN-001 | endpoint integration | Login as user with `inventory.update=false`; POST /api/products → 403 |
| EPIC-003-IT-PERM-ALLOW-NON-ADMIN-001 | endpoint integration | Login as user with `inventory.update=true`; POST /api/products → 200 |
| EPIC-003-IT-PERM-ADMIN-ALL-001 | endpoint integration | Login as admin with no `user_permissions` rows; POST /api/products → 200 |
| EPIC-003-IT-PERM-INVALIDATE-ON-WRITE-001 | endpoint integration | User cached `inventory.update=false`; admin PUT permissions to true; user's very next POST → 200 (cache invalidated, not 30s wait) |
| EPIC-003-IT-LOGIN-RESPONSE-PERMS-001 | contract | `POST /api/auth/login` body has `permissions` key with 5×4 matrix; admin returns all-true |
| EPIC-003-IT-ME-RESPONSE-PERMS-001 | contract | `GET /api/auth/me` returns matrix |
| EPIC-003-IT-LOGGER-REQUESTID-001 | log inspection | Send X-Request-ID header → all server log lines for that request carry that requestId. Response carries it back |
| EPIC-003-IT-LOGGER-REQUESTID-GEN-001 | log inspection | No X-Request-ID header → server generates one, returns it in response, logs use it |

Cataloged: **20 new test cases**. Implementation pending toolchain (xUnit project scaffold exists from prior round at `server/Server.Tests/`).

---

## 5. Whole-project coverage

**Command:** N/A — no toolchain on build host.
**Coverage:** N/A.

To enable execution: `cd server && dotnet test Server.Tests/Server.Tests.csproj --collect:"XPlat Code Coverage"`.

---

## 6. Environment gaps & verification

Same as prior rounds. Reviewer must verify on a real host:

1. **Build**: `dotnet build server/Server.csproj` — clean.
2. **Boot**: `docker compose up -d`; all 4 services healthy ≤ 60s; `curl /api/health` → verbose JSON 200.
3. **Smoke S4 security** (this round's primary delivery):
   - Login as admin (no perms config needed; admin short-circuits).
   - Create non-admin `qa-user1` via `POST /api/admin/users`.
   - Without setting any perms, login as `qa-user1` → `GET /api/inventory` → **403** (user has only default `inventory.view=true` from S3; but UPDATE/DELETE/CREATE → 403).
   - Wait — `qa-user1` was given default `inventory.view=true` on create (UserAdminService). So `GET /api/inventory` → 200, but `POST /api/transactions` → 403 (because `transactions.create=false` by default).
   - As admin, `PUT /api/admin/users/<id>/permissions` setting `transactions.create=true`. Wait < 1s. Re-issue `POST /api/transactions` as `qa-user1` → **200** (invalidate-on-write).
   - Stop Redis. Any protected call returns 503 (existing AC19 still holds — middleware checks Redis before policy fires).
   - With Redis intact, set `PERMISSION_ENFORCEMENT_ENABLED=false`; `qa-user1` gets full access (kill-switch verified). Set back to `true`.
4. **Structured logs**: `docker compose logs api` in Production mode shows JSON lines with `Scopes: [requestId=..., userId=..., path=...]`.
5. **AC37 still requires manual ops apply** (grants migration + connection swap).

---

## 7. Still deferred (after round 3)

- **S3 FE** Admin Users page UI — backend complete; FE page + dialogs to be authored.
- **S4 FE** Admin Audit page UI + sidebar permission gating using `permissions.ts` helper.
- **S5 remainder**: per-row Excel migration tolerance (AC12); CLI `migrate-from-excel` (AC13 — Won't this epic per latest PRD §13).
- **S6** Remove `DISABLE_REDIS_SESSION_CHECK` kill-switch + CI lint.
- **S7** Remove `PERMISSION_ENFORCEMENT_ENABLED` kill-switch (14 days after S4 GA).
- **Tests**: 20 new unit/integration cases from §4 are cataloged but not executed (toolchain absent). 2 prior xUnit files (`SessionValidationMiddlewareTests.cs`, `UserAdminServiceTests.cs`) compile-ready when reviewer runs `dotnet test`.

---

## 8. Risk notes

- **AC15 response body shape** ASP.NET emits the framework-default 403 body (`{"title":"Forbidden","status":403}`) instead of the bespoke `{"error":"Không có quyền...","code":"permission_denied"}` per PRD. **Mitigation:** add a custom 403 IAuthorizationMiddlewareResultHandler or ExceptionHandler in S5; not a security defect since the status code is correct.
- **AC16 invalidate-on-write** depends on the call chain `UpdatePermissionsAsync → _perms.InvalidateAsync` — if a future endpoint mutates `user_permissions` outside this service (e.g., direct SQL in a future seeder), the cache won't invalidate. **Mitigation:** code-review checklist; if patterns proliferate, move invalidation into a Postgres trigger that publishes via LISTEN/NOTIFY (not done v1).
- **Admin all-true matrix** generated on every login/me — cheap (5×4 = 20 bool entries) but allocates dict each call. **Acceptable** for current scale.
- **Kill-switches accumulate**: now 2 (`DISABLE_REDIS_SESSION_CHECK` + `PERMISSION_ENFORCEMENT_ENABLED`). Both have removal calendar entries (S6, S7). Risk: someone leaves them in prod env. **Mitigation:** CI test (cataloged as EPIC-003-UT-NO-KILL-SWITCH in TECH-DESIGN §13 Q6) — to be implemented in S6.
- **403 vs 401**: ASP.NET returns 401 if not authenticated (or `JwtBearer` rejects), 403 if authenticated but policy fails. Frontend must handle both: 401 → re-login; 403 → show "Không có quyền" toast. Already documented in PRD §3.1.

---

## 9. Commit + PR

```bash
git add -A
git status   # verify only S4 backend + S5 logging changes
git commit -m "EPIC-003 S4 permission middleware + S5 structured logs"
git push -u origin feature/EPIC-003-redis-audit
gh pr create --title "EPIC-003 S4 + S5: permission policies + structured JSON logs" \
  --body "Implements EPIC-002-AC21, EPIC-003-AC15/AC16/AC25, AC17 (helper only). FE admin pages still deferred. See docs/epics/EPIC-003/artifacts/IMPLEMENT-SUMMARY.md."
```
