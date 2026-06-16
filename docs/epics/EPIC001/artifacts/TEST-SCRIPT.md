# EPIC001 — Test Script (Quản lý kho: Tìm kiếm nhanh)

**Epic:** EPIC001 — Quản lý kho: Tìm kiếm nhanh
**Branch under test:** `feature/EPIC001-quick-search`
**For:** Manual / UAT testers (non-technical)
**Last updated:** 2026-06-13

---

## 1. Prerequisites

| Item | Value |
|---|---|
| Build / URL | Local dev: `npm run dev` → http://localhost:5173 (hoặc URL staging do dev cung cấp) |
| Browser | Chrome ≥ 100 hoặc Edge ≥ 100 (primary). Spot-check trên Safari ≥ 15 và Firefox ≥ 100. |
| OS | macOS 12+ / Windows 10+ |
| Screen | Test cả desktop (≥ 1280px) và mobile (≤ 414px) bằng cách thu hẹp trình duyệt hoặc dùng DevTools device toolbar |
| Locale | vi-VN (default) |
| Network | Online; có 1 case offline ở §4 |
| Test account — admin | `admin / admin123` (hoặc tài khoản admin có sẵn). Vai trò `admin` — thấy nút Edit/Delete. |
| Test account — user | `user / user123` (hoặc tài khoản user thường). Vai trò `user` — KHÔNG thấy Edit/Delete. |
| Test data | File Excel `test-inventory-EPIC001.xlsx` chứa **ít nhất 500 sản phẩm**, bao gồm: <br>• 1 SKU "CF-001", tên "Cà Phê Robusta", loại "Đồ uống"<br>• 1 SKU "TR-002", tên "Trà Xanh", loại "Đồ uống"<br>• 1 SKU "ABC-004", tên "Đường Trắng", loại "Gia vị"<br>• 1 SKU "BN-003", tên "Bánh Mì", loại "Thực phẩm"<br>(Nếu chưa có file, dev cung cấp hoặc tự tạo theo schema cột: STT, Loại hàng, Mã SKU, Tên sản phẩm, Đơn vị, Tồn kho, Giá vốn, Giá trị kho.) |
| Feature flag | Không có. Feature bật mặc định. |

**Steps to set up environment (one time):**
1. Mở trình duyệt → vào URL build ở trên.
2. Đăng nhập bằng tài khoản admin.
3. Trên màn hình chính, click tab **"Quản lý tồn kho"** (hoặc "Quản lý kho").
4. Click nút **Import Excel** → chọn file `test-inventory-EPIC001.xlsx`.
5. Đợi đến khi xuất hiện toast "Đã import N sản phẩm vào file Excel trên server" với N ≥ 500.
6. Xác nhận bảng hiển thị đầy đủ dòng sản phẩm.

> Mọi scenario bên dưới bắt đầu từ trạng thái này (admin đã đăng nhập, đang ở màn "Quản lý tồn kho", đã có ≥ 500 sản phẩm) trừ khi nói rõ khác.

---

## 2. Scenarios (covers acceptance criteria)

### SC-01 — Ô tìm kiếm xuất hiện trên màn hình *(covers EPIC001-AC01, EPIC001-AC15)*

**What we're testing:** Ô search hiển thị đúng vị trí, đúng placeholder, có thể truy cập bằng phím Tab.

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở màn hình "Quản lý tồn kho" | Bảng sản phẩm hiển thị. Phía trên bảng (dưới hàng nút Import/Export/Tải lại) thấy **ô input** có icon kính lúp ở trái. |
| 2 | Nhìn placeholder của ô input | Placeholder ghi đúng: `Tìm theo SKU, tên sản phẩm, loại hàng…` |
| 3 | Click ra ngoài, sau đó nhấn phím **Tab** liên tục từ đầu trang | Đến lượt focus vào ô tìm kiếm, viền focus rõ ràng. Tiếp tục Tab phải đến được các nút và các dòng trong bảng. |
| 4 | Dùng trình đọc màn hình (VoiceOver / NVDA) đọc khi focus ô search | Nghe đọc nhãn "Tìm kiếm sản phẩm" (aria-label). |

**Screenshot:** Chụp toàn màn "Quản lý tồn kho" cho thấy ô search đặt phía trên bảng.

---

### SC-02 — Gõ từ khoá lọc bảng sau 300ms *(covers EPIC001-AC02)*

**What we're testing:** Bảng lọc realtime sau debounce.

| Step | Action | Expected result |
|---|---|---|
| 1 | Click vào ô tìm kiếm | Con trỏ vào ô, không thấy filter chạy. |
| 2 | Gõ chữ `cà` (chậm, từng ký tự) | Trong vòng ~300ms sau ký tự cuối, bảng chỉ còn dòng có SKU/Tên/Loại chứa "cà" (ví dụ: "Cà Phê Robusta"). |
| 3 | Đếm số dòng đang hiện | Ít hơn tổng số sản phẩm ban đầu. |
| 4 | Xoá hết ký tự trong ô search (Ctrl/Cmd + A → Delete) | Sau ~300ms, bảng hiện lại toàn bộ sản phẩm. |

---

### SC-03 — Tìm không phân biệt dấu *(covers EPIC001-AC03)*

**What we're testing:** Gõ không dấu vẫn ra kết quả có dấu.

| Step | Action | Expected result |
|---|---|---|
| 1 | Vào ô search, gõ chính xác `ca phe` (không dấu, có khoảng trắng) | Bảng hiện dòng "Cà Phê Robusta" (SKU CF-001). |
| 2 | Xoá nội dung, gõ `duong` (không dấu) | Bảng hiện dòng "Đường Trắng" (SKU ABC-004). |
| 3 | Xoá nội dung, gõ `tra xanh` | Bảng hiện dòng "Trà Xanh" (SKU TR-002). |

---

### SC-04 — Tìm không phân biệt hoa thường *(covers EPIC001-AC04)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Vào ô search, gõ `ABC` (viết hoa) | Bảng hiện dòng có SKU "ABC-004". |
| 2 | Xoá, gõ `abc` (viết thường) | Bảng hiện đúng dòng đó. |
| 3 | Xoá, gõ `AbC` (lẫn hoa thường) | Bảng vẫn hiện dòng đó. |

---

### SC-05 — Tìm theo Loại hàng *(covers EPIC001-AC02 nhánh loaiHang)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `gia vi` (không dấu) | Bảng hiện các dòng có Loại hàng "Gia vị" (ít nhất 1 dòng: "Đường Trắng"). |
| 2 | Xoá, gõ `do uong` | Bảng hiện các dòng có Loại hàng "Đồ uống" (ít nhất "Cà Phê Robusta" và "Trà Xanh"). |

---

### SC-06 — Empty state khi không tìm thấy *(covers EPIC001-AC05)*

**What we're testing:** Empty state + nút "Xoá bộ lọc".

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `zzz-khong-co-thuc` vào ô search | Sau ~300ms, bảng hiện đúng **1 dòng** chiếm toàn bộ bề rộng với chữ: **"Không tìm thấy sản phẩm khớp với 'zzz-khong-co-thuc'."** |
| 2 | Quan sát ngay dưới câu thông báo | Có nút **"Xoá bộ lọc"**. |
| 3 | Click nút "Xoá bộ lọc" | Ô search rỗng. Bảng hiện lại toàn bộ sản phẩm. |

**Screenshot:** Chụp empty state ở Step 2.

---

### SC-07 — Badge hiển thị số dòng khớp *(covers EPIC001-AC11)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Ô search rỗng | KHÔNG thấy badge "X / Y sản phẩm" ở cạnh ô search. |
| 2 | Gõ `ca phe` | Cạnh ô search xuất hiện chữ dạng: **"1 / 500 sản phẩm"** (số bên trái = số dòng khớp, số bên phải = tổng số). |
| 3 | Xoá hết ký tự | Badge biến mất. |

---

### SC-08 — Mở dialog Edit đúng dòng đã chọn khi đang lọc *(covers EPIC001-AC06)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `ca phe` → bảng còn lại "Cà Phê Robusta" | Đúng 1 dòng. |
| 2 | Click icon cây bút (Pencil) ở dòng đó | Dialog "Chỉnh sửa sản phẩm" mở ra. |
| 3 | Kiểm tra các ô trong dialog | Ô **Mã SKU = CF-001**, ô **Tên sản phẩm = Cà Phê Robusta** — đúng dòng đã click, không bị lệch sang dòng khác. |
| 4 | Đóng dialog (nút Hủy) | Dialog đóng. Bảng vẫn đang lọc "ca phe". |

---

### SC-09 — Search query giữ nguyên sau khi Lưu chỉnh sửa *(covers EPIC001-AC07)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `ca phe` | Bảng lọc còn "Cà Phê Robusta". |
| 2 | Click Pencil ở dòng đó | Dialog mở. |
| 3 | Đổi "Tồn kho" thành `99` | Giá trị thay đổi trong ô. |
| 4 | Click nút **Lưu** | Toast "Đã cập nhật sản phẩm". Dialog đóng. |
| 5 | Quan sát ô search và bảng | Ô search **vẫn còn chữ "ca phe"**. Bảng vẫn lọc, dòng "Cà Phê Robusta" hiển thị giá Tồn kho mới = 99. |

---

### SC-10 — Search query giữ nguyên sau khi nhấn Tải lại *(covers EPIC001-AC08)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `tra xanh` | Bảng lọc còn "Trà Xanh". |
| 2 | Click nút **Tải lại** (icon refresh) | Dữ liệu reload từ server (có thể thấy chớp). |
| 3 | Quan sát sau khi reload | Ô search **vẫn còn "tra xanh"**. Bảng vẫn lọc cùng kết quả. |

---

### SC-11 — Nút X (clear) xoá từ khoá *(covers EPIC001-AC09)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `cà` → bảng đang lọc | Ô search có chữ "cà". |
| 2 | Quan sát ô search | Bên phải ô có icon **X** nhỏ (chỉ xuất hiện khi có giá trị). |
| 3 | Click icon X | Ô search rỗng ngay. Bảng hiện lại toàn bộ sản phẩm. |

---

### SC-12 — Phím Esc xoá từ khoá *(covers EPIC001-AC10)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Click vào ô search và gõ `bánh` | Ô có chữ "bánh", bảng đang lọc. |
| 2 | Vẫn giữ focus ô search, nhấn phím **Esc** | Ô search rỗng. Focus vẫn ở ô search (con trỏ vẫn nhấp nháy trong ô). Bảng hiện lại toàn bộ. |

---

### SC-13 — Trim khoảng trắng đầu/cuối *(covers EPIC001-AC12)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Vào ô search, gõ `   ca phe   ` (có nhiều khoảng trắng đầu và cuối) | Bảng vẫn lọc ra "Cà Phê Robusta" như thể gõ `ca phe`. |
| 2 | Xoá hết, gõ chỉ `   ` (chỉ khoảng trắng) | Bảng hiện toàn bộ sản phẩm (coi như không lọc). Không có badge "X / Y" hiện ra. |

---

### SC-14 — Ký tự đặc biệt xử lý literal, không crash *(covers EPIC001-AC13)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `.*([)` vào ô search | Không có lỗi JavaScript trong console (F12). Bảng hiện empty state vì không sản phẩm nào chứa chuỗi này. |
| 2 | Xoá, gõ `100%` | Không crash. Bảng lọc theo chuỗi literal "100%". |
| 3 | Xoá, gõ `a_b` | Không crash. |

**Screenshot:** Chụp DevTools Console ở Step 1 cho thấy KHÔNG có lỗi đỏ mới.

---

### SC-15 — Hiệu năng với dataset lớn *(covers EPIC001-AC14)*

**Prereq:** Import file Excel ≥ 5,000 sản phẩm (tester yêu cầu dev cung cấp `test-inventory-large.xlsx` nếu chưa có).

| Step | Action | Expected result |
|---|---|---|
| 1 | Sau khi import xong, đảm bảo bảng đang hiển thị ≥ 5,000 dòng | Bảng đầy đủ, header "Danh sách sản phẩm (5000+)" |
| 2 | Click vào ô search và gõ nhanh `san pham 1234` | Bảng cập nhật kết quả trong **dưới 1 giây** kể từ ký tự cuối. Cảm giác mượt, không treo. |
| 3 | Gõ thêm và xoá liên tục 10–20 ký tự | UI vẫn phản hồi mượt, không khựng. |

---

### SC-16 — Search vẫn còn sau khi Import Excel mới *(covers EPIC001-AC16)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `ca phe` → bảng đang lọc | OK. |
| 2 | Click nút **Import Excel** → chọn lại file `test-inventory-EPIC001.xlsx` | Import chạy. Sau khi xong có toast "Đã import…". |
| 3 | Quan sát ô search và bảng sau khi import | Ô search **vẫn còn "ca phe"**. Bảng tự áp dụng filter trên dataset mới, vẫn hiện "Cà Phê Robusta". |

---

### SC-17 — Responsive trên màn hình hẹp *(layout sanity check)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Thu hẹp trình duyệt xuống bề rộng ≤ 414px (hoặc dùng DevTools device toolbar chọn iPhone 14) | Layout giữ được; ô search full-width. |
| 2 | Gõ từ khoá | Badge "X / Y sản phẩm" có thể nằm xuống dòng dưới ô search, vẫn đọc được. |
| 3 | Cuộn ngang bảng để xem các cột | Bảng cuộn ngang được; ô search vẫn cố định phía trên. |

---

## 3. Role-based behavior

### SC-18 — User thường (không admin) vẫn dùng được search *(role coverage)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Đăng xuất, đăng nhập lại bằng tài khoản **user** | Vào màn "Quản lý tồn kho". KHÔNG thấy nút Import, KHÔNG thấy cột "Thao tác" với Edit/Delete. |
| 2 | Tìm ô search trên màn | Vẫn hiển thị bình thường. |
| 3 | Gõ `ca phe` | Bảng vẫn lọc đúng. User KHÔNG bị bypass quyền nào — vẫn không thấy nút Edit. |

---

## 4. Edge-case scenarios

### SC-19 — Bảng rỗng (chưa import) *(edge: empty dataset)*

**Prereq:** Tài khoản admin mới, chưa import dữ liệu.

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở màn "Quản lý tồn kho" khi chưa có sản phẩm | Bảng hiện thông báo "Chưa có sản phẩm nào. Hãy import file Excel để bắt đầu." |
| 2 | Quan sát ô search | Ô search hiển thị nhưng ở trạng thái disabled (không click được hoặc click không hiệu lực). |

---

### SC-20 — Xoá dòng cuối cùng khớp với từ khoá *(edge: filter becomes empty)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ một từ khoá khớp chính xác 1 dòng (vd: `ca phe robusta` → chỉ "CF-001") | Bảng còn 1 dòng. |
| 2 | Click icon thùng rác (Delete) ở dòng đó → xác nhận xoá | Sau khi xoá, bảng hiện **empty state** "Không tìm thấy sản phẩm khớp với 'ca phe robusta'." |
| 3 | Click "Xoá bộ lọc" | Bảng hiện lại toàn bộ. Dòng "Cà Phê Robusta" **không còn** (đã xoá thật). |

---

### SC-21 — Query rất dài *(edge: 500-char input)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Paste vào ô search một chuỗi dài 500 ký tự (vd: `aaaaa…` 500 lần) | Ô search chỉ chứa tối đa 200 ký tự (thuộc tính maxLength). Không crash. |
| 2 | Bảng hiện empty state | Đúng (không sản phẩm nào dài tới mức đó). |

---

### SC-22 — Mất focus và quay lại *(edge: state persistence within session)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `tra xanh` | Bảng lọc. |
| 2 | Click ra ngoài ô search (vào vùng trắng khác) | Focus mất, nhưng nội dung "tra xanh" vẫn còn trong ô và bảng vẫn lọc. |
| 3 | Click lại vào ô search | Con trỏ trở lại, không reset nội dung. |

---

### SC-23 — Chuyển tab rồi quay lại *(edge: cross-route — không persist trong v1)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Gõ `tra xanh` | Bảng lọc. |
| 2 | Click tab khác (vd: "Dashboard" hoặc "Báo cáo") | Chuyển sang trang khác. |
| 3 | Click lại tab "Quản lý tồn kho" | Ô search **rỗng** (theo PRD §AC18 — search KHÔNG persist cross-route trong v1). Bảng hiện toàn bộ. |

---

### SC-24 — Mất mạng giữa chừng *(edge: offline)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Tắt Wi-Fi / ngắt mạng | Vẫn ở màn "Quản lý tồn kho" với data đã load. |
| 2 | Gõ `ca phe` vào ô search | Filter **vẫn hoạt động bình thường** (client-side, không gọi API). |
| 3 | Bật lại mạng, click Tải lại | Data reload OK. |

---

### SC-25 — Console không có lỗi *(regression / quality)*

| Step | Action | Expected result |
|---|---|---|
| 1 | Mở DevTools (F12), tab Console, clear log | Console rỗng. |
| 2 | Lặp nhanh: gõ, xoá, gõ ký tự đặc biệt, click X, nhấn Esc | KHÔNG xuất hiện lỗi đỏ (error). Cảnh báo vàng (warning) chỉ chấp nhận nếu đã có trước feature. |

---

## 5. Regression Quick Check

Sau khi search hoạt động, kiểm tra các flow cũ vẫn chạy được:

| # | Action | Expected |
|---|---|---|
| R1 | Click nút **Import Excel** → chọn file | Toast success, bảng cập nhật. |
| R2 | Click nút **Export Excel** | File `.xlsx` được tải về máy. |
| R3 | Click nút **Tải lại** | Bảng reload data từ server. |
| R4 | Click Edit ở 1 dòng (không có search) → đổi giá vốn → Lưu | Giá vốn cập nhật, Giá trị kho = giá vốn × tồn kho. |
| R5 | Click Delete ở 1 dòng → xác nhận | Dòng biến mất khỏi bảng. |
| R6 | Đăng nhập bằng user thường | Không thấy nút Edit/Delete/Import. |

---

## 6. Verdict & Sign-off

### Pass / Fail criteria
- **PASS**: Tất cả scenario SC-01 → SC-18 và regression R1 → R6 đều cho expected result. Scenario edge-case SC-19 → SC-25 không gây crash; behavior đúng PRD.
- **FAIL**: Bất kỳ scenario nào trong SC-01 → SC-18 không match expected, **hoặc** xuất hiện console error mới, **hoặc** regression R1–R6 hỏng.

### Sign-off

| Field | Value |
|---|---|
| Tester name | __________________________ |
| Date tested | __________________________ |
| Build / commit SHA | __________________________ |
| Browser + version | __________________________ |
| OS | __________________________ |
| Verdict (PASS / FAIL / PASS-WITH-DEFECTS) | __________________________ |
| Tester signature | __________________________ |

### Defect log

| # | Scenario | Severity (Blocker / High / Medium / Low) | Description | Screenshot ref | Ticket |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

---

## Traceability Matrix

| Acceptance Criteria | Scenario(s) |
|---|---|
| EPIC001-AC01 | SC-01 |
| EPIC001-AC02 | SC-02, SC-05 |
| EPIC001-AC03 | SC-03 |
| EPIC001-AC04 | SC-04 |
| EPIC001-AC05 | SC-06, SC-20 |
| EPIC001-AC06 | SC-08 |
| EPIC001-AC07 | SC-09 |
| EPIC001-AC08 | SC-10 |
| EPIC001-AC09 | SC-11 |
| EPIC001-AC10 | SC-12 |
| EPIC001-AC11 | SC-07 |
| EPIC001-AC12 | SC-13 |
| EPIC001-AC13 | SC-14 |
| EPIC001-AC14 | SC-15 |
| EPIC001-AC15 | SC-01 (step 3, 4) |
| EPIC001-AC16 | SC-16 |
| EPIC001-AC17 (W) | Not tested (out of v1 scope) |
| EPIC001-AC18 (W) | SC-23 confirms not implemented |
