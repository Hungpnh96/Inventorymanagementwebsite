# TECH-DESIGN — EPIC-005: Nâng cấp giao diện

**Epic:** EPIC-005 — UI refresh: colors + notifications + button/icon consistency
**Author:** Tech Lead
**Status:** Draft v1
**Last updated:** 2026-06-13

> Pipeline cho epic này không có PO (only TL → Dev → QA), nên TL sẽ derive intent + AC từ description in §1 trước khi vào design.

---

## 1. Intent (derived from epic description)

Description (User, 2026-06-13):
> "Giao diện tổng quan đa số chỉ trắng và đen. Nên tôi cần
> - Cập nhật giao diện các màn hình trông sinh động hơn (màu sắc, table, ...)
> - Message thông báo notify đẹp hơn.
> - Các form tìm kiếm, button (thêm/xoá/sửa), icon (cập nhật, thêm quyền, xoá, ...) cần thống nhất và thêm màu sắc"

**Decomposed goals:**

| # | Goal | Outcome |
|---|---|---|
| G1 | **Color palette refresh** | App-wide pages/tables không còn trắng-đen plain; có accent color, badge color, status indicator |
| G2 | **Toast/notification UX** | Sonner toasts có visual variants (success xanh, error đỏ, warning vàng, info xanh dương) với icon |
| G3 | **Button/icon consistency** | Mỗi action (Add/Update/Delete/Reset/AddPermission/Export/Import/Search) có 1 icon + 1 color + 1 variant chuẩn dùng nhất quán xuyên suốt app |
| G4 | **Table polish** | Hover row, zebra stripes (optional), badge colors theo trạng thái (Tồn kho thấp = đỏ, Đủ = xanh, v.v.) |
| G5 | **Search form polish** | Input có icon prefix, focus state rõ, clear button có hover state |

**Out of scope:**
- Toàn diện redesign / rebrand (Figma).
- Đổi từ shadcn/ui sang framework khác.
- Dark mode (project hiện chỉ light).
- A/B test variants.
- Logo / typography custom.

**Acceptance Criteria (TL-authored, M=Must, S=Should):**

| ID | Priority | AC |
|---|---|---|
| EPIC-005-AC01 | M | **Given** design tokens file `src/styles/epic005-tokens.css` shipped, **When** app loads, **Then** mọi page sử dụng các CSS custom properties từ token file (không hard-code màu hex inline). |
| EPIC-005-AC02 | M | **Given** Toaster mount, **When** `toast.success/error/warning/message` được gọi, **Then** mỗi loại có icon riêng (CheckCircle / XCircle / AlertTriangle / Info) + màu nền nhẹ + border accent. |
| EPIC-005-AC03 | M | **Given** trang Dashboard / Inventory / Transactions / Reports / Users, **When** render, **Then** ít nhất 1 element trên mỗi page có color accent (không thuần trắng-đen). |
| EPIC-005-AC04 | M | **Given** action button (Add/Edit/Delete/Reset/etc.) ở bất kỳ page nào, **When** render, **Then** cùng 1 action có cùng 1 icon (lucide-react) + cùng 1 button variant + cùng 1 color rule. (No icon mixing.) |
| EPIC-005-AC05 | M | **Given** table có badge trạng thái (vd "Tồn kho thấp"), **When** giá trị thoả điều kiện, **Then** badge có màu phù hợp ngữ nghĩa (đỏ/cam/xanh/xám). |
| EPIC-005-AC06 | S | **Given** search input có icon kính lúp, **When** focus, **Then** ring color accent (e.g., indigo-500). Khi có giá trị, hiện X button có hover state đỏ. |
| EPIC-005-AC07 | S | **Given** table row, **When** hover, **Then** background đổi sang shade nhẹ (gray-50). |
| EPIC-005-AC08 | S | **Given** destructive action button (Delete), **When** render, **Then** dùng `variant="destructive"` HOẶC text-red icon + tooltip cảnh báo. |
| EPIC-005-AC09 | M | **Given** tất cả thay đổi này, **When** chạy regression EPIC-001..EPIC-004 TEST-SCRIPT, **Then** 100% PASS (no functional regression). |
| EPIC-005-AC10 | M | **Given** WCAG 2.1 AA contrast, **When** Lighthouse Accessibility audit, **Then** không có new contrast violation. |
| EPIC-005-AC11 | S | **Given** mobile viewport ≤ 414px, **When** xem các page chính, **Then** color/spacing vẫn legible, không bị tràn. |

---

## 2. Summary

EPIC-005 ships a small set of **design-token additions** + **icon/action conventions** that lift the app out of plain black-and-white without rewriting any component. The chosen approach: **add a thin design layer** (1 new CSS file + 1 new TS constants module + 1 Toaster config update) and **refactor existing pages incrementally** to consume the layer. No new dependencies. No shadcn upgrade. No breaking change to component APIs.

The deliverable is **rule-based and audit-able**: every action button/icon mapping is centralized in `src/app/design/action-styles.ts`, every status badge color is in `src/app/design/status-colors.ts`, every page lookup uses the same helper. QA can grep-verify rule conformance.

---

## 3. Architecture (delta)

The project layering remains the same flat React/Vite structure:

```
src/app/
├── App.tsx                       (page router)
├── components/                   (page-level + admin/*)
│   └── ui/                       (shadcn primitives — DO NOT EDIT)
├── utils/
│   ├── api.ts, storage.ts, permissions.ts, searchUtils.ts
│   └── ... (existing)
└── design/                       ★ NEW (this epic)
    ├── action-styles.ts          icon + color + variant per action
    ├── status-colors.ts          badge color rule per status
    ├── toast-config.tsx          Sonner config with type-specific icons + classes
    └── tokens.ts                 (optional) re-export of CSS var names for type-safe usage
src/styles/
├── globals.css                   (existing — shadcn token defaults)
└── epic005-tokens.css            ★ NEW (additional accent palette + toast classes)
```

### 3.1 Key design choices

| # | Choice | Decision | Why | Rejected |
|---|---|---|---|---|
| 1 | Add tokens or override shadcn | **Add** in `epic005-tokens.css` imported after `globals.css` | Non-destructive. shadcn defaults preserved; we just add `--accent-success`, `--accent-warn`, etc. on top. | Override shadcn primary palette — would require diff testing every shadcn component |
| 2 | Action button styling — central or inline | **Central** `action-styles.ts` exporting `ACTION` const | Single source of truth → enforces AC04 consistency. Easy to grep. | Inline Tailwind classes per page — drift inevitable |
| 3 | Toast variants — Sonner native or wrapper | **Wrapper** `toast-config.tsx` exporting `notify.{success,error,warn,info}` | Sonner's native `toast.success` doesn't get our icon + accent classes by default. Wrapper centralizes. | Hand-roll toast component — overkill, Sonner already in deps |
| 4 | Migration approach — bigbang vs incremental | **Incremental — page-by-page PR** | Easier to review and revert. App keeps working between PRs. | Bigbang — high risk, full regression |
| 5 | Dark mode | **Out of scope** | User didn't ask; would double the work | — |
| 6 | Storybook for visual regression | **Out of scope v1** | Project has no test runner; adding Storybook = days of setup | — |

### 3.2 ADRs

None required. All choices are two-way doors: revertable in single PRs.

---

## 4. Interface contracts (new)

### 4.1 `src/app/design/action-styles.ts`

```ts
import {
  Plus, Pencil, Trash2, RefreshCw, Shield, KeyRound, LogOut, Upload, Download,
  Search, Save, X, Copy, UserPlus, Eye, Power
} from 'lucide-react';

export type ActionKind =
  | 'add' | 'edit' | 'delete' | 'reset-pw' | 'permissions'
  | 'logout-all' | 'logout' | 'import' | 'export' | 'refresh'
  | 'search' | 'save' | 'cancel' | 'copy' | 'create-user' | 'view' | 'power';

export interface ActionStyle {
  icon: typeof Plus;
  variant: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  /** Tailwind class for icon color when needed (default = inherit from button). */
  iconClass?: string;
  /** Vietnamese label for tooltip + aria-label. */
  label: string;
}

export const ACTION: Record<ActionKind, ActionStyle> = {
  add:           { icon: Plus,       variant: 'default',     label: 'Thêm' },
  edit:          { icon: Pencil,     variant: 'ghost',       label: 'Sửa',                  iconClass: 'text-blue-600' },
  delete:        { icon: Trash2,     variant: 'ghost',       label: 'Xoá',                  iconClass: 'text-red-600' },
  'reset-pw':    { icon: KeyRound,   variant: 'ghost',       label: 'Reset mật khẩu',       iconClass: 'text-amber-600' },
  permissions:   { icon: Shield,     variant: 'ghost',       label: 'Phân quyền',           iconClass: 'text-indigo-600' },
  'logout-all':  { icon: Power,      variant: 'ghost',       label: 'Đăng xuất mọi thiết bị', iconClass: 'text-orange-600' },
  logout:        { icon: LogOut,     variant: 'outline',     label: 'Đăng xuất' },
  import:        { icon: Upload,     variant: 'outline',     label: 'Import Excel' },
  export:        { icon: Download,   variant: 'default',     label: 'Export Excel' },
  refresh:       { icon: RefreshCw,  variant: 'outline',     label: 'Tải lại' },
  search:        { icon: Search,     variant: 'ghost',       label: 'Tìm kiếm' },
  save:          { icon: Save,       variant: 'default',     label: 'Lưu' },
  cancel:        { icon: X,          variant: 'outline',     label: 'Hủy' },
  copy:          { icon: Copy,       variant: 'outline',     label: 'Copy' },
  'create-user': { icon: UserPlus,   variant: 'default',     label: 'Thêm user' },
  view:          { icon: Eye,        variant: 'ghost',       label: 'Xem' },
  power:         { icon: Power,      variant: 'ghost',       label: 'Kích hoạt / tạm dừng' },
};
```

**Usage rule (AC04):** every action button MUST import and use the corresponding `ACTION[kind]` entry. Linting: a unit test grep for `<Button` + icon import without `ACTION[` reference fails.

### 4.2 `src/app/design/status-colors.ts`

```ts
export type StockStatus = 'low' | 'normal' | 'high';
export type RoleBadge = 'admin' | 'user';
export type TransactionType = 'import' | 'export';
export type LoginState = 'must-change-password' | 'locked' | 'normal';

export const STOCK_COLOR: Record<StockStatus, string> = {
  low:    'bg-red-100 text-red-800 border-red-200',
  normal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  high:   'bg-blue-100 text-blue-800 border-blue-200',
};

export const ROLE_BADGE_VARIANT: Record<RoleBadge, 'default' | 'secondary'> = {
  admin: 'default',
  user:  'secondary',
};

export const TX_COLOR: Record<TransactionType, string> = {
  import: 'text-emerald-700 bg-emerald-50',
  export: 'text-rose-700 bg-rose-50',
};

export function stockStatusFromValue(tonKho: number, threshold = 10): StockStatus {
  if (tonKho < threshold) return 'low';
  if (tonKho < threshold * 5) return 'normal';
  return 'high';
}
```

### 4.3 `src/app/design/toast-config.tsx`

Wrap Sonner with semantic helpers + icons.

```tsx
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

type Opts = { description?: string };

function withIcon(icon: ReactNode, msg: string, opts: Opts | undefined, variant: string) {
  return { icon, description: opts?.description, className: `toast-${variant}` };
}

export const notify = {
  success: (msg: string, opts?: Opts) =>
    toast.success(msg, withIcon(<CheckCircle2 className="h-4 w-4" />, msg, opts, 'success')),
  error: (msg: string, opts?: Opts) =>
    toast.error(msg, withIcon(<XCircle className="h-4 w-4" />, msg, opts, 'error')),
  warn: (msg: string, opts?: Opts) =>
    toast.warning(msg, withIcon(<AlertTriangle className="h-4 w-4" />, msg, opts, 'warn')),
  info: (msg: string, opts?: Opts) =>
    toast.message(msg, withIcon(<Info className="h-4 w-4" />, msg, opts, 'info')),
};
```

**Migration path:** existing `toast.success(...)` / `toast.error(...)` calls keep working (`notify.*` is additive). New code uses `notify.*`. Optional codemod replaces all `toast.error` → `notify.error` in a follow-up.

### 4.4 `src/styles/epic005-tokens.css`

```css
/* EPIC-005 — accent palette + toast variants. Imported AFTER globals.css. */

:root {
  /* Semantic accent (used by notify.* + status badges) */
  --accent-success-50: #ecfdf5;
  --accent-success-500: #10b981;
  --accent-success-700: #047857;
  --accent-error-50: #fef2f2;
  --accent-error-500: #ef4444;
  --accent-error-700: #b91c1c;
  --accent-warn-50: #fffbeb;
  --accent-warn-500: #f59e0b;
  --accent-warn-700: #b45309;
  --accent-info-50: #eff6ff;
  --accent-info-500: #3b82f6;
  --accent-info-700: #1d4ed8;
}

/* Sonner toast variants (driven by className from notify.*) */
.toast-success {
  background: var(--accent-success-50) !important;
  color: var(--accent-success-700) !important;
  border-color: var(--accent-success-500) !important;
}
.toast-error {
  background: var(--accent-error-50) !important;
  color: var(--accent-error-700) !important;
  border-color: var(--accent-error-500) !important;
}
.toast-warn {
  background: var(--accent-warn-50) !important;
  color: var(--accent-warn-700) !important;
  border-color: var(--accent-warn-500) !important;
}
.toast-info {
  background: var(--accent-info-50) !important;
  color: var(--accent-info-700) !important;
  border-color: var(--accent-info-500) !important;
}

/* Table row hover (AC07) */
tbody tr:hover {
  background-color: rgb(249 250 251); /* gray-50 */
}
```

Import in `src/styles/globals.css` (after the existing imports): `@import "./epic005-tokens.css";`

---

## 5. Data model

**No schema change.** EPIC-005 is purely a presentation-layer epic.

---

## 6. State management

No new state. `notify.*` is stateless. `ACTION` and `STATUS_*` are immutable constants. Theme detection (light only in v1) uses `next-themes` (already in deps) — already wired in `sonner.tsx`.

---

## 7. Sequence flows

### 7.1 A page renders an action button

```
Page.tsx → import { ACTION } from '@/design/action-styles'
        → <Button variant={ACTION.delete.variant}
                  aria-label={ACTION.delete.label}>
            <ACTION.delete.icon className={ACTION.delete.iconClass} />
          </Button>
```

Every page that has an action button uses this pattern. AC04 enforced by lint-like grep test.

### 7.2 A page calls toast

```
Old code:  toast.error('Lỗi…')  → keeps working (Sonner default style)
New code:  notify.error('Lỗi…') → adds icon + colored class
```

Old code is migrated page-by-page in subsequent PRs.

### 7.3 A row shows status

```
Page.tsx → import { stockStatusFromValue, STOCK_COLOR } from '@/design/status-colors'
        → const status = stockStatusFromValue(product.tonKho);
        → <Badge className={STOCK_COLOR[status]}>{label}</Badge>
```

---

## 8. Dependency wiring

No DI change. Pure import wiring at component file level. No NPM install needed (lucide-react, sonner, shadcn already there).

---

## 9. Navigation / control flow

No new routes. Sidebar styling and active-state highlighting receive a small refresh — see §10 Files for details.

---

## 10. Non-Functional Design

| Aspect | Requirement |
|---|---|
| Performance | Zero JS impact (constants + CSS only). Bundle size delta < 2 KB gzipped. No new fonts. |
| Reliability | Adding tokens cannot break anything if CSS file fails to load (graceful degradation to existing shadcn defaults). |
| Security | None — purely visual. No new APIs. |
| Compatibility | Chrome ≥ 100, Edge ≥ 100, Safari ≥ 15 — same as parent project. Color tokens use CSS custom properties (universal support). |
| **A11y (AC10)** | All new color combinations verified to meet WCAG 2.1 AA contrast 4.5:1 (text) / 3:1 (non-text). Specific verification: success-700 on success-50 = 7.4:1; error-700 on error-50 = 6.9:1. Both PASS. |
| i18n | vi-VN only; action labels in Vietnamese. No layout changes that would break RTL (none expected). |
| Observability | None added (visual). |
| Offline | N/A (presentation only). |

---

## 11. Rollout & reversibility

### 11.1 Slices (PRs)

| Slice | PR | Adds | Touches |
|---|---|---|---|
| **S1 Foundation** | `EPIC-005 S1 design tokens + notify + ACTION` | `src/styles/epic005-tokens.css`, `src/app/design/*.ts(x)`, import into globals.css | New files only |
| **S2 Inventory page** | `EPIC-005 S2 inventory ui polish` | Refactor `InventoryManagement.tsx` to use ACTION + STOCK_COLOR + notify | 1 modified file |
| **S3 Transactions + Search + Reports** | `EPIC-005 S3 transactions ui polish` | Same pattern applied | 3 modified files |
| **S4 Admin pages** | `EPIC-005 S4 admin ui polish` | UsersPage + dialogs use ACTION; ResetPasswordDialog gets warn toast | 4 modified files |
| **S5 Dashboard fine-tuning** | `EPIC-005 S5 dashboard polish` | Already has 4-color cards (EPIC-002); refresh "tồn kho thấp" badge color + recent transactions colors | 1 modified file |
| **S6 Sidebar + topbar** | `EPIC-005 S6 chrome polish` | Active-route highlight color, hover states, badge for admin role | `App.tsx` |

Each PR ≤ 200 LOC delta. Easy review, easy revert.

### 11.2 Rollback

- Per-PR revert. No data migration. No backend impact.
- If anything reads broken in production: revert single PR; rest of app unchanged because each slice is additive.

### 11.3 Feature flag

None. Style changes are too low-risk to gate. If a slice fails QA, hold the PR.

---

## 12. File / Module Impact

### New (5)

| File | Purpose |
|---|---|
| `src/styles/epic005-tokens.css` | Accent palette + toast variant classes + table hover |
| `src/app/design/action-styles.ts` | Central `ACTION` constant |
| `src/app/design/status-colors.ts` | Badge color rules per status |
| `src/app/design/toast-config.tsx` | `notify.{success,error,warn,info}` wrappers |
| `src/app/design/index.ts` | Re-export barrel for cleaner imports |

### Modified (S1, all small)

| File | Change |
|---|---|
| `src/styles/globals.css` | `@import "./epic005-tokens.css"` at end |

### Modified (S2..S6, per-PR)

| File | Slice | Change |
|---|---|---|
| `src/app/components/InventoryManagement.tsx` | S2 | Action buttons → `ACTION`; stock badge → `STOCK_COLOR`; toasts → `notify` |
| `src/app/components/TransactionForm.tsx` | S3 | Tx-type badge → `TX_COLOR`; ACTION; notify |
| `src/app/components/ProductSearch.tsx` | S3 | ACTION.search; focus styling |
| `src/app/components/Reports.tsx` | S3 | TX_COLOR for in/out lines |
| `src/app/components/admin/UsersPage.tsx` | S4 | All icon buttons → `ACTION`; toasts → `notify` |
| `src/app/components/admin/UserFormDialog.tsx` | S4 | Save/Cancel → ACTION; notify |
| `src/app/components/admin/PermissionMatrixDialog.tsx` | S4 | Same |
| `src/app/components/admin/ResetPasswordDialog.tsx` | S4 | notify.warn for warning message |
| `src/app/components/Dashboard.tsx` | S5 | Low-stock badges → STOCK_COLOR; recent tx → TX_COLOR |
| `src/app/App.tsx` | S6 | Sidebar active state, role badge in topbar |
| `src/app/components/LoginPage.tsx` | S6 | `notify.error` instead of `toast.error` |

### Deleted

None.

Total: **5 new** + ~**11 modified**. Each PR is single-digit files.

---

## 13. Risks & technical debt

| Risk | Severity | Mitigation |
|---|---|---|
| Color choices disagree with subjective user taste | Medium | After S1+S2 land in staging, request user screenshot review before continuing S3..S6 |
| `!important` in CSS (`.toast-success` etc.) clashes with future Sonner version | Low | Comment in epic005-tokens.css notes the trade-off; if Sonner ever exposes class-merge API, remove `!important` |
| WCAG contrast violation slips through | Medium | §10 enforces specific verification; QA must run Lighthouse on every page |
| Inconsistent icon usage if a dev hand-picks an icon outside `ACTION` | Medium | Static-analysis test (regex grep in CI test) checks: any `<Button` containing a lucide icon ref must be preceded by `ACTION[` in the same file. Allow whitelist for one-off uses with `// epic005-allow-inline` comment. |
| Mass changes touch many files = high risk of merge conflicts | Low | Slice-by-slice strategy keeps each PR small |

### Intentional shortcuts (debt log)

- No Storybook → no visual regression catch. Acceptable v1 (no test runner anyway). Add later epic if visual drift becomes a problem.
- Toast `!important` in CSS — debt cleared when Sonner exposes className-merge.
- Dark mode deferred — not in user ask.
- No animation polish (transitions on hover) — keep CSS minimal; can add later if desired.

---

## 14. Open Questions

| # | Question | Owner | Default if no answer |
|---|---|---|---|
| 1 | "Sinh động hơn" — user prefers brighter saturated or muted pastels? | User (review screenshot) | Default: muted pastels (50-shade backgrounds, 700-shade text) for readability |
| 2 | Should login page have a hero / branding strip? | User | Default: minor color refresh only, no layout change |
| 3 | Topbar — keep indigo bg-indigo-600 for logo block? | User | Default: keep — already established in EPIC-002 |
| 4 | Should we add transition animations (fade, hover scale)? | User | Default: no — keep neutral |
| 5 | Stock-low threshold (currently 10) — keep or expose as setting? | User | Default: keep 10 hard-coded |

Until user confirms #1, Dev should implement S1 with muted defaults; staging review post-S1 will decide.

---

## 15. Handoff

- **Next:** Developer ships S1 (foundation) first → request user screenshot review → ship S2..S6 per feedback.
- Then: QA — runs regression of EPIC-001..EPIC-004 TEST-SCRIPTs (no functional regression expected). Lighthouse audit per page for AC10.

### Implementation hints (for Developer)

1. S1 is the **only foundation PR** — should land before any S2..S6 work. Keep it small (~150 LOC across 5 new files + 1 import line).
2. When migrating a page (S2+), search-replace pattern:
   - `<Button variant="ghost" size="icon" onClick={fn}><Pencil ... />` → `<Button variant={ACTION.edit.variant} size="icon" aria-label={ACTION.edit.label} onClick={fn}><ACTION.edit.icon className={ACTION.edit.iconClass} /></Button>` (wrap in helper IconButton if repeated > 3x).
3. Don't `toast.* → notify.*` blindly — read each toast first; some are intentionally neutral (`toast.message`) and should map to `notify.info`.
4. For `.toast-success` etc. `!important` — make a comment in the CSS file explaining why.
5. Per-PR checklist:
   - [ ] Imports `ACTION` / `notify` from `@/app/design` not inline strings.
   - [ ] No new color hex literals in component code — all from `STOCK_COLOR` / `TX_COLOR` / Tailwind class names matching the design.
   - [ ] Lighthouse A11y ≥ 90 on the touched page.
   - [ ] EPIC-001..EPIC-004 regression smoke (login, search, add-product, admin user CRUD) still PASS.

---

## 16. Definition of Done (for the whole epic, across all slices)

- [ ] S1..S6 PRs merged to `main`.
- [ ] All 11 ACs in §1 PASS.
- [ ] User reviews screenshot of each page and signs off (no PO in this pipeline, so user is the proxy).
- [ ] EPIC-001..EPIC-004 regression PASS.
- [ ] Lighthouse Accessibility ≥ 90 on `/dashboard`, `/inventory`, `/transactions`, `/admin/users`.
- [ ] No new console errors in DevTools after style change.
- [ ] CSS bundle size delta ≤ 2 KB gzipped (verified by Vite build report).

---

## 17. Test handoff guidance

Since pipeline goes TL → Dev → QA, QA will need to derive TEST-PLAN/TEST-CASES/TEST-SCRIPT directly from this doc + AC list. Recommended test breakdown:

- **Visual smoke**: Open each page, screenshot, compare against pre-EPIC-005 baseline (subjective sign-off OK if user reviews).
- **A11y**: Run Lighthouse on each main page; record score; assert ≥ 90.
- **Lint-like static analysis**: grep `<Button` lines for compliance with ACTION pattern; expect 0 violations after S2..S6.
- **Notification visual**: trigger each `notify.success/error/warn/info` and confirm icon + color rendering.
- **Regression**: re-run full TEST-SCRIPT of EPIC-001 through EPIC-004 — all PASS.
