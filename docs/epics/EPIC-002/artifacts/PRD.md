# PRD — EPIC-002: Nâng cấp hệ thống quản lý nhân sự, công nghệ

**Epic ID:** EPIC-002
**Owner:** Product Owner
**Status:** Draft v1
**Last updated:** 2026-06-13

---

## 0. Executive Summary

Đây là epic **nâng cấp nền tảng** gộp 6 nhóm thay đổi liên quan:

| # | Module | Mục tiêu |
|---|---|---|
| M1 | **Postgres backing store** | Thay Excel-as-DB bằng PostgreSQL; vẫn hỗ trợ import/export Excel |
| M2 | **Docker bootstrap** | docker-compose tự stand-up Postgres + Redis; data folder ignore khỏi git |
| M3 | **Data migration** | Convert dữ liệu Excel hiện có (`/data/inventory.xlsx`) sang Postgres |
| M4 | **Auth & RBAC** | Đăng nhập/đăng xuất chuẩn, Redis cache session, admin quản lý user + per-menu permission, reset password |
| M5 | **Audit log** | Ghi nhận mọi thao tác (read/write) theo account |
| M6 | **UI polish** | Dashboard tô màu sinh động, sidebar fixed (không cuộn theo content) |

Hệ thống đang chạy: backend ASP.NET 8 (`/server`, lưu Excel), frontend React+Vite (`/src/app`), auth giả lập bằng header `X-Role` / `X-Username`. PRD này là contract để Tech Lead thiết kế và Dev triển khai.

---

## 1. Problem & Goal

### Problem

**M1–M3: Storage.** Hiện tại toàn bộ products + transactions lưu trong 1 file `inventory.xlsx`. Vấn đề:
- Không scale: read/write toàn file mỗi lần (semaphore lock → 1 request tại 1 thời điểm).
- Không có truy vấn phức tạp / index.
- Nguy cơ mất dữ liệu khi server crash giữa lúc ghi.
- File `inventory.xlsx` đang nằm trong repo nếu vô tình commit data folder → leak dữ liệu nội bộ.

**M4: Auth.** Hiện tại auth chỉ dựa trên 2 HTTP header `X-Role` + `X-Username` do client tự gửi → **bất kỳ ai cũng có thể gửi `X-Role: admin`**. Không có:
- Cơ chế login thực sự (token / session).
- Logout (vì không có session).
- Quản lý user (chỉ có 2 user hardcode trong code FE).
- Phân quyền chi tiết per-menu / per-action.
- Reset password.

**M5: Audit.** Không có log ai làm gì → khi data sai không truy được trách nhiệm, không phục vụ compliance, không debug được "dữ liệu bị sửa khi nào".

**M6: UX.** Dashboard hiện đơn điệu (số liệu trắng-đen). Sidebar cuộn theo content → user phải scroll lên đầu để chuyển tab.

### Goal

| Loại | Chỉ số | Mục tiêu |
|---|---|---|
| Storage | API latency p95 cho `/api/inventory` với 10k products | ≤ **300ms** (Postgres) so với hiện tại không đo được lý do file lock |
| Storage | Concurrent write không gây mất giao dịch | 0 lỗi race trong test 50 concurrent writes |
| Auth | % request được bảo vệ token (không header-spoof) | **100%** endpoint cần auth |
| Auth | Logout invalidate session ngay | ≤ **2s** từ logout đến request kế tiếp bị 401 |
| RBAC | Admin có thể đổi quyền user và hiệu lực ngay phiên user kế | ≤ **30s** từ lúc save quyền đến lúc user thấy hiệu lực (khi user refresh hoặc next request) |
| Audit | % thao tác write có log đầy đủ (who/what/when/before/after) | **100%** |
| UX | Sidebar không di chuyển khi cuộn content (≥ 1024px) | **100% trang trong app** |
| Adoption | Tỉ lệ user đăng nhập lại được sau migration | **100%** (không user nào mất tài khoản) |

### Why now

- File `inventory.xlsx` đang là **single point of corruption** — phải xử lý trước khi hệ thống có > 1 user thực sự ghi song song.
- Auth header-spoofable là **lỗi bảo mật P0** — không thể go-live production.
- Audit log là yêu cầu hard từ phía vận hành/kế toán; càng để lâu càng nhiều giao dịch không traceable.
- Postgres + Redis là nền cho các epic sau (báo cáo nâng cao, multi-warehouse, API public).

---

## 2. Scope

### In-scope

#### M1 — Postgres backing store
- Schema cho: `users`, `roles`, `permissions`, `user_permissions`, `sessions` (hoặc dùng Redis), `products`, `transactions`, `audit_logs`.
- Repository layer thay thế `ExcelStore` cho products + transactions.
- Migration tool / script tự chạy schema khi container Postgres khởi động lần đầu.
- Giữ nguyên contract REST hiện có (`GET /api/inventory`, `POST /api/products`, `POST /api/inventory/import`, v.v.) — frontend không phải đổi nhiều.
- Excel **chỉ còn vai trò import/export**, không phải nơi lưu trữ.

#### M2 — Docker bootstrap
- `docker-compose.yml` bổ sung service `postgres` (image `postgres:16`) và `redis` (image `redis:7`).
- Healthcheck cho cả 2; `api` `depends_on` cả 2.
- Volume `postgres-data` mount vào host folder `./data/postgres/`.
- Volume `redis-data` mount vào `./data/redis/`.
- `.gitignore` bổ sung: `data/postgres/`, `data/redis/`, `data/inventory.xlsx`, `data/*.xlsx`.
- Env file `.env.example` chứa default credentials (Postgres user/pass/db, Redis password) — file `.env` thật **không commit**.

#### M3 — Data migration
- Khi server khởi động lần đầu và Postgres còn rỗng:
  - Nếu phát hiện file `/data/inventory.xlsx` → đọc, convert format, insert vào `products` và `transactions`.
  - Log số lượng đã migrate.
  - Đổi tên file sang `inventory.xlsx.migrated-<timestamp>` để tránh chạy lại.
- Migration **idempotent**: chạy lại nhiều lần không tạo duplicate.
- Có command CLI thủ công `dotnet run -- migrate-from-excel /path/to/file.xlsx` để migrate file Excel khác sau này.

#### M4 — Auth & RBAC
- **Đăng nhập**: POST `/api/auth/login` nhận `{username, password}` → trả `{token, expiresAt, user}`.
- **Token**: JWT (HS256), expiry mặc định **8 giờ**, sliding refresh tùy chọn (v2).
- **Session cache trong Redis**: key `session:<jti>` → value `{userId, role, issuedAt, lastSeenAt}`. TTL = expiry.
- **Đăng xuất**: POST `/api/auth/logout` → server xoá session khỏi Redis. Token cũ trở thành invalid ngay (bằng cách kiểm tra Redis trên mỗi request, KHÔNG chỉ dựa vào JWT signature).
- **Middleware** kiểm tra: signature hợp lệ + session tồn tại trong Redis → set `HttpContext.User`. Nếu không → 401.
- **Role-based**: 2 role gốc `admin` và `user`. Admin có toàn quyền theo định nghĩa; user chỉ có quyền được admin gán.
- **Per-menu permission**: với mỗi user, admin có thể bật/tắt cho từng "menu" (Dashboard, Inventory, Transactions, Reports, Users) các action: `view`, `create`, `update`, `delete`. (Theo description: "xem , thêm , xoá , sửa , cập nhật" → coi "sửa"="update", "cập nhật" trùng nghĩa nên gộp thành 4 action: view / create / update / delete.)
- **Endpoint admin**:
  - `GET /api/admin/users` — list
  - `POST /api/admin/users` — create
  - `DELETE /api/admin/users/{id}` — xoá (soft delete, không xoá audit log)
  - `PUT /api/admin/users/{id}/permissions` — set permissions matrix
  - `POST /api/admin/users/{id}/reset-password` — admin reset → server sinh password tạm, force user đổi khi login
- **Frontend**: trang `/admin/users` (chỉ admin truy cập); menu hiển thị có điều kiện theo `permissions.view`.

#### M5 — Audit log
- Bảng `audit_logs` cột: `id`, `actor_user_id`, `actor_username`, `actor_role`, `action`, `resource_type`, `resource_id`, `before_json`, `after_json`, `ip_address`, `user_agent`, `at`.
- Ghi log cho **tất cả write actions** (create/update/delete trên products, transactions, users, permissions, password reset, login, logout, failed login).
- Read actions: log riêng cho `/api/admin/*` (sensitive list); read products/transactions thường KHÔNG log từng request (chỉ log session bắt đầu).
- Endpoint xem audit: `GET /api/admin/audit?from&to&actor&action&resource` — chỉ admin. Hỗ trợ filter + pagination.

#### M6 — UI polish
- Dashboard: thêm màu nhấn cho các thẻ số liệu (gradient nhẹ, icon màu), biểu đồ có palette cụ thể (≥ 4 màu phân biệt), giữ contrast WCAG AA.
- Sidebar: `position: sticky` hoặc `position: fixed` trên màn ≥ 1024px → không cuộn theo content. Trên < 1024px (mobile/tablet) giữ behavior cũ (collapse / overlay).

### Out-of-scope (v1)

- SSO / OAuth (Google, AzureAD) — v2.
- 2FA / MFA — v2.
- Role custom (ngoài admin/user) — v2.
- Multi-tenant — không trong roadmap gần.
- Realtime push (websocket cho permission update) — v1 user phải refresh hoặc đợi next request (≤ 30s).
- Export audit log ra Excel/CSV — v2.
- GDPR data export per-user — v2.
- Auto-scaling Postgres / read replica — không cần.

### Target users

- **Admin** (≤ 5 người trong tổ chức): cần quản lý user, gán quyền, reset password, xem audit log.
- **User thường** (10–50 người): cần đăng nhập an toàn, làm thao tác theo quyền được gán, biết phiên đã logout là phiên sạch.
- **DevOps / vận hành**: cần docker-compose stand-up được toàn bộ stack 1 lệnh.

---

## 3. User Flow

### M1–M3: Migration (one-time, dev/ops)

**Happy path:**
1. Ops clone repo, chạy `cp .env.example .env`, sửa password.
2. Chạy `docker compose up -d` → 4 service start (postgres, redis, api, web).
3. API khởi động, chạy schema migration trên Postgres rỗng → tạo bảng.
4. API phát hiện `inventory.xlsx` → đọc, insert vào DB, đổi tên file sang `.migrated-<ts>`.
5. API log: "Migrated N products, M transactions from Excel."
6. User truy cập web → đăng nhập → thấy data như cũ.

**Edge:**
- Postgres không lên trước API: API retry connect 30 lần × 2s, fail thì exit code != 0.
- Excel rỗng: skip migration, log "No Excel data to migrate."
- Excel có dòng lỗi format: log warning, skip dòng đó, vẫn chạy tiếp; cuối cùng báo `migrated=N, skipped=M`.
- Postgres đã có data + Excel còn tồn tại: KHÔNG migrate lại (idempotent guard); log "Skipped: DB already populated."

### M4: Login / Logout (mỗi phiên user)

**Happy path (login):**
1. User mở `/login` → nhập username + password → click Đăng nhập.
2. Client POST `/api/auth/login`. Server:
   a. Verify password (bcrypt).
   b. Tạo JWT, lưu session vào Redis với TTL 8h.
   c. Trả token + user info.
3. Client lưu token (httpOnly cookie ưu tiên; localStorage chấp nhận v1 nhưng phải document).
4. Client redirect về `/dashboard`.

**Happy path (logout):**
1. User click avatar → "Đăng xuất".
2. Client POST `/api/auth/logout` với token hiện tại.
3. Server xoá `session:<jti>` khỏi Redis. Trả 204.
4. Client clear token, redirect `/login`.
5. Nếu user bấm Back hoặc gửi request với token cũ → server check Redis → không thấy → trả 401, FE auto redirect login.

**Edge:**
- Sai password 5 lần liên tiếp trong 5 phút → **lock account 15 phút** (record vào audit + Redis key `login:lock:<userId>`).
- Token hết hạn giữa phiên: FE bắt 401 → modal "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."
- Admin xoá user khi user đang online: phiên user bị invalidate ngay (server xoá session Redis trong cùng transaction); user gặp 401 ở request kế.
- Admin đổi quyền user đang online: user vẫn dùng quyền cũ đến khi token cache lại quyền hết hạn (≤ 30s) HOẶC user refresh trang HOẶC FE poll quyền mỗi 30s. (Chọn approach poll-30s + force re-fetch sau action admin.)
- Redis down: API trả **503 Service Unavailable** trên mọi request cần auth (fail-secure), KHÔNG fallback "skip auth check".

### M4: Admin manage users

**Happy path (create):**
1. Admin vào `/admin/users` → click "Thêm user".
2. Modal: username, full name, role (admin/user), password tạm.
3. Save → POST `/api/admin/users` → 201.
4. Audit log: `action=user.create, actor=<admin>, resource_id=<new userId>, after_json={...}`.
5. User mới có thể đăng nhập với password tạm; lần đăng nhập đầu tiên bắt buộc đổi password.

**Happy path (set permissions):**
1. Admin → user row → click "Phân quyền".
2. Hiện matrix: 5 menu × 4 action (checkbox).
3. Toggle → click "Lưu" → PUT `/api/admin/users/{id}/permissions`.
4. Audit log với `before_json` / `after_json`.
5. User bị ảnh hưởng: lần next request (hoặc refresh trang) thấy menu mới.

**Happy path (reset password):**
1. Admin click "Reset password" trên row user.
2. Confirm modal: "Reset password cho user X? Password tạm sẽ hiển thị 1 lần duy nhất."
3. Server sinh password tạm 12 ký tự, hash lưu DB, trả plain text về client 1 lần.
4. Admin copy & gửi cho user (qua kênh ngoài).
5. User next login → bắt buộc đổi password.

**Edge:**
- Username trùng: 400 "Username đã tồn tại".
- Admin tự xoá chính mình: 400 "Không thể tự xoá tài khoản của mình".
- Admin xoá admin cuối cùng: 400 "Phải còn ít nhất 1 admin".
- Reset password cho admin cuối cùng: cho phép, nhưng cảnh báo.

### M5: View audit log

**Happy path:**
1. Admin vào `/admin/audit` → form filter (date range, actor, action type, resource).
2. Bảng hiện list paginated (50 dòng/trang).
3. Click dòng → modal hiện full `before_json` / `after_json` diff.

**Edge:**
- Filter quá rộng (> 10k dòng): trả 50 + thông báo "Kết quả lớn, hãy thu hẹp filter."
- Audit log của user đã bị xoá: vẫn hiển thị `actor_username` (snapshot tại thời điểm action).

### M6: Dashboard / sidebar

**Happy path:**
1. User vào `/dashboard` → các thẻ KPI hiện màu (xanh dương cho tổng tồn, xanh lá cho doanh thu, cam cho cảnh báo low-stock, tím cho user activity).
2. Cuộn nội dung trang xuống → sidebar **đứng yên** ở vị trí cũ trên màn ≥ 1024px.
3. Click menu sidebar → chuyển route, sidebar không reset state.

**Edge:**
- Mobile (< 1024px): sidebar collapse thành hamburger, không apply fixed.
- Khi mở modal full-screen: sidebar vẫn nằm dưới overlay.

### Recovery paths

- User quên password → liên hệ admin → admin reset → nhận password tạm.
- Admin quên password → phải có ≥ 2 admin trong hệ thống → admin còn lại reset; nếu chỉ có 1 admin và quên → cần root reset bằng CLI: `dotnet run -- reset-admin --username=root`. (Documented in ops runbook.)
- Token bị nghi ngờ leak: admin có nút "Logout user khỏi mọi thiết bị" → xoá all sessions trong Redis của user đó.
- Audit log corrupt: append-only DB; backup hàng ngày; không có endpoint delete.

---

## 4. Acceptance Criteria

Format Given/When/Then. Priority: M=Must, S=Should, C=Could, W=Won't.

### 4.1 Postgres backing store (M1)

| ID | Priority | AC |
|---|---|---|
| EPIC-002-AC01 | M | **Given** Postgres rỗng, **When** API khởi động, **Then** schema migration tự chạy và tạo các bảng `users`, `roles`, `user_permissions`, `products`, `transactions`, `audit_logs`. |
| EPIC-002-AC02 | M | **Given** schema đã tạo, **When** `GET /api/inventory`, **Then** trả về `{products, transactions}` đọc từ Postgres, contract JSON giữ nguyên như bản Excel. |
| EPIC-002-AC03 | M | **Given** 2 client cùng `POST /api/products` đồng thời, **When** xử lý xong, **Then** cả 2 transaction được commit, không có dòng bị mất, không có deadlock loop > 3s. |
| EPIC-002-AC04 | M | **Given** dataset 10,000 products trong Postgres, **When** `GET /api/inventory`, **Then** p95 ≤ 300ms (đo 100 request). |
| EPIC-002-AC05 | S | **Given** có index trên `products.maSKU` (unique), **When** insert SKU trùng, **Then** API trả 409 với message "SKU đã tồn tại". |

### 4.2 Docker bootstrap (M2)

| ID | Priority | AC |
|---|---|---|
| EPIC-002-AC06 | M | **Given** repo clone sạch + có file `.env`, **When** chạy `docker compose up -d`, **Then** 4 service (postgres, redis, api, web) lên đầy đủ, healthcheck pass trong ≤ 60s. |
| EPIC-002-AC07 | M | **Given** `.gitignore` đã update, **When** chạy `git status`, **Then** `data/postgres/`, `data/redis/`, `data/inventory.xlsx`, `.env` KHÔNG xuất hiện trong list tracking. |
| EPIC-002-AC08 | M | **Given** `.env.example` tồn tại, **When** đọc file, **Then** chứa key `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `JWT_SECRET` với giá trị placeholder rõ ràng. |
| EPIC-002-AC09 | S | **Given** Postgres chưa healthy, **When** API container start, **Then** API retry connect và log "waiting for postgres" thay vì crash; sau 30 lần (60s) thì exit code != 0. |

### 4.3 Data migration (M3)

| ID | Priority | AC |
|---|---|---|
| EPIC-002-AC10 | M | **Given** Postgres rỗng + `data/inventory.xlsx` tồn tại với N products, M transactions, **When** API khởi động, **Then** N products + M transactions được insert vào DB; log ghi `Migrated N products, M transactions`. |
| EPIC-002-AC11 | M | **Given** đã chạy migrate 1 lần, **When** API khởi động lần 2, **Then** KHÔNG migrate lại (file đã được rename thành `inventory.xlsx.migrated-<ts>` hoặc DB đã populated); log "Skipped: already migrated." |
| EPIC-002-AC12 | S | **Given** Excel có 1 dòng thiếu cột `maSKU`, **When** migrate, **Then** dòng đó bị skip với log warning; các dòng còn lại được migrate; báo cáo cuối: `migrated=N, skipped=1`. |
| EPIC-002-AC13 | S | **Given** Postgres đã có data + file Excel còn tồn tại, **When** chạy CLI `migrate-from-excel`, **Then** prompt confirm + flag `--force` mới được phép overwrite. |

### 4.4 Auth & RBAC (M4)

| ID | Priority | AC |
|---|---|---|
| EPIC-002-AC14 | M | **Given** user có credential hợp lệ, **When** POST `/api/auth/login`, **Then** trả 200 + `{token, expiresAt, user: {id, username, role, permissions}}`; session lưu vào Redis với TTL = expiry. |
| EPIC-002-AC15 | M | **Given** user gửi password sai, **When** login, **Then** trả 401 với message "Sai tài khoản hoặc mật khẩu"; KHÔNG tiết lộ user tồn tại hay không. |
| EPIC-002-AC16 | M | **Given** sai password 5 lần trong 5 phút, **When** thử lần 6, **Then** trả 423 "Tài khoản bị tạm khoá. Thử lại sau 15 phút."; audit log `login.locked`. |
| EPIC-002-AC17 | M | **Given** đã login, **When** POST `/api/auth/logout` với token, **Then** session bị xoá khỏi Redis; trả 204; mọi request kế dùng token đó trả 401 trong vòng 2s. |
| EPIC-002-AC18 | M | **Given** token JWT signature hợp lệ nhưng session KHÔNG còn trong Redis, **When** call API protected, **Then** trả 401 "Phiên đã kết thúc". |
| EPIC-002-AC19 | M | **Given** Redis down, **When** call API protected bất kỳ, **Then** trả 503 "Auth service unavailable"; KHÔNG bypass auth check. |
| EPIC-002-AC20 | M | **Given** client gửi header `X-Role: admin` mà KHÔNG có Bearer token hợp lệ, **When** call admin endpoint, **Then** trả 401; header `X-Role` bị ignore hoàn toàn. |
| EPIC-002-AC21 | M | **Given** user có quyền `inventory.view=true, inventory.update=false`, **When** PUT `/api/products`, **Then** trả 403 "Không có quyền chỉnh sửa kho." |
| EPIC-002-AC22 | M | **Given** admin vào `/admin/users`, **When** click "Thêm user" và submit hợp lệ, **Then** user mới tồn tại trong DB; audit log `user.create` với `after_json` chứa user details. |
| EPIC-002-AC23 | M | **Given** admin tạo user trùng username, **When** submit, **Then** trả 400 "Username đã tồn tại". |
| EPIC-002-AC24 | M | **Given** admin click "Xoá" user khác (không phải mình), **When** confirm, **Then** user bị soft-delete (`deleted_at` set), không thể login, audit log đầy đủ. |
| EPIC-002-AC25 | M | **Given** admin click "Xoá" chính mình, **When** confirm, **Then** trả 400 "Không thể tự xoá tài khoản của mình." |
| EPIC-002-AC26 | M | **Given** chỉ còn 1 admin trong hệ thống, **When** xoá admin đó, **Then** trả 400 "Phải còn ít nhất 1 admin." |
| EPIC-002-AC27 | M | **Given** admin set ma trận quyền cho user, **When** PUT thành công, **Then** audit log có cả `before_json` và `after_json` permissions; user thấy quyền mới ở request kế sau cùng lắm 30s. |
| EPIC-002-AC28 | M | **Given** admin click "Reset password" cho user, **When** confirm, **Then** server sinh password tạm 12 ký tự (chữ + số + special), trả plain-text 1 lần; user phải đổi password ở lần login kế. |
| EPIC-002-AC29 | S | **Given** user login bằng password tạm, **When** truy cập trang khác, **Then** bị force redirect về `/change-password` cho đến khi đổi xong. |
| EPIC-002-AC30 | S | **Given** admin click "Logout user khỏi mọi thiết bị" cho user X, **When** confirm, **Then** tất cả session Redis của user X bị xoá; user X gặp 401 ở request kế. |

### 4.5 Audit log (M5)

| ID | Priority | AC |
|---|---|---|
| EPIC-002-AC31 | M | **Given** bất kỳ thao tác write nào (create/update/delete trên products, transactions, users, permissions), **When** thực thi thành công, **Then** 1 row audit_log được insert với `actor_user_id`, `action`, `resource_type`, `resource_id`, `before_json`, `after_json`, `ip_address`, `user_agent`, `at`. |
| EPIC-002-AC32 | M | **Given** login thành công / thất bại / logout / lock, **When** sự kiện xảy ra, **Then** audit_log có dòng tương ứng (`login.success`, `login.failed`, `login.locked`, `logout`). |
| EPIC-002-AC33 | M | **Given** admin gọi `GET /api/admin/audit?from=...&to=...`, **When** truy vấn, **Then** trả list paginated (50/page), sort theo `at` desc. |
| EPIC-002-AC34 | M | **Given** filter trả về > 10,000 dòng, **When** query, **Then** trả 50 đầu + flag `truncated=true` + message gợi ý thu hẹp filter. |
| EPIC-002-AC35 | M | **Given** non-admin gọi `/api/admin/audit`, **When** request, **Then** trả 403. |
| EPIC-002-AC36 | S | **Given** user bị xoá sau khi đã có audit log, **When** xem audit của user đó, **Then** vẫn hiển thị `actor_username` từ snapshot lúc action xảy ra. |
| EPIC-002-AC37 | S | **Given** audit_log table, **When** kiểm tra schema, **Then** KHÔNG có endpoint hay SQL grant nào cho phép DELETE/UPDATE từ application code (append-only). |

### 4.6 UI polish (M6)

| ID | Priority | AC |
|---|---|---|
| EPIC-002-AC38 | M | **Given** màn ≥ 1024px, **When** scroll content xuống dưới, **Then** sidebar giữ nguyên vị trí (sticky/fixed), không cuộn theo. |
| EPIC-002-AC39 | M | **Given** màn < 1024px, **When** view sidebar, **Then** sidebar collapse thành hamburger / drawer (giữ behavior cũ). |
| EPIC-002-AC40 | M | **Given** dashboard có ≥ 4 thẻ KPI, **When** render, **Then** mỗi thẻ có màu nhấn riêng (background hoặc icon hoặc accent bar), đảm bảo contrast text/background ≥ 4.5:1 (WCAG AA). |
| EPIC-002-AC41 | S | **Given** dashboard có biểu đồ (chart), **When** render, **Then** palette dùng ≥ 4 màu phân biệt được cả với người mù màu (qua check Coblis hoặc tương đương). |

### 4.7 Cross-cutting

| ID | Priority | AC |
|---|---|---|
| EPIC-002-AC42 | M | **Given** user logout, **When** mọi tab khác của user đó cố gọi API protected, **Then** bị 401 trong ≤ 2s. |
| EPIC-002-AC43 | M | **Given** Excel export/import vẫn hoạt động, **When** admin click "Export Excel", **Then** file Excel được tạo từ data Postgres và tải về (không phải đọc trực tiếp từ file disk). |
| EPIC-002-AC44 | M | **Given** admin import Excel mới, **When** upload thành công, **Then** data được **replace** vào Postgres (theo behavior hiện tại); audit log `inventory.import` với count rows. |
| EPIC-002-AC45 | W | SSO / OAuth / 2FA — v2 |
| EPIC-002-AC46 | W | Multi-tenant — out of roadmap |
| EPIC-002-AC47 | W | Realtime websocket push permission update — v2 |

---

## 5. UI / Design

> Chưa có Figma. UI follow theme shadcn/ui hiện có.

### Trang mới
| Route | Mục đích | Component chính |
|---|---|---|
| `/login` | Đăng nhập | Card center, 2 input + button |
| `/change-password` | Đổi password (force first-login) | Form 3 input (old, new, confirm) |
| `/admin/users` | Danh sách user + actions | Table + dialog Add/Edit/Permissions/Reset |
| `/admin/audit` | Audit log | Filter bar + table + diff dialog |

### Trang sửa đổi
- **Sidebar component** (`/src/app/components/Sidebar.tsx` — chưa có, sẽ tạo nếu hiện tại đang dùng tabs): áp `lg:fixed lg:top-0 lg:left-0 lg:h-screen lg:w-64` + main content `lg:ml-64`.
- **Dashboard**: bổ sung gradient class trên Card (`bg-gradient-to-br from-blue-50 to-blue-100` cho thẻ tổng tồn, từ `green-*` cho doanh thu, `orange-*` cho cảnh báo, `purple-*` cho user activity); icon `lucide-react` color tương ứng.
- **Topbar**: thêm avatar dropdown với link "Đăng xuất".

### Platform conventions
- Web: shadcn/ui + Tailwind. Form validation hiển thị inline (đỏ + icon).
- Keyboard: Tab navigate qua form, Enter submit, Esc đóng dialog.
- ARIA: dialog có `aria-modal`, label đầy đủ.

---

## 6. Non-Functional Requirements

### Performance
| Metric | Target |
|---|---|
| `/api/inventory` GET (10k rows) | p95 ≤ 300ms |
| `/api/auth/login` | p95 ≤ 500ms (bcrypt cost 10) |
| `/api/admin/audit` filter | p95 ≤ 800ms với 1M rows + index |
| Page load `/dashboard` (cold) | LCP ≤ 2.5s trên cáp 10Mbps |
| Sidebar scroll smoothness | 60fps trên Chrome desktop |

### Reliability
- Postgres connection pool size 20, retry 3 lần với exponential backoff.
- API stateless: scale horizontal được (session ở Redis, không in-process).
- Import Excel idempotent — fail giữa chừng → DB rollback transaction (không partial state).
- Healthcheck endpoint `/api/health` báo: API ok, Postgres ok, Redis ok.

### Security & privacy
- Password: bcrypt cost 10, không lưu plaintext, không log password ở mọi cấp.
- JWT secret ≥ 32 bytes, lưu trong env var, rotate được (xoá Redis sessions khi rotate).
- HTTPS bắt buộc ở production (nginx terminate TLS).
- HttpOnly + Secure + SameSite=Strict cho session cookie (nếu dùng cookie).
- CSRF token cho mọi POST/PUT/DELETE nếu dùng cookie auth (skip nếu Bearer header).
- SQL injection: parameterized queries (Dapper / EF Core) — không raw string concat.
- PII: username + full_name + audit log chứa user activity; data retention: audit 2 năm rồi archive.
- Rate limit: `/api/auth/login` 10 req/min/IP, 5 req/min/username.
- GDPR/Vietnam PDPA: data ở VN cloud, không xuất biên giới.

### Compatibility
- Browser: Chrome ≥ 100, Edge ≥ 100, Safari ≥ 15, Firefox ≥ 100.
- Server: .NET 8 LTS; Postgres 16; Redis 7.
- Docker Engine ≥ 24.

### Accessibility (WCAG 2.1 AA)
- Tất cả form input có label.
- Modal: trap focus, Esc đóng.
- Dashboard màu: contrast ≥ 4.5:1; không dùng màu là sự khác biệt duy nhất.
- Sidebar fixed: phải responsive, không che content trên màn nhỏ.

### Internationalization
- v1: vi-VN. Date format `dd/MM/yyyy HH:mm`. Currency VND.
- Hardcoded text vẫn tiếng Việt; thiết kế cho phép wrap i18n sau.

### Observability
- Structured logs JSON: `{level, ts, msg, requestId, userId, action, latencyMs}`.
- Request ID truyền qua header `X-Request-ID`, log mọi tier.
- Metrics: Prometheus endpoint `/metrics` với: http_request_duration_seconds, login_total{result}, audit_log_writes_total, db_query_duration.
- Traces: optional OpenTelemetry exporter (off by default trong v1).

### Offline / resilience
- Frontend không phải offline-first. Khi mất mạng: hiện banner "Mất kết nối", disable action.
- API offline → FE retry GET với backoff; POST không retry tự động (tránh double-write).

---

## 7. Analytics / Telemetry

| Event | Trigger | Properties | Metric |
|---|---|---|---|
| `auth.login.success` | Login thành công | `userId`, `role`, `durationMs` | DAU, login latency |
| `auth.login.failed` | Login thất bại | `usernameAttempted` (hash), `reason` | Brute-force detection |
| `auth.login.locked` | Account lock | `userId` | Security alert |
| `auth.logout` | Logout chủ động | `userId`, `sessionDurationMin` | Session length |
| `auth.session.expired` | Token expire | `userId` | Session length |
| `admin.user.create` | Tạo user | `actorId`, `targetId`, `role` | Admin activity |
| `admin.user.delete` | Xoá user | `actorId`, `targetId` | Admin activity |
| `admin.permission.update` | Đổi quyền | `actorId`, `targetId`, `changedCount` | Admin activity |
| `admin.password.reset` | Reset pw | `actorId`, `targetId` | Admin activity |
| `inventory.import` | Import Excel | `actorId`, `productCount`, `durationMs` | Adoption |
| `inventory.export` | Export Excel | `actorId`, `productCount` | Adoption |
| `audit.query` | Xem audit | `actorId`, `filterScope` | Compliance usage |

Consent: Sản phẩm nội bộ, không cần consent banner. Audit log là yêu cầu compliance, không opt-out.

---

## 8. Dependencies

### External
| Dep | Version | Status | Owner |
|---|---|---|---|
| Postgres image `postgres:16-alpine` | 16.x | Public | — |
| Redis image `redis:7-alpine` | 7.x | Public | — |
| `BCrypt.Net-Next` (.NET) | latest stable | Ready | Dev |
| `Npgsql` / `Dapper` (.NET) | latest stable | Ready | Dev |
| `StackExchange.Redis` (.NET) | latest stable | Ready | Dev |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 8.x | Ready | Dev |

### Internal
| Dep | Status | Owner |
|---|---|---|
| Excel migration logic (cần đọc `inventory.xlsx` format hiện tại) | Có sẵn trong `ExcelStore.cs` | Dev |
| Frontend auth context / interceptor | Chưa có | Dev FE |
| EPIC001 (search inventory) | Done | — |

### Status overview
- 0 blocked.
- Tất cả lib có sẵn public.

---

## 9. Rollout

### Strategy
- **Phased**, không feature flag toàn-bộ vì epic là nâng cấp nền (cannot run side-by-side).
- Phase 1 (Dev/Staging): deploy đầy đủ, smoke test, migrate dữ liệu giả.
- Phase 2 (UAT): deploy lên staging với data copy từ prod, 1 admin + 2 user test.
- Phase 3 (Production): deploy ngoài giờ làm việc; chạy migration trong window 30 phút; smoke test; thông báo all-user reset password lần đầu (vì password cũ không có hash).

### Target population
- Toàn bộ user hiện tại (~ chục người).

### Success metrics (xem §1)
- 100% user đăng nhập lại được trong 24h sau release.
- 0 incident bảo mật bypass auth.
- Audit log coverage 100% write actions trong tuần đầu (kiểm thủ công 50 mẫu).

### Guardrails
- Login p95 ≤ 500ms trong giờ cao điểm.
- Postgres CPU < 60%, Redis memory < 50% trong 1 tuần đầu.
- 0 lỗi 500 từ API trên endpoint protected.

### Rollback plan
- Backup Postgres dump trước khi go-live.
- Giữ branch `main` cũ (Excel-only) làm fallback; nếu disaster → rollback container về tag cũ + restore từ Excel `.migrated-<ts>` file.
- Communication: post mortem trong vòng 24h nếu rollback xảy ra.

### Kill-switch
- Env var `ENABLE_NEW_AUTH=false` (v1 nice-to-have): nếu set → API trả 503 cho mọi `/api/auth/*`, force user dùng hệ thống cũ. **Không có** kill-switch cho phần DB (Excel-only không quay lại được sau migrate).

---

## 10. Open Questions

1. **JWT vs session cookie**: dùng JWT-in-Bearer (đơn giản) hay session-cookie httpOnly (an toàn hơn với XSS)? → Đề xuất **Bearer JWT** v1, lý do: stateless dễ scale, hợp với FE SPA hiện tại. Re-evaluate ở v2 nếu có XSS risk.
2. **Permission caching strategy**: cache permissions trong JWT (lightweight) hay Redis (always fresh)? → Đề xuất **Redis lookup mỗi request** (đã phải hit Redis cho session anyway).
3. **Audit retention**: 2 năm rồi archive — có cần archive tự động hay manual? → Đề xuất manual v1, schedule v2.
4. **Username case-sensitivity**: hiện không có quy ước → đề xuất **case-insensitive** lưu lowercase.
5. **Default admin tạo cách nào?**: env var `DEFAULT_ADMIN_USERNAME` + `DEFAULT_ADMIN_PASSWORD` chỉ chạy ở first-boot khi `users` rỗng.
6. **"Sửa" vs "cập nhật"** trong description có phải 2 action khác nhau? → PRD gộp thành `update` (theo convention CRUD). PO confirm.

---

## 11. Handoff

- **Next:** Tech Lead → quyết định schema DB chi tiết, contract API, sequence diagram cho login, repository pattern.
- **Then:** Developer → triển khai theo module M1 → M6.
- **Then:** QA → derive test cases từ AC01–AC44 (M, S); AC45–AC47 (W) skip.

PRD này là **contract**. Mọi thay đổi scope phải update PRD trước khi code.
