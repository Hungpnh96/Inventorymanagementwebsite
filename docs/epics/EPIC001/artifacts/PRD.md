# PRD — EPIC001: Quản lý kho - Tìm kiếm nhanh

**Epic ID:** EPIC001
**Owner:** Product Owner
**Status:** Draft v1
**Last updated:** 2026-06-13

---

## 1. Problem & Goal

### Problem
Người dùng (admin và nhân viên kho) hiện phải cuộn qua toàn bộ bảng sản phẩm trong màn hình **Quản lý kho** (`InventoryManagement.tsx`) để tìm một dòng cần chỉnh sửa (sửa, xoá). Khi danh mục có hàng trăm đến hàng nghìn SKU, thao tác này:
- Mất thời gian định vị đúng dòng cần sửa.
- Dễ chọn nhầm dòng do tên/SKU gần giống nhau.
- Làm chậm các nghiệp vụ khẩn (cập nhật giá vốn, sửa tồn kho, xoá sản phẩm lỗi).

### Goal
Cung cấp ô **tìm kiếm nhanh** ngay trên màn hình Quản lý kho, lọc realtime theo từ khoá để người dùng định vị và mở dialog chỉnh sửa/xoá sản phẩm trong **dưới 5 giây** kể từ lúc gõ.

### Outcome metrics
| Loại | Chỉ số | Mục tiêu |
|---|---|---|
| Leading | Tỉ lệ phiên có sử dụng ô search trên màn Quản lý kho | ≥ 60% trong 2 tuần đầu sau release |
| Leading | Thời gian trung bình từ khi gõ ký tự đầu đến khi mở dialog Edit | ≤ 5s (p95 ≤ 8s) |
| Lagging | Số thao tác Edit/Delete sản phẩm trên 1 phiên Quản lý kho | Tăng ≥ 20% so với baseline |
| Guardrail | Tỉ lệ thao tác Edit/Delete bị hoàn tác trong 1 phút (chọn nhầm) | Không tăng so với baseline |
| Guardrail | Lỗi JS/console error trên màn Quản lý kho | 0 lỗi mới do feature |

### Why now
- Danh mục sản phẩm đang phình to qua import Excel → màn hình hiện tại không còn scale.
- Feature có chi phí thấp (frontend-only, không cần thay đổi API), giải toả pain point cao tần suất.
- Khoá block các nâng cấp tiếp theo (bulk edit, filter nâng cao) — search là nền móng.

---

## 2. Scope

### In-scope
- Ô input tìm kiếm trên **màn Quản lý kho** (component `InventoryManagement.tsx`).
- Lọc realtime (debounced) trên dữ liệu **đã load tại client** — không gọi API mới.
- Tìm theo các trường: `maSKU`, `tenSanPham`, `loaiHang`.
- So khớp: **case-insensitive**, **diacritic-insensitive** (gõ "ca phe" tìm ra "Cà Phê"), substring (contains).
- Hiển thị badge số dòng khớp / tổng dòng.
- Nút Clear (X) để xoá nhanh từ khoá.
- Empty state khi không có dòng nào khớp.
- Search giữ nguyên khi mở dialog Edit/Delete và refresh data.

### Out-of-scope (v1)
- Tìm kiếm server-side / phân trang server.
- Bộ lọc nâng cao (filter theo tồn kho > / <, theo loại hàng dropdown).
- Sort cột.
- Bulk select / bulk edit / bulk delete.
- Lưu lịch sử từ khoá tìm kiếm.
- Tìm trên các màn khác (Dashboard, Reports, TransactionForm — đã có `ProductSearch`/`ProductCombobox` riêng).

### Target users
- **Admin kho** (role: `admin`) — thao tác chính: edit, delete, import Excel.
- **Nhân viên** (role: `user`) — chỉ xem, vẫn được dùng search để tra cứu nhanh.

---

## 3. User Flow

### Happy path
1. User vào màn **Quản lý kho**.
2. Bảng sản phẩm hiện đầy đủ; phía trên bảng có ô search với placeholder "Tìm theo SKU, tên sản phẩm, loại hàng…".
3. User gõ từ khoá (ví dụ: "ca phe").
4. Sau **300ms debounce**, bảng lọc còn các dòng khớp; badge hiện "12 / 458 sản phẩm".
5. User click icon Pencil ở dòng cần sửa → dialog Edit mở với dữ liệu sản phẩm.
6. User sửa & lưu → toast success → bảng cập nhật, **từ khoá search vẫn giữ**.

### Error / edge paths
| Tình huống | Hành vi |
|---|---|
| Không có dòng nào khớp | Bảng hiện empty state: "Không tìm thấy sản phẩm khớp với '<từ khoá>'." kèm nút **Xoá bộ lọc**. |
| `products` rỗng (chưa import) | Ô search vẫn enable nhưng disabled-visual; placeholder: "Chưa có sản phẩm. Hãy import file Excel."; hoặc disable theo trạng thái hiện tại của màn. |
| User nhấn Refresh khi đang search | Dữ liệu reload từ server; từ khoá search **giữ nguyên**; bộ lọc áp dụng lại trên data mới. |
| User import Excel mới khi đang search | Sau khi import xong, từ khoá search **giữ nguyên** và lọc trên dataset mới; nếu không còn dòng khớp → empty state như trên. |
| User xoá dòng cuối cùng khớp với từ khoá | Empty state hiện ra; data thực không bị mất, chỉ là filter rỗng. |
| Từ khoá chứa ký tự đặc biệt (`%`, `_`, regex chars) | Treat as literal string (không phải regex); không crash. |
| Từ khoá có khoảng trắng đầu/cuối | Trim trước khi so khớp. |
| Từ khoá rất dài (> 200 ký tự) | Cắt còn 200 ký tự, không crash. |
| Dataset rất lớn (> 5,000 dòng) | Lọc vẫn chạy trên main thread nhưng phải debounce; p95 latency ≤ 200ms từ lúc gõ xong đến khi UI cập nhật. |
| Mất focus rồi quay lại | Từ khoá và kết quả lọc vẫn còn (state giữ trong component). |
| Rời màn rồi quay lại (chuyển tab Dashboard → Quản lý kho) | Search reset về rỗng (không persist cross-route trong v1). |

### Recovery paths
- Nút **X** (clear) trong ô search → xoá từ khoá, hiện lại toàn bộ dòng.
- Nút **Xoá bộ lọc** trong empty state → tương đương Clear.
- Phím **Esc** khi ô search đang focus → clear từ khoá.

---

## 4. Acceptance Criteria

Format: Given / When / Then. ID: `EPIC001-AC<NN>`. Priority: M = Must, S = Should, C = Could, W = Won't.

| ID | Priority | AC |
|---|---|---|
| EPIC001-AC01 | M | **Given** màn Quản lý kho có ít nhất 1 sản phẩm, **When** màn hình render, **Then** ô search hiển thị phía trên bảng sản phẩm với placeholder "Tìm theo SKU, tên sản phẩm, loại hàng…". |
| EPIC001-AC02 | M | **Given** ô search rỗng, **When** user gõ từ khoá, **Then** trong vòng 300–400ms (debounce) bảng chỉ hiện các dòng có `maSKU` HOẶC `tenSanPham` HOẶC `loaiHang` chứa từ khoá. |
| EPIC001-AC03 | M | **Given** user gõ "ca phe" (không dấu), **When** dataset chứa sản phẩm "Cà Phê Robusta", **Then** dòng đó xuất hiện trong kết quả (diacritic-insensitive). |
| EPIC001-AC04 | M | **Given** user gõ "ABC", **When** dataset chứa SKU "abc-001", **Then** dòng đó xuất hiện trong kết quả (case-insensitive). |
| EPIC001-AC05 | M | **Given** có từ khoá đang lọc, **When** không dòng nào khớp, **Then** bảng hiện empty state với text "Không tìm thấy sản phẩm khớp với '<từ khoá>'." và nút "Xoá bộ lọc". |
| EPIC001-AC06 | M | **Given** đang lọc và có ít nhất 1 dòng khớp, **When** user click Pencil ở 1 dòng, **Then** dialog Edit mở với đúng product đã chọn (không bị lệch index do filter). |
| EPIC001-AC07 | M | **Given** đang lọc, **When** user lưu thay đổi trong dialog Edit, **Then** dialog đóng, bảng cập nhật, **từ khoá search vẫn còn nguyên** và filter áp dụng lại. |
| EPIC001-AC08 | M | **Given** đang lọc, **When** user click Refresh, **Then** data reload từ server và từ khoá search vẫn giữ; filter áp dụng trên dataset mới. |
| EPIC001-AC09 | M | **Given** ô search có nội dung, **When** user click icon X (clear) bên trong ô search, **Then** từ khoá bị xoá và bảng hiện toàn bộ sản phẩm. |
| EPIC001-AC10 | M | **Given** ô search đang focus và có nội dung, **When** user nhấn phím Esc, **Then** từ khoá bị xoá và focus vẫn ở ô search. |
| EPIC001-AC11 | S | **Given** đang lọc, **Then** ngay cạnh ô search hiển thị badge "X / Y sản phẩm" với X = số dòng khớp, Y = tổng số dòng. |
| EPIC001-AC12 | S | **Given** user gõ từ khoá có khoảng trắng đầu/cuối, **When** matching, **Then** từ khoá được trim trước khi so khớp. |
| EPIC001-AC13 | S | **Given** từ khoá chứa ký tự đặc biệt regex (`.`, `*`, `(`, `)`, `[`, `]`), **When** matching, **Then** match theo literal string, không throw error. |
| EPIC001-AC14 | S | **Given** dataset có 5,000 sản phẩm, **When** user gõ từ khoá, **Then** p95 thời gian từ keystroke cuối đến render kết quả ≤ 300ms. |
| EPIC001-AC15 | S | **Given** màn Quản lý kho, **When** ô search được hiển thị, **Then** ô search có `aria-label="Tìm kiếm sản phẩm"` và có thể truy cập đầy đủ bằng phím Tab. |
| EPIC001-AC16 | C | **Given** user import Excel mới khi đang có từ khoá search, **When** import xong, **Then** từ khoá search vẫn được giữ và áp dụng trên dataset mới. |
| EPIC001-AC17 | W | Lưu lịch sử từ khoá search (không làm trong v1). |
| EPIC001-AC18 | W | Tìm kiếm cross-route (giữ search khi chuyển tab). |

---

## 5. UI / Design

> Chưa có Figma design — v1 sử dụng convention sẵn có trong codebase (shadcn/ui).

### Layout
- Ô search đặt **phía trên bảng**, **dưới** hàng nút action (Import / Export / Refresh).
- Layout responsive:
  - Desktop (≥ 768px): ô search width ~360px, căn trái; badge "X / Y sản phẩm" căn ngay sau ô search.
  - Mobile (< 768px): ô search full-width, badge xuống dòng dưới.

### Components
- `Input` (shadcn) với icon `Search` (lucide-react) ở leading, icon `X` ở trailing (chỉ hiện khi có giá trị).
- Placeholder: `Tìm theo SKU, tên sản phẩm, loại hàng…`.
- Badge: dùng `<span className="text-muted-foreground text-sm">` hoặc component `Badge` của shadcn.
- Empty state: dùng 1 hàng `<TableRow>` chiếm `colSpan` toàn bộ cột với text căn giữa + nút "Xoá bộ lọc".

### Platform conventions
- Web (React + Tailwind + shadcn/ui): tuân theo design system hiện hành.
- Keyboard: Esc clear, Tab navigate được — đúng quy ước web a11y.
- Không cần native mobile pattern (project là web app).

---

## 6. Non-Functional Requirements

### Performance
- Debounce input: **300ms**.
- p95 thời gian filter + render ≤ **300ms** với dataset ≤ 5,000 dòng.
- Không gây re-render toàn bộ App tree (filter local trong `InventoryManagement.tsx`).

### Reliability
- Filter logic là pure function, deterministic.
- Không gọi network → không cần retry/timeout/fallback.
- Idempotent: cùng input + cùng dataset luôn ra cùng output.

### Security & privacy
- Không gửi từ khoá search ra server (filter 100% client-side).
- Không log từ khoá search ra console ở production.
- Không thay đổi quyền truy cập sản phẩm — search KHÔNG bypass role-based visibility (admin vs user vẫn thấy cùng tập dữ liệu như hiện hành).

### Compatibility
- Browser: Chrome ≥ 100, Edge ≥ 100, Safari ≥ 15, Firefox ≥ 100 (theo baseline hiện có của project).
- Không cần polyfill mới ngoài những gì project đã có.

### Accessibility (WCAG 2.1 AA)
- Ô search có `<label>` ẩn (sr-only) hoặc `aria-label`.
- Contrast text/placeholder ≥ 4.5:1.
- Keyboard-only: focus rõ ràng, Tab thứ tự hợp lý, Esc clear hoạt động.
- Screen reader đọc được badge "X / Y sản phẩm" hoặc empty state.

### Internationalization
- v1: chỉ tiếng Việt (consistent với project hiện tại).
- Diacritic-insensitive matching được build sẵn — sau này thêm locale khác không phải sửa logic.

### Observability
- Không bắt buộc emit metric trong v1 (project chưa có analytics pipeline).
- Nếu sau này thêm analytics: emit event `inventory_search_used` với property `{ queryLength, resultCount, datasetSize }` — KHÔNG log nội dung từ khoá (PII-conservative).

### Offline / resilience
- Hoàn toàn client-side → search vẫn hoạt động khi offline (miễn data đã load từ trước).

---

## 7. Analytics / Telemetry

> Project hiện chưa có analytics infrastructure → v1 chỉ đặc tả schema, **không bắt buộc implement**.

| Event | Trigger | Properties | Maps to metric |
|---|---|---|---|
| `inventory_search_used` | User gõ từ khoá đầu tiên trong phiên xem màn Quản lý kho | `queryLength` (int), `resultCount` (int), `datasetSize` (int) | Tỉ lệ phiên có dùng search |
| `inventory_search_to_edit` | User mở dialog Edit khi từ khoá search không rỗng | `queryLength`, `resultCount` | Thời gian search → edit |
| `inventory_search_empty_result` | Filter trả về 0 dòng | `queryLength`, `datasetSize` | Tỉ lệ search miss |

**Consent:** Không lưu nội dung từ khoá (chỉ length) → không cần consent bổ sung.

---

## 8. Dependencies

### External
- shadcn/ui `Input`, `Button`, `Table` — đã có sẵn.
- `lucide-react` cho icon `Search`, `X` — đã có sẵn.

### Internal
- Component `InventoryManagement.tsx` — sẽ được sửa.
- Type `Product` trong `src/app/types.ts` — chỉ đọc, không thay đổi.
- Util `removeDiacritics` (nếu chưa có cần tạo mới tại `src/app/utils/`).

### Status
| Dep | Status | Owner |
|---|---|---|
| shadcn `Input` với icon trailing | Ready | — |
| Diacritic-insensitive helper | **Cần tạo mới** | Developer |
| Test data ≥ 1,000 sản phẩm | Cần chuẩn bị | QA |

---

## 9. Rollout

### Strategy
- **Direct release** — feature thuần frontend, không có DB migration, không có server-side change.
- Không cần feature flag (rủi ro thấp, rollback bằng revert PR).

### Target population
- Toàn bộ user (admin + nhân viên).

### Success metrics (xem Section 1)
- Adoption ≥ 60% phiên trong 2 tuần.
- Không có regression trên thao tác Edit/Delete hiện hành.

### Guardrails
- Theo dõi tỉ lệ hoàn tác Edit/Delete trong 1 phút sau thao tác.
- Theo dõi JS error trên màn Quản lý kho (sentry/console nếu có).

### Rollback
- Single PR → revert PR là đủ.
- Vì state search là local, không có dữ liệu persist → rollback không gây mất data.

---

## 10. Open Questions

1. Có cần highlight (bôi vàng) đoạn text khớp trong cell không? → Đề xuất **không** trong v1 để giảm phức tạp; mở thành ticket riêng nếu user feedback yêu cầu.
2. Có cần tìm kèm theo trường số (`tonKho`, `giaVon`) không? → **Không** trong v1; nếu cần sẽ làm filter nâng cao (`> <`) ở v2.
3. Search có cần persist khi reload trang (URL query param hoặc localStorage) không? → **Không** v1; có thể thêm nếu user request.

---

## 11. Handoff

- **Next agent:** Tech Lead → quyết định kiến trúc (helper function, debounce hook, vị trí state).
- **Then:** Developer → implement theo `software-design.md`.
- **Then:** QA → derive test cases từ AC01–AC18.

PRD này là **contract**. Mọi thay đổi scope phải update PRD trước khi code.
