# PRD — EPIC-004: Nâng cấp quản lý User

**Epic ID:** EPIC-004
**Title:** Nâng cấp quản lý User — admin UI cho CRUD user + phân quyền per-feature
**Owner:** Product Owner
**Status:** Draft v1
**Last updated:** 2026-06-13
**Related epics:** EPIC-002 (auth foundation), **EPIC-003** (admin backend endpoints + permission middleware) — predecessor

---

## 0. Context

EPIC-003 đã hoàn thiện backend cho admin user management + permission enforcement (round 2 + round 3 ship trên branch `feature/EPIC-003-redis-audit`):
- `GET/POST/DELETE /api/admin/users`, `GET/PUT /api/admin/users/{id}/permissions`, `POST /api/admin/users/{id}/reset-password`, `POST /api/admin/users/{id}/logout-all` — đã live.
- `LoginResponse` + `MeResponse` đã trả về `permissions` matrix.
- Permission policy provider + `RequirePermission()` đã enforce per-endpoint 403 cho non-admin.

**EPIC-004 là phần UI còn thiếu.** Admin hiện tại phải dùng curl/Postman để quản lý user → không phù hợp cho operations hàng ngày.

---

## 1. Problem & Goal

### Problem
Admin nội bộ cần **giao diện UI** để:
- Tạo / xoá / sửa user (đổi tên đầy đủ, vai trò).
- Đổi mật khẩu user (reset by admin → temp pw 1 lần).
- Phân quyền chi tiết per-feature (5 menu × 4 action) cho mỗi user.
- Force-logout user khỏi mọi thiết bị khi cần (incident response).

Hiện tại không có UI nào cho các thao tác này. Mỗi lần admin muốn tạo user mới hoặc đổi quyền → phải mở Postman + nhớ JWT token + viết curl. Lỗi cao, không có audit visible cho admin.

### Goal

| Loại | Chỉ số | Mục tiêu |
|---|---|---|
| Adoption | % admin actions thực hiện qua UI (vs curl/SQL) | **100%** sau 1 tuần release |
| Task time | Thời gian tạo 1 user mới (login → user created) | ≤ **60 giây** |
| Task time | Thời gian set permission matrix cho 1 user | ≤ **90 giây** |
| Error | Tỉ lệ user-management action sai (dùng nhầm user / sai role / sai pw) | < 5% |
| Adoption | % new user accounts được tạo bởi UI (vs trực tiếp SQL) | **100%** |

### Why now

- EPIC-003 backend đã sẵn sàng. Mỗi tuần delay = mỗi tuần admin tốn thời gian curl + nguy cơ thao tác sai (admin gõ sai SKU / sai role).
- Without UI, không thể đào tạo user admin mới (operations người mới sẽ không biết curl).
- Audit log lúc làm qua curl không capture được full context (chỉ thấy actor + action, không thấy intent). UI sẽ ensure đúng workflow.

---

## 2. Scope

### In-scope

#### Trang `/admin/users` (Quản trị users)

1. **Danh sách user**: bảng paginated (nếu > 50) hiển thị:
   - Username
   - Tên đầy đủ
   - Vai trò (badge: Admin / User)
   - Phiên đang hoạt động (badge số)
   - Phải đổi password (icon nếu `mustChangePassword=true`)
   - Tạo lúc (relative time + tooltip absolute)
   - Actions: Edit / Phân quyền / Reset PW / Logout-all / Xoá
2. **Nút "Thêm user"** ở header trang.
3. **Dialog Thêm user**: form 4 fields (Username, Tên đầy đủ, Vai trò, Mật khẩu tạm) → POST `/api/admin/users` → refresh list.
4. **Dialog Sửa user** (PATCH `fullName`): chỉ cho phép sửa Tên đầy đủ. Username + Role không sửa được (immutable design choice cho v1).
5. **Dialog Phân quyền**: matrix 5×4 checkbox. Có "Tất cả" toggle per row. Save → PUT → refresh list (cache đã invalidate-on-write từ EPIC-003).
6. **Dialog Reset PW**: confirm → POST → modal hiển thị temp pw 1 lần với nút "Copy" + cảnh báo "Không hiển thị lại". Đóng modal blank state.
7. **Action Logout-all**: confirm dialog → POST → toast "Đã đăng xuất X phiên".
8. **Action Xoá** (soft-delete): confirm dialog với cảnh báo + "Hủy" button → DELETE → refresh.

#### Sidebar gating (use existing helper từ EPIC-003)

- Menu item "Quản trị users" chỉ hiện khi `role === 'admin'`.

### Out-of-scope (v1)

- Bulk edit / bulk delete user.
- Restore deleted user (admin phải dùng SQL trong v1).
- Đổi username (immutable trong v1).
- Đổi role admin ↔ user sau khi tạo (immutable trong v1 — admin phải xoá + tạo lại nếu cần đổi).
- Filter / search user trong table (sẽ làm khi > 50 user).
- Export user list ra Excel.
- "Cần đổi pw" filter row.
- Audit log viewing (đó là EPIC riêng — không gộp ở đây).
- Permission template / role copy (copy quyền của user A sang user B).

### Target users
- **Admin nội bộ** (≤ 5 người).

---

## 3. User Flow

### 3.1 Happy path — Tạo user mới

1. Admin login → sidebar có item "Quản trị users".
2. Click → vào `/admin/users` → bảng list.
3. Click "Thêm user" (top-right, primary button) → dialog mở.
4. Điền username (lowercase, 3-32 chars, alphanumeric + `_` `-`), full name, role (dropdown admin/user), temp password (≥ 8 chars).
5. Click "Lưu". Disabled state hiện trên button. Loading spinner.
6. Server returns 201 → toast "Đã tạo user 'qa-user1'" → dialog đóng → bảng refresh → row mới xuất hiện.
7. Admin chia sẻ temp password với user qua kênh ngoài.

### 3.2 Happy path — Phân quyền

1. Trên row của user → click icon Shield (Phân quyền).
2. Dialog mở với matrix 5×4. Hiện trạng các checkbox đúng với DB hiện tại (fetched từ `GET /api/admin/users/{id}/permissions`).
3. Admin tick/untick. Có thể click "Tất cả" trên đầu mỗi row để toggle full row.
4. Click "Lưu". Loading state.
5. Server returns 200 + audit log → toast "Đã cập nhật quyền" → dialog đóng.
6. Nếu user đó đang online → request kế của họ thấy quyền mới ngay (invalidate-on-write — đã có ở EPIC-003).

### 3.3 Happy path — Reset password

1. Trên row → click icon Key.
2. Confirm dialog: "Bạn có chắc muốn reset password cho user 'qa-user1'? Tất cả phiên hiện tại sẽ bị đăng xuất."
3. Confirm → POST → modal mới hiện temp pw trong `<code>` monospace 16 chars + "Copy" button + cảnh báo đỏ "Mật khẩu này chỉ hiển thị 1 LẦN. Không thể xem lại sau khi đóng."
4. Admin click "Copy" → clipboard có pw → tooltip "Đã copy".
5. Đóng modal → state blank.

### 3.4 Happy path — Xoá user

1. Trên row → click icon Trash (red).
2. Confirm dialog với username highlighted: "Xoá user 'qa-user1'? Toàn bộ phiên đăng nhập sẽ bị thu hồi. Audit log của user vẫn được giữ. Hành động này có thể khôi phục qua SQL trong v1."
3. Confirm → DELETE → toast "Đã xoá user" → row biến mất.

### 3.5 Error / edge paths

| Tình huống | Behavior |
|---|---|
| Tạo user username trùng | Server 409 → toast đỏ "Username đã tồn tại". Form giữ input. |
| Tạo user pw < 8 ký tự (client-side validate) | Inline error + disable Save. |
| Tạo user role không hợp lệ (client-side validate dropdown) | N/A — dropdown chỉ có admin/user. |
| Phân quyền: server 400 (menu/action không hợp lệ) | Toast đỏ với message từ server. Matrix giữ unsaved changes. |
| Phân quyền: mạng fail | Toast "Không thể lưu, mạng có vấn đề". Retry button. |
| Reset pw: server fail | Toast đỏ. Không hiển thị temp pw mock. |
| Reset pw: admin nhấn Esc giữa lúc đang hiển thị temp pw | Modal đóng — pw biến mất, không cách nào xem lại. |
| Xoá: admin tự xoá mình | Server 400 → toast "Không thể tự xoá tài khoản của mình." |
| Xoá: admin cuối cùng | Server 400 → toast "Phải còn ít nhất 1 admin." |
| Logout-all: user đang xem ở browser khác | Trong 2s sẽ thấy 401 (existing AC42 behavior). UI: confirm + toast với count. |
| Token hết hạn giữa flow | API call 401 → tự redirect login (existing app behavior). Dialog đóng. |
| User vào URL `/admin/users` không có role admin | Server endpoint trả 403 trên bất kỳ request nào → FE redirect `/dashboard` + toast "Không có quyền". |
| Bảng rỗng (chỉ có admin gốc) | "Chưa có user nào ngoài admin gốc. Click 'Thêm user' để tạo." |

### 3.6 Recovery paths

- Network drop khi đang điền dialog → form data giữ trong state component; submit again khi mạng restored.
- Admin lỡ đóng dialog reset-pw mà chưa copy → phải reset lại lần nữa (no recovery — đây là tính bảo mật).
- Soft-deleted user cần khôi phục → manual SQL `UPDATE users SET deleted_at = NULL WHERE id = X` (documented in ops runbook).

---

## 4. Acceptance Criteria

Priority: M=Must, S=Should, C=Could, W=Won't.

### List page

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC01 | M | **Given** admin login, **When** xem sidebar, **Then** menu "Quản trị users" hiển thị; user role không thấy menu này. |
| EPIC-004-AC02 | M | **Given** admin vào `/admin/users`, **When** trang load, **Then** trong ≤ 1 giây bảng hiện list user từ `GET /api/admin/users`, cột: Username, Tên đầy đủ, Vai trò badge, Phiên hoạt động, Tạo lúc, Actions. |
| EPIC-004-AC03 | M | **Given** non-admin user gõ URL `/admin/users`, **When** request, **Then** trang redirect về `/dashboard` + toast "Không có quyền truy cập". |
| EPIC-004-AC04 | S | **Given** > 0 user `mustChangePassword=true`, **When** render, **Then** row có icon Key-Alert ở cột Username (tooltip "Cần đổi mật khẩu"). |
| EPIC-004-AC05 | S | **Given** bảng có data, **When** render, **Then** column "Phiên hoạt động" hiện số từ `activeSessions` server-side. |

### Create user

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC06 | M | **Given** admin click "Thêm user", **When** dialog mở, **Then** form có 4 inputs (Username, Full name, Role select, Temp password) + nút Lưu/Hủy. |
| EPIC-004-AC07 | M | **Given** form valid input, **When** click Lưu, **Then** POST `/api/admin/users` → 201 → dialog đóng → row mới xuất hiện trong bảng → toast success. |
| EPIC-004-AC08 | M | **Given** username < 3 hoặc > 32 hoặc chứa ký tự ngoài `a-z0-9_-`, **When** blur input, **Then** inline error đỏ. Nút Lưu disabled. |
| EPIC-004-AC09 | M | **Given** password < 8 ký tự, **When** blur input, **Then** inline error "Mật khẩu phải có ít nhất 8 ký tự". |
| EPIC-004-AC10 | M | **Given** server trả 409 (duplicate username), **When** submit, **Then** toast đỏ "Username đã tồn tại". Form giữ input để admin sửa. |
| EPIC-004-AC11 | S | **Given** form đang submit, **When** click Lưu lần 2, **Then** button disabled + spinner. Không double-submit. |

### Edit user (PATCH fullName) — depends on backend endpoint

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC12 | M | **Given** admin click icon Pencil trên row, **When** dialog mở, **Then** field "Tên đầy đủ" pre-filled. Username + Role hiện ra **read-only** (greyed). |
| EPIC-004-AC13 | M | **Given** thay đổi fullName, **When** click Lưu, **Then** PATCH `/api/admin/users/{id}` với `{fullName}` → row cập nhật. |
| EPIC-004-AC14 | S | **Given** admin không thay đổi gì, **When** click Lưu, **Then** nút Lưu disabled (no diff). |

> Note: PATCH endpoint sẽ được thêm trong S3 FE backend phụ trợ (small backend addition documented in EPIC-003 TECH-DESIGN §13 Q2).

### Permissions matrix

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC15 | M | **Given** admin click icon Shield trên row user, **When** dialog mở, **Then** GET `/api/admin/users/{id}/permissions` → 5×4 = 20 checkbox pre-filled. |
| EPIC-004-AC16 | M | **Given** matrix dialog, **When** click checkbox, **Then** state local thay đổi; nút Lưu enabled (có diff vs server). |
| EPIC-004-AC17 | M | **Given** click Lưu, **When** PUT `/api/admin/users/{id}/permissions`, **Then** 200 → dialog đóng → toast "Đã cập nhật quyền". |
| EPIC-004-AC18 | S | **Given** matrix có "Tất cả" toggle trên đầu mỗi menu row, **When** click, **Then** 4 checkboxes của row đó toggle đồng loạt. |
| EPIC-004-AC19 | M | **Given** matrix là user role (không phải admin), **When** render, **Then** all 20 checkboxes có thể tick. (Admin row không gắn permissions — backend short-circuit.) |
| EPIC-004-AC20 | M | **Given** target user là admin, **When** open Permissions dialog, **Then** **không cho mở** — toast "Admin có toàn quyền mặc định. Không thể chỉnh sửa quyền cho admin." OR show read-only "all enabled" view. |

### Reset password

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC21 | M | **Given** admin click icon Key trên row, **When** confirm dialog hiện, **Then** message chứa username target và cảnh báo "Tất cả phiên sẽ bị đăng xuất". |
| EPIC-004-AC22 | M | **Given** confirm Reset, **When** server returns temp pw, **Then** modal mới hiện temp pw 16 chars trong `<code>` monospace + nút "Copy". |
| EPIC-004-AC23 | M | **Given** modal đang hiển thị temp pw, **When** admin click Copy, **Then** `navigator.clipboard.writeText(tempPw)` → tooltip "Đã copy". |
| EPIC-004-AC24 | M | **Given** modal đóng (X / Esc / outside click), **When** đóng, **Then** state component blank — pw không lưu trữ ở bất kỳ React state nào sau khi modal close. |
| EPIC-004-AC25 | S | **Given** modal đang hiển thị, **When** admin reload trang, **Then** pw mất. (Same as AC24 — pw chỉ ở memory.) |

### Logout-all

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC26 | M | **Given** admin click icon LogOut trên row, **When** confirm dialog hiện, **Then** message chứa username. |
| EPIC-004-AC27 | M | **Given** confirm, **When** POST `/api/admin/users/{id}/logout-all`, **Then** 200 → toast "Đã đăng xuất X phiên". Bảng refresh — `activeSessions` của user về 0. |

### Delete user

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC28 | M | **Given** admin click icon Trash, **When** confirm dialog hiện, **Then** message highlight username target + cảnh báo soft-delete behavior. |
| EPIC-004-AC29 | M | **Given** confirm xoá, **When** DELETE → 204, **Then** row biến mất + toast success. |
| EPIC-004-AC30 | M | **Given** admin xoá chính mình, **When** click confirm, **Then** server 400 → toast đỏ "Không thể tự xoá tài khoản của mình." Bảng không refresh. |
| EPIC-004-AC31 | M | **Given** chỉ còn 1 admin, **When** xoá admin đó, **Then** server 400 → toast "Phải còn ít nhất 1 admin." |

### Cross-cutting

| ID | Priority | AC |
|---|---|---|
| EPIC-004-AC32 | M | **Given** mỗi action UI (create/update/delete/permissions/reset/logout-all), **When** thành công, **Then** đã có audit log row được server ghi (verify qua /api/admin/audit nếu có endpoint, hoặc DB). |
| EPIC-004-AC33 | M | **Given** mạng fail giữa flow, **When** API call fail, **Then** toast đỏ "Không thể kết nối tới máy chủ" + dialog vẫn mở để retry. |
| EPIC-004-AC34 | M | **Given** token hết hạn giữa flow, **When** API trả 401, **Then** FE auto redirect login (existing behavior) — không hiển thị partial state. |
| EPIC-004-AC35 | W | Bulk operations — v2 |
| EPIC-004-AC36 | W | Restore soft-deleted user qua UI — v2 |
| EPIC-004-AC37 | W | Đổi username / role sau khi tạo — v2 |

---

## 5. UI / Design

Không có Figma. Theo shadcn/ui convention đã sử dụng trong project.

### Page layout

```
┌─ Header bar (existing) ─────────────────────────────────────────┐
├─ Sidebar (existing) ─┬─ Main content ──────────────────────────┤
│  Dashboard           │  Quản trị users            [+ Thêm user] │
│  Quản lý kho         │                                          │
│  Xuất nhập kho       │  ┌─ Table ────────────────────────────┐ │
│  Tìm kiếm            │  │ Username | Tên | Vai trò | Phiên | │ │
│  Báo cáo             │  │          |     |          |       | │ │
│► Quản trị users      │  │ ...                                │ │
│                      │  └────────────────────────────────────┘ │
└──────────────────────┴──────────────────────────────────────────┘
```

### Components (shadcn)

- `Table`, `Badge`, `Button`, `Dialog`, `Input`, `Label`, `Select`, `Checkbox`, `Tooltip`, `AlertDialog` (for destructive confirms).

### Icons (lucide-react, already in deps)

- `UserPlus` cho nút Thêm user
- `Pencil` Edit
- `Shield` Permissions
- `KeyRound` Reset PW
- `LogOut` Logout all
- `Trash2` Delete
- `KeyAlert` (or `AlertCircle` + Key combination) cho "Cần đổi pw"
- `Copy` Copy button

### Accessibility

- Mọi button có `aria-label` (icon-only buttons).
- Confirm dialogs dùng `AlertDialog` Radix (focus trap + Escape close).
- Matrix checkboxes có associated `<label>`.
- Temp pw modal: `aria-live="polite"` trên block hiển thị pw.

### Platform conventions

- Web shadcn (no native HIG).
- Keyboard: Tab → focus next input; Enter on Save button; Esc closes dialog.
- Color: destructive actions (Delete, Logout-all) use `variant="destructive"` (red).

---

## 6. Non-Functional Requirements

| Aspect | Requirement |
|---|---|
| Performance | Initial page load ≤ 1s on cable 10 Mbps with 50 users; ≤ 200ms response after click any action button (loading state shown if > 200ms). |
| Reliability | All API calls have explicit error handling (no swallow). |
| Security | Temp pw never in localStorage / sessionStorage / URL. Not logged. Server already enforces admin role. |
| Compatibility | Chrome ≥ 100, Edge ≥ 100. Safari/Firefox spot-check. |
| A11y | WCAG 2.1 AA: keyboard navigation, focus indicator, contrast ≥ 4.5:1, screen reader announces toasts. |
| i18n | vi-VN only. |
| Observability | Reuse `requestId` from EPIC-003 structured logs — no new FE logging in v1. |
| Offline | Banner "Mất kết nối" (existing pattern); disable action buttons. |

---

## 7. Analytics / Telemetry

Project chưa có analytics pipeline. Event schema for future:

| Event | Trigger | Properties |
|---|---|---|
| `admin.users.viewed` | `/admin/users` mounts | actorId |
| `admin.user.create.attempted` | Submit create dialog | actorId, role |
| `admin.user.create.succeeded` | 201 received | actorId, targetId |
| `admin.user.create.failed` | non-2xx | actorId, status, reason ("duplicate"/"validation"/"network") |
| `admin.permissions.modal_opened` | Open matrix | actorId, targetId |
| `admin.permissions.saved` | PUT 200 | actorId, targetId, changedCount |
| `admin.password.reset_clicked` | Reset button click | actorId, targetId |
| `admin.password.reset_copied` | Copy button | actorId |
| `admin.logout_all_invoked` | LogoutAll confirm | actorId, targetId, sessionsRevoked |
| `admin.user.deleted` | DELETE 204 | actorId, targetId |

---

## 8. Dependencies

### Internal (all from EPIC-003, must land before EPIC-004)

| Dep | Status |
|---|---|
| `GET /api/admin/users` | DONE (EPIC-003 round 2) |
| `POST /api/admin/users` | DONE |
| `DELETE /api/admin/users/{id}` | DONE |
| `GET /api/admin/users/{id}/permissions` | DONE |
| `PUT /api/admin/users/{id}/permissions` | DONE (with invalidate-on-write — EPIC-003 round 3) |
| `POST /api/admin/users/{id}/reset-password` | DONE |
| `POST /api/admin/users/{id}/logout-all` | DONE |
| **`PATCH /api/admin/users/{id}` (update fullName)** | **NOT YET — small backend addition needed for AC12/AC13.** Owner: Dev. |
| Permission middleware enforced server-side | DONE (EPIC-003 round 3) |
| `permissions` matrix in LoginResponse + MeResponse | DONE (EPIC-003 round 3) |
| `src/app/utils/permissions.ts` helper | DONE (EPIC-003 round 3) |

### External

| Dep | Status |
|---|---|
| shadcn/ui `Table`, `Dialog`, `AlertDialog`, `Checkbox` | Already in project |
| lucide-react icons | Already in deps |

---

## 9. Rollout

### Strategy

**Direct release** — feature thuần FE, không có DB migration, không có server-side change ngoài PATCH endpoint nhỏ. Phase split:

| Phase | Scope | Verify |
|---|---|---|
| **Phase A** (Dev local) | Build + manual smoke | Local docker compose; tester chạy SC từ TEST-SCRIPT |
| **Phase B** (Staging) | Deploy + UAT | 1 admin tester làm theo TEST-SCRIPT đầy đủ |
| **Phase C** (Production) | Direct deploy ngoài giờ | Smoke test trong window 30 phút; sẵn sàng revert PR nếu fail |

### Target population
- Toàn bộ admin (≤ 5 người).

### Success metrics (per §1.2)
- 100% admin actions qua UI sau 1 tuần.
- 0 incident security trong 30 ngày sau release.

### Guardrails
- 0 lỗi 500 trên `/api/admin/*` endpoints (đã có rate-limit + auth từ EPIC-003).
- Audit log có 1 row cho mỗi UI action.

### Rollback
- Revert PR. FE-only change → không có data ở server cần rollback.

### Kill-switch
- Sidebar item ẩn nếu env build flag `ENABLE_ADMIN_USER_PAGE=false`. (Optional — chỉ thêm nếu PO yêu cầu).

---

## 10. Open Questions

| # | Question | Owner |
|---|---|---|
| 1 | PATCH endpoint cho fullName: có làm trong EPIC-004 hay tách ra EPIC nhỏ? | TL — recommend làm trong EPIC-004 vì rất nhỏ (~15 LOC) |
| 2 | Cần filter / search trong bảng users? PRD §2 đang out-of-scope cho v1. PO confirm scope. | PO |
| 3 | Permissions dialog khi target là admin: AC20 nói "không cho mở" — hay nên show read-only "all enabled"? | UX recommend read-only view (less confusing) |
| 4 | Restore soft-deleted user qua UI v2 priority? | PO |
| 5 | Reset pw modal — nên show pw bằng `aria-live="polite"` hay `assertive` (interrupt screen reader)? Pw là sensitive → recommend `polite`. | A11y |
| 6 | Có cần ngăn double-submit ở tất cả dialogs hay chỉ create? AC11 nói có cho create — extend pattern? | TL |

---

## 11. Handoff

- **Next:** Developer (per pipeline 3 agents).
- Then: QA (TEST-CASES + TEST-SCRIPT).

### Implementation hints (for Developer)

- Tạo `src/app/components/admin/UsersPage.tsx` + sub-dialogs trong thư mục `src/app/components/admin/`.
- Reuse `permissions.ts` cho sidebar gating trong `App.tsx`.
- Tất cả admin API helpers đã có sẵn trong `src/app/utils/api.ts` từ EPIC-003 round 2 (adminListUsers, adminCreateUser, adminDeleteUser, adminGetPermissions, adminUpdatePermissions, adminResetPassword, adminLogoutAll).
- Cần thêm: `adminUpdateUser(id, {fullName})` + backend `PATCH /api/admin/users/{id}` (5 dòng C# trong `UserAdminService` + 8 dòng C# endpoint).
- Khuyến nghị dùng `AlertDialog` cho mọi destructive confirm (Delete, Logout-all, Reset PW).

---

## 12. Definition of Done

- [ ] All M+S acceptance criteria PASS in UAT.
- [ ] No regression on EPIC-001 / EPIC-002 / EPIC-003 quick check (login, inventory list, search).
- [ ] Audit log captures 1 row per UI mutation (manual verify 10 random samples).
- [ ] Lighthouse Accessibility ≥ 90 on `/admin/users` page.
- [ ] Manual review: temp pw nowhere in browser storage after Reset PW dialog close (Verified via DevTools Application tab).
- [ ] Code review by TL.
- [ ] PR merged to main + deployed to staging + 1 admin tester runs full TEST-SCRIPT and signs off.
