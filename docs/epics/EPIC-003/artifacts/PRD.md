# PRD — EPIC-003: Hoàn thiện EPIC-002 (Re-update) — **v2 (refresh)**

**Epic ID:** EPIC-003
**Title:** Reupdate EPIC-002 — kiểm tra lại và hoàn tất các phần chưa hoạt động
**Owner:** Product Owner
**Status:** Draft v2 (refresh 2026-06-13) — reflects 2 implement rounds done; remaining scope sharpened
**Predecessor:** EPIC-002

---

## 0. Why this revision (v1 → v2)

v1 of this PRD assumed nothing of EPIC-002 was done besides Postgres conversion. Since v1, **two implement rounds** landed on `feature/EPIC-003-redis-audit`:
- Round 1: **S1 (Redis session + logout + lockout)** + **S2 (audit logger)** + partial **S5 polish (CORS allowlist + verbose health + DB grants SQL)**.
- Round 2: **S3 backend (admin user CRUD + permissions + reset-pw + force-logout-all)** + **S4 backend (audit query endpoint)** + more **S5 polish (Db retry, 409 on duplicate SKU)**.

v2 sharpens scope to the **remaining gap only** and removes redundant context for work already shipped. The "Definition of Done" (§12) is the new gating contract.

---

## 1. Current state (audit, refreshed 2026-06-13)

### 1.1 DONE on the branch

| AC | Where |
|---|---|
| **EPIC-002-AC01** Postgres schema | `server/Db/001_schema.sql` |
| **AC02** GET /api/inventory reads Postgres | `PostgresStore.cs` |
| **AC05** 409 on dup SKU | `Program.cs` POST /api/products wraps `23505` |
| **AC06** docker-compose 4 services healthy | `docker-compose.yml` |
| **AC07** .gitignore + .env.example | OK |
| **AC09** API waits for Postgres at boot | `Db.OpenWithRetryAsync` |
| **AC10** Excel migration first-boot | `Program.cs` bootstrap |
| **AC11** Migration idempotent | `migration_state` table |
| **AC14, AC15** Login + JWT + no-enum-401 | `Program.cs` `/api/auth/login` |
| **AC16** Lockout 5/15min | `LoginThrottle` |
| **AC17** Logout invalidates session | `Program.cs` `/api/auth/logout` + `SessionStore.RevokeAsync` |
| **AC18** Missing session → 401 | `SessionValidationMiddleware` |
| **AC19** Redis down → 503 fail-secure ⚠️ GATE | middleware catch RedisException |
| **AC20** X-Role header bypass impossible ⚠️ GATE | uses `ClaimsPrincipal` only |
| **AC22..AC28** Admin user CRUD + perms + reset-pw | `UserAdminService` + `/api/admin/users/*` |
| **AC29** Force change first login | FE `ChangePasswordDialog` |
| **AC30** Force logout-all | `SessionStore.RevokeAllForUserAsync` + endpoint |
| **AC31, AC32** Audit on every write + login lifecycle | `AuditLogger` calls everywhere |
| **AC33..AC36** Audit list endpoint + truncation + non-admin 403 + survives delete | `AuditQueryService` + `/api/admin/audit` |
| **AC37** Audit append-only at DB grant level ⚠️ GATE | `002_epic003_grants.sql` (pending ops apply) |
| **AC38, AC39, AC40** Sidebar fixed + dashboard colors | FE existing |
| **AC42** Logout invalidates all tabs | by definition once AC17 works |
| **AC43, AC44** Excel import/export via Postgres | `Program.cs` + `PostgresStore` + `ExcelStore.ParseProductsFromFileAsync` |
| **EPIC-003-AC03, AC05, AC06, AC07, AC10** | Db retry + verbose health + CORS allowlist + audit coverage + no-magic-strings |

### 1.2 Still NOT DONE (scope of remaining EPIC-003 work)

| AC | Gap | Slice |
|---|---|---|
| **EPIC-002-AC21** Per-permission denial 403 for non-admin endpoints | `user_permissions` table populated; **but server endpoints (GET /api/inventory, POST /api/transactions, etc.) don't consult it.** User role currently gets full read+write access — **security flaw still open** | S4 backend |
| **AC21 (FE)** Sidebar gating + hidden buttons by perms | No FE permission check | S4 FE |
| **AC22..AC30 (FE)** Admin user management page | No `/admin/users` page; only backend endpoints | S3 FE |
| **AC33 (FE)** Audit list page | No `/admin/audit` page; only backend | S4 FE |
| **AC41** Colorblind-safe chart palette | No chart in dashboard yet | S6 (could) |
| **AC12** Migration skip malformed Excel row | Current code catches batch error, not per-row | S5 polish |
| **AC13** CLI `migrate-from-excel` command | Not implemented | S5 polish |
| **EPIC-003-AC04** API resilience when Redis slow-starts mid-life | Partial (`AbortOnConnectFail=false` set) but no integration test | S5 polish |
| **EPIC-003-AC09** Audit page < 1s load 50 rows | Backend indexed; needs perf test once UI lands | S4 perf |
| **EPIC-003-AC13** "X phiên đang hoạt động" badge | Backend exposes `activeSessions`; FE doesn't display | S3 FE |
| **Structured JSON logs + requestId** | Not implemented | S5 polish |
| **Kill-switch cleanup PR** (`DISABLE_REDIS_SESSION_CHECK` removal) | Must happen 7 days post-S1 GA | S6 cleanup |

### 1.3 Risks carried forward (not yet mitigated)

1. **AC37 enforcement requires manual ops step**: the GRANT migration ships in `002_epic003_grants.sql` but Postgres runtime connection still uses owner role. Until ops applies the migration AND switches `POSTGRES_CONNECTION` to `inventory_app`, the audit table is **physically writable + deletable from app code**. This is the highest-risk operational gap.
2. **AC21 server-side enforcement missing**: non-admin users have full access to non-admin endpoints. Mitigation today: don't create non-admin users until S4 backend lands.

---

## 2. Refreshed Goal

Close the **3 remaining material gaps** before declaring EPIC-002 fully shipped:

1. **Per-permission server enforcement** (AC21 backend) — so creating non-admin users is safe.
2. **FE admin pages** (`/admin/users` + `/admin/audit`) — so admin can manage users without curl/Postman.
3. **Final polish + sign-off**: AC12 per-row Excel tolerance, AC13 CLI, kill-switch cleanup, AC37 ops runbook for the connection swap, structured logging with requestId.

Success criteria (Definition of Done — §12):
- ✅ 100% of EPIC-002 M+S ACs PASS on a staging build of EPIC-003.
- ✅ All 3 security gates verified end-to-end (AC19, AC20, AC37).
- ✅ FE admin pages usable by a non-technical admin without curl.
- ✅ Kill-switch removed from code.

---

## 3. Refined remaining user flows

### 3.1 Permission-gated user flow (M2 — AC21 backend + FE)

**Happy path (non-admin user with limited rights):**
1. Admin creates `qa-user1` with `inventory.view=true, inventory.update=false, transactions.view=true, transactions.create=true`.
2. `qa-user1` logs in → server returns `permissions` matrix in `MeResponse` / `LoginResponse`.
3. FE renders sidebar: Dashboard, Inventory, Transactions visible. Reports, Users hidden.
4. On Inventory: user can view list (search works) but Edit/Delete buttons hidden. Trying to manually call `PUT /api/products` → server 403.
5. On Transactions: user can view + create. Cannot update/delete.

**Edge / error:**
- Admin updates permissions while user is online → user's next request (or next 30s) sees new perms (Redis cache TTL 30s; **or** invalidate cache on PUT for instant effect — design decision deferred to TL).
- User clears localStorage + token gone → forced login.
- Server response 403 → FE toast "Không có quyền".

### 3.2 Admin manages users in UI (M3 — AC22..AC30 FE)

**Happy path (admin):**
1. Login as admin → see sidebar item "Quản trị users".
2. `/admin/users` → table of all active users with columns: Username, Tên, Vai trò, Phiên đang hoạt động, Tạo lúc, Actions (Edit / Reset PW / Logout all / Delete).
3. Click "Thêm user" → dialog: username, full name, role (admin/user), temp password → Save → success toast → row appears.
4. Click "Phân quyền" on a user → matrix dialog 5×4 checkboxes → Save → toast + audit row.
5. Click "Reset PW" → confirm → one-time-display modal with temp pw + copy button.
6. Click "Logout khỏi mọi thiết bị" → confirm → toast with count revoked.
7. Click "Xoá" → confirm → soft-delete; row disappears; audit row written.

**Edge:**
- Self-delete attempt → 400 toast.
- Delete last admin → 400 toast "Phải còn ít nhất 1 admin".
- Reset PW dialog closed without copying → admin must re-issue reset.
- Duplicate username → 409 toast.

### 3.3 Audit log viewing in UI (M4 — AC33 FE)

**Happy path:**
1. Admin → "Audit log" in sidebar → `/admin/audit`.
2. Filter bar: date-from, date-to, actor (username dropdown auto-complete), action (dropdown from `AuditActions`), resource-type (dropdown).
3. Apply filter → 50 newest rows; click row → modal shows `before_json` / `after_json` diff (side-by-side).
4. "Tải thêm" button uses `nextCursor` for pagination.

**Edge:**
- Filter > 10,000 rows → banner "Kết quả lớn, hãy thu hẹp filter".
- User without admin role tries `/admin/audit` URL → server 403 + FE redirect to `/dashboard`.

---

## 4. Acceptance Criteria — v2 (only NEW or REVISED items)

> Pre-existing AC EPIC-002-AC01..AC44 and EPIC-003-AC01..AC14 unchanged. The list below adds clarifications for what's STILL pending after round 2.

| ID | Priority | AC |
|---|---|---|
| **EPIC-003-AC15** | M | **Given** a non-admin user with `inventory.update=false`, **When** they call `PUT /api/products` (or any product write), **Then** server returns 403 with `{error:"Không có quyền chỉnh sửa kho", code:"permission_denied"}`. Server reads `user_permissions` (Redis cache TTL 30s + DB fallback). |
| **EPIC-003-AC16** | M | **Given** admin updates a user's permissions, **When** that user makes a request within 30s of the update, **Then** the new permissions take effect (cache invalidated on write OR 30s TTL). |
| **EPIC-003-AC17** | M | **Given** FE has `currentUser.permissions` from `/api/auth/me`, **When** sidebar renders, **Then** menus with `view=false` are hidden; action buttons (Edit/Delete) with corresponding action=false are hidden. |
| **EPIC-003-AC18** | M | **Given** admin clicks "Thêm user" on `/admin/users`, **When** they fill valid input and submit, **Then** user appears in table; FE refreshes from server (no optimistic insert). |
| **EPIC-003-AC19** | M | **Given** admin clicks "Phân quyền", **When** modal opens, **Then** matrix pre-filled from server; Save calls PUT and refreshes; on success toast "Đã cập nhật quyền". |
| **EPIC-003-AC20** | M | **Given** admin clicks "Reset password", **When** confirm, **Then** one-time-display modal shows the temp pw with a "Copy" button; closing the modal without copying does NOT preserve the pw anywhere on screen. |
| **EPIC-003-AC21** | M | **Given** admin opens `/admin/audit`, **When** page loads with no filter, **Then** 50 newest rows render within 1s; pagination via "Tải thêm"; filter form has 4 fields. |
| **EPIC-003-AC22** | M | **Given** EPIC-003 done, **When** ops applies `002_epic003_grants.sql` + switches `POSTGRES_CONNECTION` to `inventory_app`, **Then** `psql -U inventory_app -c "UPDATE audit_logs..."` returns permission denied. |
| **EPIC-003-AC23** | M | **Given** kill-switch `DISABLE_REDIS_SESSION_CHECK` cleanup PR merged, **When** grep `DISABLE_REDIS_SESSION_CHECK` across `server/**/*.cs`, **Then** 0 matches (env var no longer honored). |
| **EPIC-003-AC24** | S | **Given** Excel migration encounters row with missing `maSKU`, **When** migrating, **Then** that row is skipped with a WARN log; other rows migrate; final summary shows `migrated=N, skipped=M`. |
| **EPIC-003-AC25** | S | **Given** structured logger configured, **When** any request lands, **Then** log line is JSON with at least `{level, ts, requestId, userId, path, status, latencyMs}`. |
| **EPIC-003-AC26** | C | **Given** `/admin/users` row, **When** rendering, **Then** badge shows "X phiên đang hoạt động" using `activeSessions` from server. |
| **EPIC-003-AC27** | S | **Given** ops runbook exists at `docs/runbook/epic-003-ops.md`, **When** ops reads it, **Then** procedures are documented for: applying grants migration, swapping POSTGRES_CONNECTION, rotating JWT_SECRET (with cleanup of all Redis sessions), resetting root admin via CLI, archiving audit older than 2 years. |
| **EPIC-003-AC28** | W | CLI `migrate-from-excel` — postponed to a future epic. |

---

## 5. UI / Design (only NEW pages)

### Sidebar (modify existing)
- Item visibility map: `Dashboard` always, `Quản lý kho` requires `inventory.view`, `Xuất nhập kho` requires `transactions.view`, `Tìm kiếm` always, `Báo cáo` requires `reports.view`, **NEW** `Quản trị users` requires `role==='admin'`, **NEW** `Audit log` requires `role==='admin'`.

### `/admin/users`
- Table: `Username | Tên | Vai trò | Phiên hoạt động | Tạo lúc | Actions`.
- "Thêm user" button top-right → `UserFormDialog`.
- Per-row icons: Pencil (edit name only), Shield (permissions), Key (reset pw), LogOut (logout-all), Trash (delete).
- Use shadcn `Table`, `Dialog`, `Switch` (for matrix).

### `/admin/audit`
- Filter bar: 4 inputs in 1 row (Date range picker, actor combobox, action select, resource-type select) + Apply / Clear.
- Table: `Thời gian | Actor | Hành động | Resource | IP`.
- Row click → `AuditDiffDialog` with side-by-side JSON (or unified diff).
- "Tải thêm" button at bottom; truncated banner if > 10k.

### `PermissionMatrix` component
- 5 menu rows × 4 action columns grid of checkboxes.
- "Tất cả" toggle per row.
- Save / Cancel buttons; Save POSTs the full matrix.

### `ResetPasswordDialog`
- Show temp pw in a monospace `<code>` block.
- "Copy" button using `navigator.clipboard.writeText`.
- Big warning: "Mật khẩu sẽ KHÔNG hiển thị lại sau khi bạn đóng dialog này".
- On close, blank the state.

---

## 6. NFR delta

Unchanged from v1 §7 except:
- **Performance** for permission check: ≤ 5ms p99 overhead per request (Redis cache hit). Cache miss + DB lookup: ≤ 15ms p99.
- **A11Y**: all new dialogs use Radix focus trap (built-in to shadcn); permission matrix labels associate `<label>` with each checkbox; "Copy" button announces to screen reader.

---

## 7. Analytics — new events for FE pages

| Event | Trigger | Properties |
|---|---|---|
| `admin.users.viewed` | `/admin/users` mounts | `actorId` |
| `admin.audit.viewed` | `/admin/audit` mounts | `actorId` |
| `admin.audit.filter` | Apply filter clicked | `actorId, filterScope` (which fields populated, NOT the values) |
| `admin.permissions.modal_opened` | Open perms modal | `actorId, targetId` |

Project still has no analytics pipeline — these are schema only, deferred wire-up.

---

## 8. Dependencies

| Dep | Status |
|---|---|
| `LoginResponse.permissions` field added by S4 backend | NOT YET — currently missing |
| `MeResponse.permissions` field added by S4 backend | NOT YET |
| `PermissionService` (Redis cache + DB load) | NOT YET — backend dependency for AC15+AC16 |
| Permission policy registration in `Program.cs` | NOT YET — backend dependency |
| shadcn `Dialog`, `Table`, `Switch`, `Checkbox` | Already in project |

---

## 9. Rollout (refresh)

### Remaining slices

| Slice | PR title | Adds | Touches | Estimated risk |
|---|---|---|---|---|
| **S4-backend** | `EPIC-003 S4 permission middleware` | `PermissionService.cs`, `PermissionRequirement.cs`, `PermissionHandler.cs`, policy registrations, extend `LoginResponse`/`MeResponse` with `permissions` | `Program.cs`, new BE files | Medium — affects every protected endpoint |
| **S4-FE** | `EPIC-003 S4 admin audit page + sidebar gating` | `/admin/audit` page, sidebar gating | `App.tsx`, new components | Low |
| **S3-FE** | `EPIC-003 S3 admin users page` | `/admin/users` + dialogs | new components | Low |
| **S5-final** | `EPIC-003 S5 polish: per-row migration + structured logs + runbook` | row-level Excel tolerance, JSON logger, ops runbook | `ExcelStore.cs`, `Program.cs`, new docs file | Low |
| **S6** | `EPIC-003 S6 cleanup: remove kill-switch` | Remove `DISABLE_REDIS_SESSION_CHECK` env handling | `SessionValidationMiddleware.cs`, `.env.example` | Low — cleanup |

### Gate: ops manual steps before S4-backend GA

1. Apply `002_epic003_grants.sql` (verified by SC-25 in TEST-SCRIPT).
2. Switch `POSTGRES_CONNECTION` env to use `inventory_app` user.
3. Verify on staging that audit table can no longer be UPDATE/DELETEd via app role.

### Kill-switch

- `DISABLE_REDIS_SESSION_CHECK` remains until 7 days after S1 verified in prod.
- S6 PR scheduled with a calendar reminder; auto-PR via GitHub Actions optional.

---

## 10. Open questions (refresh)

| # | Question | Owner |
|---|---|---|
| 1 | **Permission cache invalidation strategy**: invalidate on write (instant) or TTL only (≤30s)? Affects AC16. | TL — recommend invalidate-on-write because cheap |
| 2 | Should `/admin/users` allow editing `fullName` after creation? PRD §3.2 step says yes; backend currently doesn't have a `PUT /api/admin/users/{id}` endpoint. Add it in S3-FE round. | PO |
| 3 | Should we keep the user's old hash on reset (for audit forensic) or only the new one? Currently only new (no history). | Compliance (Legal) |
| 4 | `actor_username` is denormalized in `audit_logs` — confirm legal/audit team is OK with snapshot (not joined to current users table). | Legal |
| 5 | Where to surface `must_change_password=true` users in /admin/users — column "Cần đổi PW" or icon? | Designer |
| 6 | S6 kill-switch cleanup — should we add a CI lint that fails the build if `DISABLE_REDIS_SESSION_CHECK` re-appears? | TL |

---

## 11. Handoff

- **Next agent (per pipeline):** Tech Lead → update TECH-DESIGN.md with §9 slice details + permission cache invalidation answer (Q1).
- Then: QA → extend TEST-PLAN.md with cases for AC15..AC27 (most already drafted; AC15/16 NEED IT tests for permission enforcement).
- Then: Developer → ship S4-backend → S4-FE → S3-FE → S5-final → S6 cleanup.
- Then: QA × 2 — execute-test rounds.

---

## 12. Definition of Done (revised)

EPIC-003 closes when ALL of the following are true:

- [ ] Every M+S AC in EPIC-002 (44) AND every M+S AC in EPIC-003-v2 (now AC01..AC27, ignoring W) PASS on staging.
- [ ] **3 security gates** verified end-to-end on staging:
  - [ ] AC19 Redis-down — verified by SC-10 of TEST-SCRIPT
  - [ ] AC20 X-Role bypass — verified by SC-11 + grep
  - [ ] AC37 audit append-only — verified by SC-25 with `inventory_app` role
- [ ] FE admin pages live (`/admin/users`, `/admin/audit`).
- [ ] Permission middleware enforces non-admin restrictions on **every** non-admin endpoint.
- [ ] `DISABLE_REDIS_SESSION_CHECK` kill-switch removed from code (S6 PR merged).
- [ ] Ops runbook at `docs/runbook/epic-003-ops.md` reviewed by ops.
- [ ] Production deployed with `POSTGRES_CONNECTION=inventory_app`.
- [ ] 0 security blocker incidents in first 30 days post-prod.

---

## 13. Diff vs v1

What changed in this refresh:

- **§1 inventory** rewritten — most EPIC-002 ACs moved from "TODO" to "DONE" based on 2 implement rounds.
- **§2 Goal** narrowed to 3 remaining material gaps (was "all of EPIC-002").
- **§4 ACs** added EPIC-003-AC15..AC28 to cover the remaining surface explicitly (mostly FE + permission enforcement).
- **§9 Rollout** slice list updated: S4-backend / S4-FE / S3-FE / S5-final / S6 cleanup. S1+S2+S3-backend + S5-partial removed (done).
- **§12 DoD** rewritten — concrete checkbox list mapping back to security gates and FE coverage.
- **Removed**: v1 §3 (user flows for already-done modules), v1 §6 NFR repeat (now delta only).
