# TEST-SCRIPT — EPIC-005 (UAT)

**Epic:** EPIC-005 — Nâng cấp giao diện
**Branch under test:** `feature/EPIC-005-ui-foundation`
**For:** Manual / UAT testers + product owner sign-off on visual choices
**Last updated:** 2026-06-13

> **Important — current build scope:** Only **S1 Foundation + Dashboard demo polish** has been implemented in this branch. **S2–S6 (per-page migrations: Inventory, Transactions/Search/Reports, Admin pages, Dashboard fine-tune, Sidebar+topbar)** are intentionally deferred until the user reviews the Dashboard look-and-feel and signs off on the muted-pastel palette decision.
>
> Mark scenarios as:
> - **READY** = testable now (S1 + Dashboard)
> - **DEFERRED** = will be testable after corresponding S2..S6 PRs land
> - **GATING** = user sign-off needed before S2..S6 proceed

---

## 1. Prerequisites

### 1.1 Environment

| Item | Value |
|---|---|
| Frontend dev URL | `http://localhost:5173` (`npm run dev`) |
| Frontend build URL | `http://localhost:8080` (docker `web` service) |
| Backend URL | `http://localhost:3001/api` |
| Browser | Chrome ≥ 100 (primary). Spot-check Edge ≥ 100, Firefox ≥ 100, Safari ≥ 15. |
| Viewport | Desktop 1280px (primary) + mobile 414px (smoke) |
| Locale | vi-VN |
| Color check tool | Chrome DevTools → Lighthouse → "Accessibility" + Rendering → "Emulate vision: deuteranopia" |
| Bundle size tool | `npm run build` → inspect `dist/assets/*.css` file size |

### 1.2 Test accounts

Reuse from EPIC-004:
- `admin` (admin role)
- A force-change-pw user (created via `/admin/users` — e.g. `qa-test1` from EPIC-004 SC-04). Used to trigger `notify.warn`.

### 1.3 Pre-test setup

1. `docker compose up -d`.
2. `cd src && npm install && npm run dev` (or use the built docker web image).
3. Seed at least 3 products: 1 với `tonKho < 10` (low), 1 với `tonKho` 10-49 (normal), 1 với `tonKho ≥ 50` (high). Easiest path: import the test xlsx from EPIC-001.
4. Trigger at least 2 transactions (1 import + 1 export) so Dashboard "Giao dịch gần đây" has content.

---

## 2. Scenarios

### Module: Design tokens & foundation files

#### SC-01 — `epic005-tokens.css` được load *(EPIC-005-AC01)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Mở `http://localhost:5173`. Mở DevTools → Sources tab. | OK. |
| 2 | Tìm file `epic005-tokens.css` trong Sources tree. | File tồn tại; có thể view content. |
| 3 | Trên tab Elements, chọn `<html>` element. Trong Computed tab phải bên, search `--accent-success-50`. | Có CSS custom property với value `#ecfdf5`. |
| 4 | Tương tự kiểm `--accent-error-50` (`#fef2f2`), `--accent-warn-50` (`#fffbeb`), `--accent-info-50` (`#eff6ff`). | All present. |

#### SC-02 — Import order (epic005-tokens.css load LAST) *(EPIC-005-UT-CSS-IMPORT-ORDER-001 enforcement)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Mở `src/styles/index.css` trong repo. | OK. |
| 2 | Đọc thứ tự `@import`. | Thứ tự đúng: `fonts.css` → `tailwind.css` → `theme.css` → **`epic005-tokens.css` LAST**. |

> Lý do: epic005-tokens.css dùng `!important` cho toast variants — phải load cuối để win cascading.

---

### Module: Toast variants (notify.*)

#### SC-03 — `notify.success` có icon + background xanh *(EPIC-005-AC02)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login as `admin`. | Dashboard load. |
| 2 | Vào `/inventory`. Edit 1 sản phẩm. Đổi giá vốn → Lưu. | Toast hiện ở top-right: **background xanh nhạt** (#ecfdf5), border xanh đậm hơn, icon **CheckCircle2** (vòng tròn có dấu tick), text "Đã cập nhật sản phẩm". |
| 3 | Hover toast | Toast persistent ≥ 3s. Tự fade. |

> Note: Lệnh `toast.success(...)` cũ trong InventoryManagement.tsx CHƯA migrate sang `notify.success` (đó là S2). Vẫn dùng Sonner default style. **Scenario này test `notify.success` directly** — phải trigger từ App.tsx flow đã migrate.

**Alternative test trigger (READY):** Stop Postgres → click "Tải lại" trên `/inventory` → `notify.error('Không tải được dữ liệu...')` fires → SC-04.

#### SC-04 — `notify.error` có icon + background đỏ *(EPIC-005-AC02)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login as `admin`. Mở `/inventory`. | Bảng product hiển thị. |
| 2 | Terminal: `docker compose stop postgres`. | Postgres dừng. |
| 3 | UI: click "Tải lại". | Toast hiện: **background đỏ nhạt** (#fef2f2), border đỏ đậm hơn, icon **XCircle** (vòng tròn có dấu X), text "Không tải được dữ liệu: …". |
| 4 | Terminal: `docker compose start postgres`; wait healthy. | OK. |

#### SC-05 — `notify.warn` cho first-login force-change-pw *(EPIC-005-AC02)* — READY

**Prereq:** Có user `qa-test1` đã được admin reset pw (must_change_password=true).

| Step | Action | Expected |
|---|---|---|
| 1 | Login as `qa-test1` với temp pw. | Sau khi đăng nhập thành công, **toast warn** hiện: **background vàng nhạt** (#fffbeb), border vàng đậm hơn, icon **AlertTriangle** (tam giác cảnh báo), text "Cần đổi mật khẩu trước khi dùng". ChangePasswordDialog cũng mở. |

#### SC-06 — `notify.info` smoke *(EPIC-005-AC02)* — READY (DevTools console trigger)

| Step | Action | Expected |
|---|---|---|
| 1 | Trên bất kỳ trang nào, mở DevTools Console. | OK. |
| 2 | Gõ vào Console: `(await import('/src/app/design/toast-config.tsx')).notify.info('Test info toast')`. (Hoặc dùng Source map nếu Vite map khác.) | Toast hiện: **background xanh dương nhạt** (#eff6ff), icon **Info** (chữ i trong vòng tròn). |

> Nếu Console import path không work do bundling, scenario này tạm coi là **DEFERRED** đến khi có FE test runner.

---

### Module: Dashboard polish (S1 demo)

#### SC-07 — Low-stock list dùng pill màu đỏ *(EPIC-005-AC03, AC05)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login admin → Dashboard. | Trang load. |
| 2 | Quan sát thẻ "Sản phẩm tồn kho thấp" (bên dưới 4 KPI cards). | Hiển thị list sản phẩm có `tonKho < 10`. |
| 3 | Quan sát giá trị tồn ở mỗi hàng | **KHÔNG** còn text màu đỏ plain. Thay vào đó là **pill chip** (rounded-full), background đỏ nhạt (red-100), text đỏ đậm (red-800), border red-200. |
| 4 | Hover pill | Native tooltip hiện "Tồn kho thấp". |

**Screenshot required**: Capture toàn bộ Dashboard cho user review.

#### SC-08 — Recent transactions list dùng pill *(EPIC-005-AC03, AC05)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Trên Dashboard, quan sát thẻ "Giao dịch gần đây" (bên phải low-stock). | Hiển thị tối đa 5 giao dịch gần nhất. |
| 2 | Mỗi giao dịch type=`import` | **Pill** background `bg-emerald-50` (xanh ngọc nhạt), text `text-emerald-700` (xanh ngọc đậm), prefix `+` với số. |
| 3 | Mỗi giao dịch type=`export` | **Pill** `bg-rose-50` (hồng đỏ nhạt), text `text-rose-700` (hồng đỏ đậm), prefix `-`. |
| 4 | Không có giao dịch nào | "Chưa có giao dịch nào" text hiển thị. |

**Screenshot required**: Recent transactions block.

#### SC-09 — Empty state khi không có low-stock *(EPIC-005-AC05 boundary)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Truy cập DB hoặc import xlsx mới sao cho không có product nào `tonKho < 10`. | OK. |
| 2 | Reload Dashboard. | Thẻ "Sản phẩm tồn kho thấp" hiện text "Không có sản phẩm tồn kho thấp". KHÔNG có pill. |

---

### Module: A11y / contrast / WCAG

#### SC-10 — WCAG contrast check *(EPIC-005-AC10)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Mở Chrome DevTools → Lighthouse tab → check "Accessibility" only → Generate report on Dashboard. | Score ≥ 90. **Không** có violation mới so với baseline trước EPIC-005. |
| 2 | Inspect pill `bg-red-100` + `text-red-800` trong DevTools → tab Computed → đọc contrast ratio | ≥ 4.5:1 (WCAG AA text). Chrome DevTools tính sẵn. |
| 3 | Tương tự cho `bg-emerald-100` + `text-emerald-800`. | ≥ 4.5:1. |
| 4 | Pill `bg-emerald-50` + `text-emerald-700` (TX import) | ≥ 4.5:1. |
| 5 | Pill `bg-rose-50` + `text-rose-700` (TX export) | ≥ 4.5:1. |

#### SC-11 — Colorblind simulation *(EPIC-005-AC03 robustness)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Chrome DevTools → 3-dot menu → "More tools" → "Rendering" → "Emulate vision deficiencies" → "Deuteranopia". | Trang render khác. |
| 2 | Quan sát Dashboard 4 KPI cards + low-stock pills + transaction pills. | 4 KPI cards (indigo/emerald/amber/purple) vẫn distinguishable bằng position + label, dù chính xác hue khác. Low-stock pill vẫn rõ là "alert" do contrast. TX pills phân biệt được nhau qua position + +/− prefix (không chỉ dựa màu). |
| 3 | Switch sang "Protanopia" + "Tritanopia". | Tương tự. |

---

### Module: Bundle size budget

#### SC-12 — Bundle delta ≤ 2 KB gzipped *(EPIC-005 DoD §16)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | `git checkout main`. | Repo trên main branch. |
| 2 | `npm run build`. Note size of `dist/assets/index-*.css` (e.g., 35,124 B). | Baseline. |
| 3 | `git checkout feature/EPIC-005-ui-foundation`. `npm run build`. Note size again. | Slightly larger. |
| 4 | Diff: `(new_size - old_size)`. | ≤ 1500 B raw (≈ 600 B gzipped). |
| 5 | Total `dist/` size for `index-*.js`. | Diff ≤ 1000 B. (Pure constants tree-shake to near-zero.) |

---

### Module: Functional regression *(EPIC-005-AC09)*

#### SC-13 — Login + Dashboard load OK — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Login as `admin`. | Vào dashboard. |
| 2 | Quan sát 4 KPI cards | Vẫn 4 màu indigo/emerald/amber/purple (EPIC-002 polish — chưa thay đổi). |
| 3 | Console errors? | Không có. |

#### SC-14 — EPIC-001 search vẫn được — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Vào `/inventory`. Search "cà phê". | Bảng lọc đúng. |

#### SC-15 — EPIC-002 sidebar fixed vẫn được — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Viewport ≥ 1280px. Vào `/inventory` (nhiều sản phẩm). Scroll xuống. | Sidebar đứng yên trên trái. |

#### SC-16 — EPIC-003 admin endpoints — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Vào `/admin/users`. | List user load (sử dụng SCAN Redis từ EPIC-004 hotfix). Không 500. |

#### SC-17 — EPIC-004 user CRUD vẫn được — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Trên `/admin/users`, tạo user mới, set permissions, reset pw, xoá. | Tất cả flow hoạt động bình thường. Pre-existing toasts (vẫn dùng `toast.success`/`toast.error` từ Sonner default — chưa migrate vì S4 deferred). |

---

### Module: Mobile / responsive

#### SC-18 — Mobile viewport legibility *(EPIC-005-AC11)* — READY

| Step | Action | Expected |
|---|---|---|
| 1 | DevTools → Device toolbar → iPhone 14 (390×844). | Layout đáp ứng. |
| 2 | Dashboard pills (low-stock + transactions) | Không bị tràn ngang. Pill text vẫn đọc được. |
| 3 | Toast hiển thị (trigger qua SC-04 hoặc force notify) | Width responsive, không vượt viewport. |

---

### Module: User sign-off gate *(GATING)*

#### SC-19 — Muted pastel palette sign-off *(EPIC-005 TECH-DESIGN §14 Q1)* — GATING

| Step | Action | Expected |
|---|---|---|
| 1 | Tester chụp screenshot toàn bộ Dashboard ở 1280px. | Captured. |
| 2 | Gửi screenshot cho user (PO proxy) qua kênh ngoài (Slack / email). | OK. |
| 3 | User review và phản hồi 1 trong 3: | (a) "OK — proceed S2..S6", (b) "Đổi sang brighter saturated", (c) "Đổi sang specific hue X". |
| 4 | Document phản hồi user vào `docs/epics/EPIC-005/artifacts/IMPLEMENT-SUMMARY.md` §3 update. | OK. |

**Gate condition:** Không proceed với S2..S6 cho đến khi user reply ở step 3.

---

## 3. Edge & error scenarios

#### SC-20 — Khi Sonner update phá vỡ class merging — READY (synthetic test)

| Step | Action | Expected |
|---|---|---|
| 1 | Inspect toast DOM element khi `notify.success` fire. | Element có `data-sonner-toast` attribute + class `toast-success`. |
| 2 | Đọc computed style của bg/color/border. | Match các CSS rule trong epic005-tokens.css (success-50/700/500). |

> Nếu Sonner update sau này thay đổi DOM structure, scenario này sẽ fail và alert team cần adjust selector.

#### SC-21 — Tab table hover (foundation feature, opt-in) — READY

| Step | Action | Expected |
|---|---|---|
| 1 | Trên trang nào đó dùng `<TableRow className="epic005-row">` (chưa có — sẽ ship trong S2). | DEFERRED. |
| 2 | Hover hàng table | bg đổi sang gray-50 với transition 80ms. |

→ **DEFERRED** đến S2 (Inventory page) thêm `epic005-row` class.

---

## 4. Deferred scenarios (post-S2..S6)

Sau khi S2..S6 land, các scenario sau sẽ activate:

| ID | Scope | AC |
|---|---|---|
| SC-22 (S2) | Inventory page: action buttons dùng `ACTION` const, table row hover, toast → `notify` | AC04, AC07 |
| SC-23 (S3) | TransactionForm + ProductSearch + Reports cùng pattern | AC04, AC05 |
| SC-24 (S4) | Admin pages dùng `ACTION` cho mọi icon button; reset-pw dùng `notify.warn`; logout-all + delete dùng destructive variant | AC04, AC08 |
| SC-25 (S5) | Dashboard fine-tune (nếu user feedback yêu cầu) | AC03 |
| SC-26 (S6) | Sidebar active state highlight, login page polish | AC03, AC11 |
| SC-27 (S6 CI) | Static-analysis grep test: mọi `<Button>` chứa lucide icon ref phải có corresponding `ACTION[` ở cùng file | AC04 enforcement |

---

## 5. Regression Quick Check

| # | Action | Expected | Linked EPIC |
|---|---|---|---|
| R1 | docker compose up → 4 services healthy | OK | EPIC-002 |
| R2 | Login admin | Dashboard với 4 KPI cards màu | EPIC-002 AC14, AC40 |
| R3 | Pill low-stock + tx hiển thị **mới** | Pills colored như SC-07/SC-08 | EPIC-005 AC03, AC05 |
| R4 | Sidebar fixed ≥ 1280px | OK | EPIC-002 AC38 |
| R5 | EPIC-001 search "ca phe" | Lọc đúng | EPIC-001 |
| R6 | Add product, edit product | Toast success (Sonner default, sẽ migrate ở S2) | EPIC-002 |
| R7 | EPIC-003 /api/health JSON verbose | OK | EPIC-003 AC05 |
| R8 | EPIC-004 admin/users | List load OK (Redis AllowAdmin) | EPIC-004 hotfix |
| R9 | EPIC-004 reset password flow | Temp pw modal hiện, không storage leak | EPIC-004 AC24 |
| R10 | notify.warn ("Cần đổi mật khẩu") trên first-login | Toast vàng cảnh báo | EPIC-005 AC02 |

---

## 6. Verdict & Sign-off

### Pass criteria
- All READY scenarios SC-01..SC-21 (minus DEFERRED) PASS.
- Regression R1..R10 PASS.
- **SC-19 (sign-off gate)**: user feedback documented before proceeding S2..S6.
- Lighthouse Accessibility ≥ 90 trên Dashboard.
- Bundle delta ≤ 2 KB gzipped.

### Fail criteria
- Console error mới trong DevTools.
- Pill contrast < 4.5:1 (any WCAG-AA violation).
- Toast variants không hiển thị màu / icon đúng.
- Bất kỳ regression R1..R10 fail.
- User reject palette ở SC-19 → trigger redesign trước S2..S6.

### Sign-off

| Field | Value |
|---|---|
| Tester name | __________________________ |
| Date tested | __________________________ |
| Build / commit SHA | __________________________ |
| Browser + version | __________________________ |
| Viewport | __________________________ |
| Lighthouse A11y score (Dashboard) | __________________________ |
| Bundle delta (gzipped) | __________________________ |
| User palette sign-off | YES / NO (with feedback if NO) |
| Verdict | PASS / PASS-WITH-DEFECTS / FAIL |

### Defect log

| # | Scenario | Severity (Blocker / High / Medium / Low) | Description | Screenshot | Ticket |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |

---

## 7. Traceability matrix

| AC | Scenario(s) | Status this build |
|---|---|---|
| EPIC-005-AC01 (design tokens shipped) | SC-01, SC-02 | READY |
| EPIC-005-AC02 (toast variants) | SC-03, SC-04, SC-05, SC-06 | READY |
| EPIC-005-AC03 (Dashboard color accent) | SC-07, SC-08, SC-11 | READY (Dashboard); rest DEFERRED |
| EPIC-005-AC04 (button/icon consistency) | SC-22..SC-27 | DEFERRED to S2..S6 |
| EPIC-005-AC05 (status badge color rule) | SC-07, SC-08, SC-09 | READY (Dashboard); rest DEFERRED |
| EPIC-005-AC06 (search input focus ring) | SC-23 | DEFERRED |
| EPIC-005-AC07 (table row hover) | SC-21 | DEFERRED (foundation CSS ready; pages opt-in via class) |
| EPIC-005-AC08 (destructive delete) | SC-24 | DEFERRED |
| EPIC-005-AC09 (no functional regression) | SC-13..SC-17 + R1..R10 | READY |
| EPIC-005-AC10 (WCAG A11y) | SC-10 | READY |
| EPIC-005-AC11 (mobile legibility) | SC-18 | READY |
| TECH-DESIGN §14 Q1 sign-off | SC-19 | GATING |

**Summary:** 21 scenarios — **15 READY**, **5 DEFERRED** (gated on S2..S6 ship), **1 GATING** (user sign-off blocks subsequent slices).

---

## 8. Note for QA

This is a **visual / UX epic**. Two unusual aspects compared to functional epics:

1. **Subjective sign-off (SC-19)** — palette choice can't be "objectively correct"; user is the proxy PO and must approve before S2..S6 fan out. Don't proceed without documented feedback.
2. **Static-analysis tests (SC-27 deferred)** — once `ACTION` const enforcement lands across all pages (S2..S6 done), add a CI grep test: any `<Button>` containing a `lucide-react` import must be preceded/followed by `ACTION[` in the same file. Allow whitelist marker `// epic005-allow-inline` for justified one-offs.

If S2..S6 are deferred indefinitely, document that as PARTIAL-EPIC closure in IMPLEMENT-SUMMARY and ensure ACs AC04/AC07/AC08 remain on the backlog.
