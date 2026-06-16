# TEST-SCRIPT — EPIC-004 (UAT) — **v2 (post-hotfix)**

**Epic:** EPIC-004 — Nâng cấp quản lý User
**Branch under test:** `feature/EPIC-004-admin-users` (includes 2026-06-13 hotfix)
**For:** Manual / UAT testers (non-technical capable; DevTools needed for hotfix verify + storage check)
**Last updated:** 2026-06-13 (v2 — adds hotfix scenarios SC-29..SC-32 + section §6)

> **v2 addendum** — Following user feedback "đang lỗi không thể thao tác. log HTTP 500, 403 (không có thông báo gì cụ thể)", 3 bugs were fixed (Redis AllowAdmin, JSON 403/401 envelope, JSON 500 envelope) + FE readError fallback. New scenarios SC-29..SC-32 in §6 verify these fixes. Run these FIRST before SC-01..SC-28; if any of SC-29..SC-32 fail, the corresponding flow tests will fail with the same empty-body symptom.

---

## 1. Prerequisites

### 1.1 Environment

| Item | Value |
|---|---|
| Frontend URL | http://localhost:8080 (staging) hoặc http://localhost:5173 (dev) |
| Backend URL | http://localhost:3001/api |
| Browser | Chrome ≥ 100 (primary). Spot-check Edge ≥ 100. |
| Screen | Desktop ≥ 1280px (primary) + mobile 414px (smoke) |
| Locale | vi-VN |
| Network | Online |

### 1.2 Test accounts (pre-seeded)

| Username | Mật khẩu | Vai trò | Lưu ý |
|---|---|---|---|
| `admin` | `<DEFAULT_ADMIN_PASSWORD>` từ .env | admin | Đã đổi pw lần đầu trước đó |
| `qa-user-readonly` | `View@123` | user | Chỉ có `inventory.view` |

### 1.3 Pre-test setup

Trước khi bắt đầu, đảm bảo:
1. `docker compose up -d` đầy đủ; `curl /api/health` trả `{api:"ok", postgres:"ok", redis:"ok"}`.
2. Đăng nhập với `admin` qua web URL → bạn đến `/dashboard`.
3. Mở DevTools (F12) → tab Console: clear log.

---

## 2. Scenarios

### Module: Sidebar gating + page access

#### SC-01 — Admin thấy menu "Quản trị users" *(EPIC-004-AC01)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập với `admin` | Vào `/dashboard`. Sidebar bên trái có item "Quản trị users" với icon Users (người). |
| 2 | Đăng xuất | Quay về login. |
| 3 | Đăng nhập với `qa-user-readonly` | Vào `/dashboard`. Sidebar **KHÔNG** có item "Quản trị users". |
| 4 | Đăng xuất → Đăng nhập lại với `admin` | Item lại hiện. |

#### SC-02 — Trang `/admin/users` load list ≤ 1s *(EPIC-004-AC02)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập `admin` | Vào dashboard. |
| 2 | Click sidebar "Quản trị users" | Trong vòng 1 giây, trang đổi sang bảng user. |
| 3 | Quan sát bảng | Có các cột: Username, Tên đầy đủ, Vai trò, Phiên, Tạo lúc, Thao tác. Header "Danh sách user (N)" với N = số user thật. |
| 4 | Cuộn xuống nếu nhiều user | Bảng cuộn ngang được nếu màn hẹp; sidebar vẫn đứng yên (regression EPIC-002-AC38). |

#### SC-03 — Non-admin gõ URL /admin/users bị chặn *(EPIC-004-AC03)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập `qa-user-readonly` | Vào dashboard. |
| 2 | Bằng cách nào đó vào `/admin/users` (vd: edit localStorage `currentPage` hoặc gõ URL nếu router có) | Trang hiển thị thông báo "Không có quyền truy cập trang này." |
| 3 | Mở DevTools → Network → kiểm tra: có call nào tới `/api/admin/users` không? | KHÔNG có. (Server cũng sẽ trả 403 nếu user gọi tay, nhưng UI không gọi.) |

---

### Module: Create user

#### SC-04 — Tạo user thành công *(EPIC-004-AC06, AC07, AC11)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Vào `/admin/users` (đăng nhập admin). | Bảng list hiện. |
| 2 | Click nút "+ Thêm user" (top-right, primary). | Dialog "Thêm user mới" mở. |
| 3 | Quan sát form | 4 input: Username, Tên đầy đủ, Vai trò (dropdown), Mật khẩu tạm. Hai nút Hủy/Lưu. |
| 4 | Gõ `qa-test1` vào Username, `QA Test One` vào Tên đầy đủ, chọn `User` cho Vai trò, gõ `Welcome1@x` vào Mật khẩu tạm | Tất cả input nhận giá trị. |
| 5 | Click Lưu | Button đổi text "Đang lưu..." + spinner. Trong vòng ≤ 1s, dialog đóng, toast xanh "Đã tạo user 'qa-test1'". |
| 6 | Quan sát bảng | Row `qa-test1` xuất hiện ở đầu hoặc cuối bảng. Cột "Phiên" = 0. Cột Tạo lúc = thời gian hiện tại. Icon vàng (KeyAlert) bên cạnh username → tooltip "Cần đổi mật khẩu lần đăng nhập tới". |

#### SC-05 — Username trùng → 409 toast *(EPIC-004-AC10)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Lặp lại SC-04 với username `qa-test1` (đã tồn tại). | Click Lưu → toast đỏ "Username đã tồn tại". Dialog **vẫn mở** với input giữ nguyên. |

#### SC-06 — Username vi phạm regex *(EPIC-004-AC08)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở dialog Thêm user. | OK. |
| 2 | Gõ `AB` (chỉ 2 ký tự) vào Username, blur (click ra ngoài input). | Inline error đỏ: "Username 3-32 ký tự, chỉ gồm a-z, 0-9, _, -". Nút Lưu disabled. |
| 3 | Đổi thành `qa.test` (có dấu chấm — không hợp lệ). | Vẫn lỗi. |
| 4 | Đổi thành chuỗi dài 33 ký tự `a`. | Vẫn lỗi. |
| 5 | Đổi thành `valid-user1` | Lỗi biến mất. Lưu vẫn disabled vì pw chưa nhập. |

#### SC-07 — Password < 8 ký tự *(EPIC-004-AC09)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở dialog, điền username + fullName hợp lệ. | OK. |
| 2 | Gõ `short` vào pw → blur. | Inline error "Mật khẩu phải có ít nhất 8 ký tự". Lưu disabled. |
| 3 | Đổi pw thành `LongEnough1!` | Lỗi biến mất. Lưu enabled. |

#### SC-08 — Double-submit prevented *(EPIC-004-AC11)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở dialog, điền input valid. | OK. |
| 2 | DevTools → Network → throttle "Slow 3G" để Save chạy chậm. | OK. |
| 3 | Click Save 3 lần nhanh liên tiếp. | Sau click đầu, button disable + "Đang lưu...". Click 2 và 3 không có hiệu ứng. Mạng chỉ có **1** POST /api/admin/users. |
| 4 | Khi response trả về → dialog đóng, row tạo 1 lần. | Bảng chỉ có 1 row mới (không bị tạo nhiều lần). |

---

### Module: Edit user

#### SC-09 — Sửa fullName *(EPIC-004-AC12, AC13)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Trên row `qa-test1`, click icon Pencil. | Dialog "Sửa thông tin user" mở. |
| 2 | Quan sát các field | Username = "qa-test1" greyed, Vai trò = "User" greyed (read-only). Tên đầy đủ = "QA Test One" editable. Không có field Mật khẩu. |
| 3 | Đổi Tên thành "QA Tester One" | Nút Lưu enabled. |
| 4 | Click Lưu | Toast xanh "Đã cập nhật thông tin user". Dialog đóng. Bảng row hiện Tên mới. |

#### SC-10 — Không thay đổi gì → Save disabled *(EPIC-004-AC14)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Click Pencil trên row `qa-test1`. Dialog mở với "QA Tester One" pre-filled. | OK. |
| 2 | Không gõ gì. | Nút Lưu **disabled**. |
| 3 | Gõ thêm 1 ký tự vào fullName rồi xoá đi (về cũ). | Lưu lại disabled (no diff vs server). |

---

### Module: Permissions matrix

#### SC-11 — Mở dialog phân quyền cho user *(EPIC-004-AC15)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Trên row `qa-test1`, click icon Shield. | Dialog "Phân quyền: qa-test1" mở. |
| 2 | Trong ≤ 1s, matrix 5×4 hiển thị | 5 rows: Dashboard, Quản lý kho, Xuất nhập kho, Báo cáo, Quản trị users. 4 cols: Xem, Thêm, Sửa, Xoá. Có cột "Tất cả" bên phải. |
| 3 | Quan sát default | `Dashboard.Xem`, `Quản lý kho.Xem`, `Xuất nhập kho.Xem` được tick (default permissions từ EPIC-003 S3). Còn lại unticked. |

#### SC-12 — Đổi quyền + Save *(EPIC-004-AC16, AC17)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở matrix cho `qa-test1`. | OK. |
| 2 | Tick `Quản lý kho.Sửa`. | Save enabled. |
| 3 | Tick `Xuất nhập kho.Thêm`. | Save vẫn enabled. |
| 4 | Click Lưu. | Toast xanh "Đã cập nhật quyền". Dialog đóng. |
| 5 | Mở lại Shield dialog cho cùng user. | Matrix hiển thị các thay đổi đã persistent. |

#### SC-13 — Toggle "Tất cả" cho row *(EPIC-004-AC18)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở matrix dialog cho `qa-test1`. | OK. |
| 2 | Trên row "Báo cáo" (đang tất cả unticked), click "Tất cả" button | Cả 4 checkbox (Xem/Thêm/Sửa/Xoá) cùng tick → on. |
| 3 | Click "Tất cả" lần nữa trên cùng row | Cả 4 untick. |

#### SC-14 — Save disabled khi không có diff *(EPIC-004-AC16 dirty check)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở matrix dialog, đợi load xong. | OK. |
| 2 | Không tick/untick gì. | Nút Lưu **disabled**. |
| 3 | Tick rồi untick lại 1 checkbox (về trạng thái ban đầu). | Lưu disabled. |

#### SC-15 — Dialog matrix cho admin = read-only *(EPIC-004-AC20)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Trên row `admin` (admin gốc), click icon Shield. | Dialog mở. Trên đầu có dòng "Admin có toàn quyền mặc định. Không thể chỉnh sửa quyền cho admin." |
| 2 | Quan sát các checkbox | Tất cả 20 checkbox đều TICKED + DISABLED (không click được). |
| 3 | Click "Tất cả" buttons | Cũng disabled. |
| 4 | Nút Lưu | Disabled. |

#### SC-16 — Permission propagation ≤ 1s (invalidate-on-write) *(EPIC-003-AC16 — regression for this flow)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập `qa-test1` (sau khi đã đặt pw đầu tiên) ở **browser thứ 2** (Chrome Incognito). | Vào dashboard. |
| 2 | Trong browser thứ 2, vào `/inventory` → POST sản phẩm (hoặc click Edit). | Server trả 403 — user không có `inventory.update`. |
| 3 | Quay lại browser **admin** (browser 1). Mở matrix cho `qa-test1`, tick `inventory.update`, Lưu. | Toast success. |
| 4 | Lập tức (≤ 1 giây) quay lại browser 2, retry POST. | 200. User mới có thể sửa kho. |

---

### Module: Reset password

#### SC-17 — Reset password full flow *(EPIC-004-AC21, AC22, AC23, AC24)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Trên row `qa-test1`, click icon Key. | AlertDialog "Reset mật khẩu cho 'qa-test1'?" với cảnh báo "Tất cả phiên đăng nhập hiện tại sẽ bị thu hồi". |
| 2 | Click "Reset mật khẩu" (red button). | Sau ≤ 1s, dialog đổi sang stage 2: hiển thị temp pw 16 ký tự trong khung monospace, kèm cảnh báo đỏ "Mật khẩu này chỉ hiển thị 1 LẦN…". |
| 3 | Quan sát pw | Có cả chữ hoa, chữ thường, số, ký tự đặc biệt. Đúng 16 ký tự. |
| 4 | Click button "Copy mật khẩu" | Toast "Đã copy vào clipboard". Mở Notepad / TextEdit dán → có pw chính xác. |
| 5 | Click "Đóng" hoặc nhấn Esc | Dialog đóng. |
| 6 | Mở lại dialog reset cho cùng user `qa-test1` | Bắt đầu lại từ stage "confirm" — KHÔNG hiển thị pw cũ. |

#### SC-18 — Reset PW: kiểm tra pw không trong storage *(EPIC-004-AC24, AC25)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Lặp lại SC-17 đến bước 4. KHÔNG đóng dialog. | Modal vẫn hiển thị pw. |
| 2 | Mở DevTools (F12) → Application → Local Storage cho domain hiện tại. | Tìm trong tất cả keys — KHÔNG có entry nào chứa pw. |
| 3 | Cùng tab Application → Session Storage. | Cũng không có pw. |
| 4 | Đóng dialog. Sau đó reload trang (Ctrl+R). | Trang về list users; pw không thể truy hồi bằng cách nào. |

#### SC-19 — Reset PW: user phiên cũ bị logout *(EPIC-002-AC30 — regression)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Browser 2 đang đăng nhập là `qa-test1`. | Vào dashboard OK. |
| 2 | Browser 1 (admin) reset pw cho `qa-test1`. | OK. |
| 3 | Quay lại browser 2 → click bất kỳ link nào hoặc đợi 30s (nếu polled). | Bị redirect về `/login` trong ≤ 2 giây (401 từ middleware). |
| 4 | Browser 2: đăng nhập với pw mới (đã copy ở SC-17). | Vào `/change-password` dialog (forced first-login). |

---

### Module: Logout-all

#### SC-20 — Force logout-all *(EPIC-004-AC26, AC27)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Browser 2 + browser 3 đều đang login as `qa-test1`. | Mỗi browser cập nhật được dashboard. |
| 2 | Browser 1 (admin), trên row `qa-test1`, xem cột "Phiên" | Badge hiện `2`. |
| 3 | Click icon LogOut | AlertDialog "Đăng xuất 'qa-test1' khỏi mọi thiết bị?" |
| 4 | Click "Xác nhận" | Toast "Đã đăng xuất 2 phiên của 'qa-test1'". Bảng refresh; cột Phiên = 0. |
| 5 | Browser 2 + 3 click bất kỳ link nào | Bị redirect login trong ≤ 2s. |

---

### Module: Delete user (soft)

#### SC-21 — Soft-delete thành công *(EPIC-004-AC28, AC29)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Trên row `qa-test1`, click icon Trash (màu đỏ). | AlertDialog "Xoá user 'qa-test1'?" với cảnh báo soft-delete + giữ audit. |
| 2 | Click "Xác nhận" (button red). | Toast "Đã xoá user 'qa-test1'". Row biến mất khỏi bảng. |
| 3 | Login attempt từ browser 2 với username `qa-test1` + pw cũ | 401 "Sai username hoặc password". (User soft-deleted không login được.) |
| 4 | Kiểm tra DB: `SELECT deleted_at FROM users WHERE username='qa-test1'` (nếu có DB access) | `deleted_at` không null. |

#### SC-22 — Tự xoá mình bị chặn *(EPIC-004-AC30)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập với `admin` (mặc định là admin duy nhất). | OK. |
| 2 | Trên row của `admin` chính mình, click Trash → "Xác nhận". | Toast đỏ "Không thể tự xoá tài khoản của mình." Row không biến mất. |

#### SC-23 — Xoá admin cuối cùng bị chặn *(EPIC-004-AC31)* — READY (multi-admin setup)

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Tạo `admin2` (role=admin) qua dialog Thêm user. | OK. |
| 2 | Đổi pw admin2 lần đầu (login flow). | OK. |
| 3 | Đăng nhập với `admin2`. Xoá user `admin` (gốc). | Thành công. Row admin biến mất. |
| 4 | Trên row `admin2` (chính mình), Trash → confirm. | Toast "Không thể tự xoá…" (AC30 — không phải AC31, nhưng bảo vệ cùng lúc). |
| 5 | Nếu cố cách khác — tạo `intruder` (user) → đăng nhập as intruder → cố call DELETE admin2 qua DevTools / curl. | 403 (non-admin không access endpoint). |

---

### Edge & error scenarios

#### SC-24 — Mạng fail giữa flow *(EPIC-004-AC33)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Mở dialog Thêm user, điền input. | OK. |
| 2 | DevTools → Network → Offline. | Network offline indicator. |
| 3 | Click Save. | Toast đỏ "Không thể kết nối tới máy chủ" hoặc "Failed to fetch". Dialog **vẫn mở**, input giữ nguyên. |
| 4 | Network → Online. Retry click Save. | Lần này thành công bình thường. |

#### SC-25 — Token hết hạn giữa flow *(EPIC-004-AC34)* — READY (manual time-out)

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng nhập admin → mở dialog Permissions. | OK. |
| 2 | Trong DevTools / redis-cli: `DEL session:<jti>` của admin (mô phỏng token mất hiệu lực server-side). | Key xoá. |
| 3 | Trong dialog, tick checkbox → Save. | Server 401 → FE bắt 401 → auto redirect login. Dialog đóng. |

#### SC-26 — Bảng rỗng *(EPIC-004-AC02 empty state)* — READY (fresh DB)

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Reset DB (`docker compose down -v && docker compose up -d`). Login admin (default seed). | Dashboard. |
| 2 | Vào /admin/users | Bảng có 1 row: chính `admin`. (Hoặc nếu logic loại bỏ self thì hiện text "Chưa có user nào ngoài admin…".) |
| 3 | Verify | Tùy implementation hiện tại: hiện thấy admin row. |

#### SC-27 — Refresh trang khi đang ở /admin/users *(pre-existing FE limitation)* — READY

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | Vào /admin/users. | OK. |
| 2 | Nhấn F5 / Cmd+R. | Trang load lại từ đầu → quay về `/dashboard` (do FE không có client routing). Document trong PRD §3 risk. |

---

### Audit log verification *(EPIC-004-AC32)*

#### SC-28 — Mỗi UI action ghi 1 audit row — READY

**Prereq:** psql access hoặc /api/admin/audit endpoint hoạt động (đã có ở EPIC-003 S4 backend).

| Bước | Hành động | Kết quả mong đợi |
|---|---|---|
| 1 | psql ... `SELECT COUNT(*) FROM audit_logs` → ghi nhận số đầu là N. | N. |
| 2 | Qua UI làm tuần tự: tạo user (qa-x) → edit fullName → set permissions → reset pw → logout-all → delete. | Tất cả 6 action thành công. |
| 3 | psql lại `SELECT COUNT(*) FROM audit_logs` | = N + 6. |
| 4 | psql `SELECT action FROM audit_logs ORDER BY at DESC LIMIT 6` | Theo thứ tự ngược: `user.delete, user.logout_all, password.reset, user.permissions.update, user.update, user.create`. |

---

## 3. Regression Quick Check

Sau khi merge, chạy nhanh:

| # | Hành động | Kết quả |
|---|---|---|
| R1 | Login as admin → dashboard 4 màu | OK (EPIC-002-AC40) |
| R2 | Sidebar vẫn fixed khi scroll | OK (EPIC-002-AC38) |
| R3 | Import xlsx vẫn được | OK |
| R4 | EPIC-001 search vẫn được | OK |
| R5 | Logout vẫn invalidate session | OK (EPIC-002-AC17) |
| R6 | Add transaction vẫn được | OK |
| R7 | `/api/health` JSON verbose | OK (EPIC-003-AC05) |
| R8 | Audit log ghi cho mọi write | OK (EPIC-002-AC31) |
| R9 | Sidebar item "Quản trị users" CHỈ hiện cho admin | OK (EPIC-004-AC01) |
| R10 | Login as `qa-user-readonly`; POST product (curl) → 403 | OK (EPIC-002-AC21 / EPIC-003-AC15) |

---

## 4. Verdict & Sign-off

### Pass criteria
- All READY scenarios SC-01..SC-28 PASS.
- R1..R10 regression PASS.
- 0 console error mới trong DevTools sau khi làm các flow.
- DevTools Application tab: temp pw **không** trong localStorage / sessionStorage sau khi đóng Reset PW dialog (SC-18).

### Fail criteria (release blockers)
- Non-admin có thể vào `/admin/users` và làm được CRUD (SC-03 fail).
- Reset PW dialog rò pw vào storage (SC-18 fail).
- Self-delete success (SC-22 fail) — security violation.
- Permission matrix dialog cho phép edit admin perms (SC-15 fail) — UX/logical violation.

### Sign-off

| Field | Value |
|---|---|
| Tester name | __________________________ |
| Date tested | __________________________ |
| Build / commit SHA | __________________________ |
| Browser + version | __________________________ |
| Environment (local/staging/prod) | __________________________ |
| Verdict (PASS / PASS-WITH-DEFECTS / FAIL) | __________________________ |
| Tester signature | __________________________ |
| Reviewer (TL) | __________________________ |

### Defect log

| # | Scenario | Severity (Blocker/High/Medium/Low) | Description | Screenshot | Ticket |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

---

## 5. Traceability Matrix

| AC | Scenario(s) | Status |
|---|---|---|
| EPIC-004-AC01 | SC-01 | READY |
| EPIC-004-AC02 | SC-02 | READY |
| EPIC-004-AC03 | SC-03 | READY |
| EPIC-004-AC04 | SC-04 step 6 (icon vàng) | READY |
| EPIC-004-AC05 | SC-04 step 6 (cột Phiên = 0); SC-20 step 2 (= 2) | READY |
| EPIC-004-AC06 | SC-04 step 3 | READY |
| EPIC-004-AC07 | SC-04 step 5+6 | READY |
| EPIC-004-AC08 | SC-06 | READY |
| EPIC-004-AC09 | SC-07 | READY |
| EPIC-004-AC10 | SC-05 | READY |
| EPIC-004-AC11 | SC-08 | READY |
| EPIC-004-AC12 | SC-09 step 2 | READY |
| EPIC-004-AC13 | SC-09 step 4 | READY |
| EPIC-004-AC14 | SC-10 | READY |
| EPIC-004-AC15 | SC-11 | READY |
| EPIC-004-AC16 | SC-12, SC-14 | READY |
| EPIC-004-AC17 | SC-12 step 4 | READY |
| EPIC-004-AC18 | SC-13 | READY |
| EPIC-004-AC19 | SC-12 (user role, ticks enabled) | READY |
| EPIC-004-AC20 | SC-15 | READY |
| EPIC-004-AC21 | SC-17 step 1 | READY |
| EPIC-004-AC22 | SC-17 step 2-3 | READY |
| EPIC-004-AC23 | SC-17 step 4 | READY |
| EPIC-004-AC24 | SC-17 step 6; SC-18 | READY |
| EPIC-004-AC25 | SC-18 step 4 | READY |
| EPIC-004-AC26 | SC-20 step 3 | READY |
| EPIC-004-AC27 | SC-20 step 4 | READY |
| EPIC-004-AC28 | SC-21 step 1 | READY |
| EPIC-004-AC29 | SC-21 step 2 | READY |
| EPIC-004-AC30 | SC-22 | READY |
| EPIC-004-AC31 | SC-23 | READY |
| EPIC-004-AC32 | SC-28 | READY |
| EPIC-004-AC33 | SC-24 | READY |
| EPIC-004-AC34 | SC-25 | READY |
| AC35, AC36, AC37 | (Won't) | OUT OF SCOPE |

**Summary:** 28 scenarios READY, all M+S AC mapped. 0 deferred. 0 blocked.

---

## 6. Hotfix verification (RUN FIRST — must PASS before §2 scenarios)

These 4 scenarios verify the 2026-06-13 hotfix patches that addressed user-reported HTTP 500 / 403 with empty bodies. If any of these fail, the rest of the test pass will surface the same symptoms.

### SC-29 — Redis AllowAdmin: `/api/admin/users` returns 200 not 500 *(Bug 1 fix)* — READY

**What we're testing:** Listing users no longer crashes due to `IServer.KeysAsync` requiring `AllowAdmin` on the Redis connection.

| Step | Action | Expected |
|---|---|---|
| 1 | `docker compose up -d` clean state. Login as `admin` via web. Grab `$TOKEN` from DevTools Application → Local Storage → `auth_token`. | OK. |
| 2 | Terminal: `curl -s -w "\nHTTP %{http_code}\n" http://localhost:3001/api/admin/users -H "Authorization: Bearer $TOKEN"` | HTTP **200** with a JSON array body. **NOT** 500. |
| 3 | UI: Click sidebar "Quản trị users". | Trang load không lỗi; table user hiện. **KHÔNG** có error toast "Lỗi máy chủ". |
| 4 | Pick any user → click LogOut icon → confirm. | Toast "Đã đăng xuất X phiên". **KHÔNG** 500 error. (Đây test SCAN-based `RevokeAllForUserAsync`.) |
| 5 | DevTools Network tab: inspect `GET /api/admin/users` request. | Status 200; response body is a JSON array. |

**FAIL signature:** status 500 with empty body on step 2 → hotfix not applied. Verify `Program.cs` has `options.AllowAdmin = true`.

### SC-30 — 403 has JSON body with `permission_denied` code *(Bug 2 fix)* — READY

**What we're testing:** Permission-denied responses now carry a parseable body instead of being empty.

**Prereq:** Create a non-admin user `qa-noperm` (via SC-04 flow) with **no** custom permissions (default = inventory.view only).

| Step | Action | Expected |
|---|---|---|
| 1 | Login as `qa-noperm` (after first-login pw change). Grab `$USER_TOKEN`. | OK. |
| 2 | Terminal: `curl -s -i http://localhost:3001/api/admin/users -H "Authorization: Bearer $USER_TOKEN"` | First line: `HTTP/1.1 403 Forbidden`. **Body:** exactly `{"error":"Không có quyền thực hiện hành động này","code":"permission_denied"}` (possibly with extra whitespace). |
| 3 | Same user: try `curl -s -i -X POST http://localhost:3001/api/products -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d '[]'`. | 403 with same JSON body (covers EPIC-003-AC15 closure for non-admin endpoint). |
| 4 | UI: Login as `qa-noperm`; try to navigate to `/admin/users` (force via state manipulation in DevTools if no router). | Toast hiện thông báo "Không có quyền thực hiện hành động này" — **không phải** empty / blank. |

**FAIL signature:** empty 403 body or default ASP.NET `{"title":"Forbidden","status":403}` → `JsonAuthorizationMiddlewareResultHandler` not registered.

### SC-31 — 401 challenge has JSON body *(Bug 2 fix part 2)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `curl -s -i http://localhost:3001/api/admin/users` (no Bearer header). | 401 with body `{"error":"Phiên đăng nhập đã kết thúc","code":"unauthorized"}`. |
| 2 | Try with garbage Bearer: `curl -s -i http://localhost:3001/api/admin/users -H "Authorization: Bearer garbage"`. | 401 with same body shape (JWT signature invalid → challenge). |

### SC-32 — Unhandled 500 has JSON body *(Bug 3 fix)* — READY

**What we're testing:** Even when an unexpected exception bubbles up, the FE gets a meaningful body.

| Step | Action | Expected |
|---|---|---|
| 1 | Login as admin → grab `$TOKEN`. | OK. |
| 2 | Force an unhandled error by sending malformed JSON body to a write endpoint: `curl -s -i -X POST http://localhost:3001/api/transactions -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d 'not-valid-json'`. | Status code is 4xx or 500. **If 500**: body is `{"error":"Lỗi máy chủ. Vui lòng thử lại hoặc liên hệ admin.","code":"internal_error","detail":"..."}` (detail only in dev env). |
| 3 | Stop Postgres mid-flight: `docker compose stop postgres`. Then in browser, click Refresh on `/admin/users`. | UI shows toast — not blank. Toast text either from a `503` (preferred via `JsonAuthorizationMiddlewareResultHandler` for auth flow) or from `readError` fallback "Lỗi máy chủ (HTTP 500)". |
| 4 | `docker compose start postgres`; wait until `/api/health` returns 200; retry. | Trang load lại bình thường. |

**FAIL signature:** Blank toast in UI (no message) or curl returns empty body on 500.

### SC-33 — FE `readError` fallback for empty-body responses *(FE hotfix)* — READY

**What we're testing:** Even if a proxy/intermediate strips the body, the FE still shows a useful Vietnamese message.

| Step | Action | Expected |
|---|---|---|
| 1 | Open DevTools → Network → right-click any request → "Block request URL pattern" → block `/api/admin/users`. | Subsequent calls fail with status `(failed)` net::ERR. |
| 2 | Navigate to `/admin/users`. | Toast displays "Không tải được danh sách user: …" with a meaningful trailing message (likely "Failed to fetch" from native fetch — acceptable). |
| 3 | Unblock; manually corrupt server's 403 response (advanced — use a reverse proxy to drop body). Skip if no proxy available. | Toast shows "Không có quyền thực hiện hành động này" (the status-code fallback in `readError`). |
| 4 | Manually use DevTools "Override response" to return 500 with empty body for `/api/admin/users`. | Toast shows "Lỗi máy chủ (HTTP 500)". |

---

## 7. v2 Traceability — hotfix scenarios

| Hotfix bug | Scenario(s) |
|---|---|
| Bug 1: Redis AllowAdmin → 500 on list users | SC-29 |
| Bug 2: 403/401 empty body | SC-30, SC-31 |
| Bug 3: Unhandled 500 empty body | SC-32 |
| FE readError fallback | SC-33 |

**Updated pass criteria:** SC-29..SC-32 are **gating** — must PASS before §4 sign-off. SC-33 is recommended verification with creative use of DevTools.

**Updated FAIL criteria (releaseblockers, v2):**
- Any of SC-29..SC-32 fail.
- Original §4 FAIL criteria still apply.
