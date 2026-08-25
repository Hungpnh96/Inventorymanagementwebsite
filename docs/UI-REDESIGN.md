# WMS UI Redesign — Design Spec

Phiên bản giao diện mới lấy cảm hứng từ **Stripe Dashboard / Linear / Vercel / Shopify Admin**. Không thay đổi backend/API/DB. Áp dụng dần qua các PR.

---

## 1. Phân tích UI hiện tại

| Thành phần | Hiện trạng | Vấn đề |
|---|---|---|
| Sidebar | List button đứng | Không collapse, không có badge, active state mờ |
| Header | Logo + tên user + 2 nút | Thiếu global search, breadcrumb, notification, dark toggle |
| Dashboard | 4 KPI + 2 list | Thiếu trend, thiếu chart, thiếu indicator màu trạng thái |
| Tables | Card-on-mobile (đã có) | Desktop chưa có sticky header, sort, filter rõ |
| Forms | Card đơn giản | Chưa chia section, validation chưa trực quan |
| Dark mode | Token sẵn nhưng không có toggle | Chưa user-controlled |
| Loading | Chỉ text "Đang tải..." | Thiếu skeleton |
| Empty state | Text trơn | Thiếu illustration/cta |

## 2. Sitemap mới

```
Root
├── /login (no shell)
├── /                          → Dashboard
├── /products                  → Sản phẩm (CRUD + image + barcode)*
├── /inventory                 → Tồn kho (hiện tại: InventoryManagement)
├── /transactions/in           → Nhập kho (filter tab nhập)
├── /transactions/out          → Xuất kho (filter tab xuất)
├── /transactions/audit-stock  → Kiểm kê*
├── /suppliers                 → Nhà cung cấp*
├── /customers                 → Khách hàng*
├── /reports                   → Báo cáo (existing)
├── /search                    → Tìm kiếm (existing)
├── /admin/users               → Người dùng
├── /admin/roles               → Vai trò + Permission*
├── /admin/audit-log           → Audit log*
└── /settings                  → Cài đặt*
```
\* = chưa có backend — sẽ stub UI hoặc skip.

## 3. Layout specification

### 3.1 AppShell

```
┌───────────────────────────────────────────────────────────┐
│ Header (h-14, sticky, border-b)                          │
│ ┌──┐  Breadcrumb       [SearchBar]   [🔔][🌗][Avatar▾] │
└─┤☰ ├───────────────────────────────────────────────────┘
  ├──┤
  │ Sidebar w=64 (collapse→16)
  │ ─────────
  │ 📊 Dashboard         ← bold + bg-accent when active
  │ 📦 Sản phẩm
  │ 🏪 Tồn kho
  │ ⬇  Nhập kho     [3] ← badge
  │ ⬆  Xuất kho
  │ ⚖  Kiểm kê
  │ ─── DỮ LIỆU
  │ 🏭 Nhà cung cấp
  │ 👤 Khách hàng
  │ ─── QUẢN TRỊ
  │ 👥 Nhân sự
  │ 🛡 Phân quyền
  │ 📋 Audit log
  │ ─────────
  │ 📊 Báo cáo
  │ ⚙  Cài đặt
  ├──┤
  │                Main content (max-w-7xl, p-6 lg:p-8)
  │
```

Breakpoints:
- `<md` (<768): sidebar = off-canvas drawer, header có hamburger; KHÔNG bottom-nav nữa (đã chuyển thành Drawer per yêu cầu mới)
- `md..lg` (768-1024): sidebar = drawer, click overlay closes
- `lg+` (≥1024): sidebar = sticky, có thể collapse

### 3.2 Sidebar nav item

```
[Icon 20px]  Label              [Badge optional]
^padding x-3 y-2  ^font-medium  ^right-aligned
```

- Active: `bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300` + 3px left border indigo-600
- Hover: `bg-slate-100 dark:bg-slate-800`
- Collapsed: chỉ icon, label hiện qua tooltip

### 3.3 Header

```
[Hamburger (lg:hidden)]  [Logo + brand]  ──────  [GlobalSearch ⌘K]  [🔔 dot]  [🌗]  [Avatar ▾ dropdown]
```

GlobalSearch: input width 320px, ⌘K shortcut hint, mở CommandDialog overlay khi focus.

Avatar dropdown: username + role badge, link "Đổi mật khẩu", "Cài đặt", separator, "Đăng xuất".

## 4. Design system

### 4.1 Color tokens (OKLCH-based, dark mode aware)

Đã có sẵn ở `src/styles/theme.css`. Bổ sung:

```css
--brand-50..900: indigo scale  (primary)
--accent-success: emerald-500
--accent-warn:    amber-500
--accent-danger:  rose-500
--accent-info:    sky-500
--surface:        background card
--surface-2:      raised card  (bg-slate-50 in light, slate-900/40 in dark)
```

### 4.2 Typography (Inter)

- Display: `text-3xl font-bold tracking-tight`
- Page title: `text-2xl font-bold tracking-tight`
- Section title: `text-lg font-semibold`
- Body: `text-sm text-foreground`
- Caption: `text-xs text-muted-foreground`
- Code/SKU: `font-mono text-xs text-indigo-600 dark:text-indigo-400`

### 4.3 Spacing

8-point grid. Tailwind: `1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px`.
Card padding: `p-4 sm:p-6`. Section gap: `space-y-6`. Inline gap: `gap-2 sm:gap-3`.

### 4.4 Radius / shadow

- Card: `rounded-xl border` + `shadow-sm hover:shadow-md transition`
- Button: `rounded-md`
- Pill/badge: `rounded-full`

### 4.5 Color status convention

| Trạng thái | Light | Dark |
|---|---|---|
| Success / nhập kho | emerald-100 bg + emerald-700 text | emerald-500/15 bg + emerald-300 text |
| Warning / sắp hết | amber-100 + amber-700 | amber-500/15 + amber-300 |
| Danger / hết hàng | rose-100 + rose-700 | rose-500/15 + rose-300 |
| Info / xuất kho | orange-100 + orange-700 | orange-500/15 + orange-300 |
| Neutral / pending | slate-100 + slate-700 | slate-700 + slate-300 |
| Brand / admin | indigo-100 + indigo-700 | indigo-500/15 + indigo-300 |

## 5. Component library (Tailwind UI patterns)

| Component | shadcn base | Customization |
|---|---|---|
| AppShell | layout | new |
| Sidebar | — | new (Headless UI Dialog for mobile drawer) |
| Header | — | new |
| Breadcrumb | breadcrumb.tsx | wrap |
| GlobalSearch | command.tsx + dialog.tsx | wrap (Cmd+K shortcut) |
| NotificationCenter | dropdown-menu.tsx | new content |
| ThemeToggle | — | new (Headless Switch + localStorage) |
| UserMenu | dropdown-menu.tsx | wrap |
| KpiCard | card.tsx | new variant w/ trend |
| DataTable | table.tsx | wrap w/ sticky head + sort + filter slot |
| EmptyState | — | new |
| LoadingSkeleton | skeleton.tsx | preset variants |
| FormSection | — | new |
| Toaster (richColors) | sonner.tsx | already done |

## 6. Dark mode strategy

- **Default**: theo `prefers-color-scheme: dark`
- **Toggle**: trong header, 3 trạng thái: Light / Dark / System
- **Persist**: localStorage `theme` = `light`|`dark`|`system`
- Apply class `.dark` lên `<html>` để tokens active
- **Test**: mọi card/badge/chart phải có contrast AA ở cả 2 mode

## 7. Tablet strategy

- 640–1023px: sidebar = drawer (mở qua hamburger)
- Data table: **giữ nguyên table**, hỗ trợ scroll ngang với sticky cột đầu (SKU)
- KPI grid: 3 cột thay vì 4
- Form: 2 cột grid
- Action buttons: full size, không thu nhỏ

## 8. Mobile strategy

- <640px: sidebar = full-screen drawer (`Dialog` overlay)
- Table → card (đã làm)
- Bottom-nav 5 tab chính (đã có)
- **FAB** (floating action button) cho action thường dùng:
  - Trang Inventory: FAB "+" → Add product (nếu admin) or Xuất nhập kho
  - Trang Transaction: FAB "✓" sticky bottom thay vì submit chìm
- Form: 1 cột, input `h-11` (tap target ≥44px)
- Modal: full-screen sheet trên mobile

## 9. Responsive checklist

```
[ ] Header collapses to icons on <sm
[ ] Sidebar collapsible on lg (toggleable rail mode)
[ ] Sidebar = Drawer on <lg
[ ] All tables have card fallback on <md
[ ] KPI grid: 2col mobile / 3col tablet / 4col desktop
[ ] Modals full-screen on <sm
[ ] FAB only on <md
[ ] Search expands to fullscreen on <sm focus
[ ] Forms 1col mobile / 2col md+
[ ] Touch targets ≥44px on touch devices
```

## 10. UI improvement checklist (priority order)

| # | Item | Impact | Done? |
|---|---|---|---|
| 1 | Inter font + base typography | High | ✓ (font ready, apply) |
| 2 | Theme provider + dark toggle | High | ⏳ |
| 3 | AppShell w/ new sidebar + header | High | ⏳ |
| 4 | Breadcrumb in header | Medium | ⏳ |
| 5 | Global Cmd+K search | Medium | ⏳ |
| 6 | Notification Center dropdown | Low | ⏳ |
| 7 | User profile menu | Medium | ⏳ |
| 8 | Dashboard KPI cards w/ trend | High | ⏳ |
| 9 | Dashboard analytics (recharts) | Medium | Use existing recharts |
| 10 | DataTable wrapper w/ sticky+sort | Medium | ⏳ |
| 11 | Loading skeletons | Low | ⏳ |
| 12 | Empty states w/ illustration | Low | ⏳ |
| 13 | Form sections | Medium | ⏳ |
| 14 | Confirmation modals (already alert-dialog) | Low | ✓ |
| 15 | Toast richColors | Done | ✓ |
| 16 | FAB on mobile | Low | ⏳ |

---

Version: 1.0 — đề xuất triển khai từng phần. Phần này (theme provider + AppShell + Dashboard polish) là Phase 1, các phần còn lại theo PR tiếp theo.
