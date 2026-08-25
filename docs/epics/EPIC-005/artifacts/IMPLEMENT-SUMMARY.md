# EPIC-005 — Implement Summary (S1 + Dashboard polish)

**Epic:** EPIC-005 — Nâng cấp giao diện
**Branch:** `feature/EPIC-005-ui-foundation` (from `main`)
**PR:** Not opened on this host — see Environment gaps.
**Status:** **S1 Foundation DONE + Dashboard demo polish DONE. S2–S6 (per-page migrations) deferred to subsequent PRs so user can sign off on the look-and-feel before fanning out.**

This implements TECH-DESIGN §11 Slice 1 plus a small demo on Dashboard so the user can review the visual result before continuing.

---

## 1. Files touched

### S1 Foundation — new (5)

| File | Purpose |
|---|---|
| `src/styles/epic005-tokens.css` | Accent palette CSS vars (`--accent-success-*` etc.) + Sonner toast variant classes (`.toast-success/error/warn/info` with `!important` because Sonner uses inline CSS vars) + optional `epic005-row` hover. |
| `src/app/design/action-styles.ts` | `ACTION: Record<ActionKind, ActionStyle>` — single source of truth for 17 action kinds. Each entry has `icon` (lucide), `variant` (button), optional `iconClass` (color), `label` (Vietnamese, used for `aria-label` + tooltip). |
| `src/app/design/status-colors.ts` | `STOCK_COLOR`, `TX_COLOR`, `ROLE_BADGE_VARIANT`, `STOCK_LABEL` constants. `stockStatusFromValue()` helper. `STOCK_LOW_THRESHOLD` = 10. |
| `src/app/design/toast-config.tsx` | `notify.{success,error,warn,info}` wrappers around Sonner. Each adds an icon + `className="toast-<variant>"` so the CSS file styles them. |
| `src/app/design/index.ts` | Barrel re-exports for `import { ACTION, STOCK_COLOR, notify } from '../design'`. |

### S1 Foundation — modified (1)

| File | Change |
|---|---|
| `src/styles/index.css` | Add `@import './epic005-tokens.css'` after the existing 3 imports — must be LAST so it can override Sonner inline styles. |

### Dashboard demo polish — modified (2)

| File | Change |
|---|---|
| `src/app/components/Dashboard.tsx` | Imports `STOCK_COLOR, STOCK_LABEL, TX_COLOR, stockStatusFromValue, STOCK_LOW_THRESHOLD`. Low-stock list now shows `STOCK_COLOR.low` pill (red bg) with `STOCK_LABEL[status]` tooltip instead of plain red text. Recent transactions list shows `TX_COLOR.import/export` pill (emerald / rose) instead of plain green/red text. Uses constant `STOCK_LOW_THRESHOLD` instead of hard-coded `10`. |
| `src/app/App.tsx` | Imports `notify`. Migrated 2 toast call sites: `toast.error('Không tải được dữ liệu...')` → `notify.error`, `toast.message('Cần đổi mật khẩu...')` → `notify.warn` (more semantic — orange chip instead of grey). |

**Cumulative:** 5 new + 3 modified files. All additive.

---

## 2. Acceptance Criteria fulfilled

| AC | Status | Where |
|---|---|---|
| **EPIC-005-AC01** Design tokens file shipped | DONE | `src/styles/epic005-tokens.css` |
| **EPIC-005-AC02** Toast variants with icons + colored bg/border | DONE | `toast-config.tsx` + CSS variants; demo by `notify.warn('Cần đổi mật khẩu')` on first-login |
| **EPIC-005-AC03** Dashboard has color accent | DONE (Dashboard) | EPIC-002 already added 4-color KPI cards; this round adds colored stock + transaction pills |
| **EPIC-005-AC04** Action button consistency | DONE foundation (ACTION const); per-page migration in S2..S6 |
| **EPIC-005-AC05** Status badge color rule | DONE (Dashboard low-stock + tx pills) |
| **EPIC-005-AC07** Table row hover | DONE foundation (CSS rule); per-page opt-in via `epic005-row` className in S2..S6 |
| **EPIC-005-AC08** Destructive variant for delete | DONE in ACTION.delete (`variant: 'ghost'` + `iconClass: 'text-red-600'`). EPIC-004 already uses destructive variant in `AlertDialogAction` for Delete confirms. |
| AC06 (search focus ring), AC09 (regression), AC10 (Lighthouse), AC11 (mobile legibility) | PENDING — verify after S2..S6 per-page migrations |

---

## 3. Open question status (TECH-DESIGN §14)

| # | Question | Decision in this PR |
|---|---|---|
| 1 | Bright vs muted palette | **Muted pastels chosen** — `*-50` background, `*-700` text (e.g. emerald-50/emerald-700 for success). Easy to scan, WCAG-AA compliant by construction. Awaiting user screenshot review. |
| 2 | Login page hero | Deferred to S6 |
| 3 | Topbar indigo keep | Kept |
| 4 | Hover animations | None added (per default) |
| 5 | Stock threshold | Kept = 10, now via `STOCK_LOW_THRESHOLD` constant |

---

## 4. Unit tests added (EPIC-005-UT*)

Same toolchain constraint as prior epics — no test runner. Catalog for next dev:

| Test ID | What | Scenario |
|---|---|---|
| EPIC-005-UT-ACTION-KEYS-001 | `ACTION` keys | `Object.keys(ACTION)` length = 17; matches `ActionKind` union exhaustively |
| EPIC-005-UT-ACTION-LABEL-NONEMPTY-001 | `ACTION` | Every entry has non-empty `label` (a11y enforcement) |
| EPIC-005-UT-STATUS-LOW-001 | `stockStatusFromValue` | `(5)` → `'low'`; `(10)` → `'normal'` (threshold boundary); `(99)` → `'high'` |
| EPIC-005-UT-NOTIFY-CLASS-001 | `notify.success` | (RTL + Sonner spy) sets className `toast-success`; renders `CheckCircle2` icon |
| EPIC-005-UT-NOTIFY-WARN-CLASS-001 | `notify.warn` | className `toast-warn`; `AlertTriangle` icon |
| EPIC-005-UT-CSS-IMPORT-ORDER-001 | static analysis | `src/styles/index.css` imports `epic005-tokens.css` LAST (so its `!important` rules win) |
| EPIC-005-UT-DASHBOARD-LOWSTOCK-COLOR-001 | RTL | Render Dashboard with a product `tonKho=5`; pill has class `bg-red-100` |
| EPIC-005-UT-DASHBOARD-TX-COLOR-001 | RTL | Recent transactions row of type=import has class `bg-emerald-50`; type=export `bg-rose-50` |

---

## 5. Coverage

**Command:** N/A — no FE test runner configured in project (`package.json` only has `dev` and `build` scripts).
**Coverage:** N/A.

To enable: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8`; add `vitest.config.ts`; add npm scripts.

---

## 6. Bundle impact (EPIC-005 DoD §16)

**Estimated bundle delta:**
- CSS `epic005-tokens.css` minified ≈ 1.0 KB; gzipped ≈ 400 B.
- TS modules import only lucide icons that were already imported elsewhere (`Plus, Pencil, Trash2, ...`) — Vite tree-shakes, so effectively 0 KB JS delta.
- `Eye, Save, Power` are new lucide imports — adds ~300 B gzipped to the icon chunk.

**Total estimated: < 1 KB gzipped** — well under the 2 KB budget.

(Verified on reviewer's host: `npm run build`; inspect `dist/assets/*.css` size before/after.)

---

## 7. Verification (for reviewer)

1. `cd src/app && npm install && npm run dev` — Vite dev server starts; no TypeScript error.
2. Open browser at http://localhost:5173 (or the project's URL).
3. **Dashboard visual check:**
   - 4 KPI cards (indigo/emerald/amber/purple) — unchanged from EPIC-002 polish.
   - "Sản phẩm tồn kho thấp" section: items now show a **red pill** (bg-red-100) with the stock value, instead of plain red text. Tooltip on hover says "Tồn kho thấp".
   - "Giao dịch gần đây" section: items now show **emerald pill** for "Nhập", **rose pill** for "Xuất", instead of plain text.
4. **Toast visual check:**
   - Login with a force-change-pw user → `notify.warn` fires → toast has **amber/yellow background + AlertTriangle icon**.
   - Stop Postgres mid-session → next API call fails → `notify.error` fires → toast has **red bg + XCircle icon**.
5. **No regression check** — run EPIC-001..EPIC-004 TEST-SCRIPT highlights (R1..R10 of EPIC-004 §4):
   - Login, dashboard, sidebar fixed, import xlsx, EPIC-001 search, transactions, logout → all OK.
6. **Bundle size:** `npm run build`; check `dist/assets/index-*.css` is at most ~1 KB larger than the prior build.

---

## 8. Intentionally deferred (next PRs per TECH-DESIGN §11)

| Slice | Scope |
|---|---|
| **S2** Inventory page polish | `InventoryManagement.tsx` — action buttons via `ACTION`; row hover via `epic005-row`; toast → `notify`; status badge if applicable |
| **S3** Transactions + Search + Reports polish | 3 components; TX_COLOR pills in Reports |
| **S4** Admin pages polish | 5 admin files (UsersPage + 4 dialogs); destructive variant for Logout-all + Delete; warn toast for Reset PW |
| **S5** Dashboard fine-tune | Already largely done this round; revisit after user review |
| **S6** Sidebar + topbar | App.tsx active-route highlight color, hover states |

User screenshot review gated between S1+demo (this PR) and S2..S6.

---

## 9. Risks notes

- **`!important` in CSS for toast variants** — required because Sonner sets inline CSS vars (`--normal-bg` etc.) that win against ordinary class rules. Documented in `epic005-tokens.css` with reasoning + future-removal trigger (Sonner exposing className-merge).
- **Tooltip on pills**: Dashboard pills use plain `title` attribute (HTML tooltip), not the shadcn `Tooltip` component, to keep this PR minimal. Acceptable v1 — keyboard-focused users still see the tooltip on focus. Upgrade in a future epic if desired.
- **No CI grep test yet for AC04 enforcement** — the static-analysis rule that every `<Button>` with a lucide icon must reference `ACTION[` is documented in TECH-DESIGN §13 but the actual test isn't added in this branch. Add in S6 with the rest of the migration. For now, S2..S6 PRs are small enough for human review to catch deviations.

---

## 10. Commit + PR

```bash
git add -A
git status   # verify only the 8 files listed above
git commit -m "EPIC-005 S1 design tokens + Dashboard pills"
git push -u origin feature/EPIC-005-ui-foundation
gh pr create --title "EPIC-005 S1: design tokens + notify + Dashboard polish demo" \
  --body "Implements TECH-DESIGN §11 Slice 1 + a Dashboard demo so user can sign off on color choices before fanning out to S2..S6. See docs/epics/EPIC-005/artifacts/IMPLEMENT-SUMMARY.md."
```

**Ask user**: take a screenshot of `/dashboard` after this lands and tell us whether the color choices feel right before S2..S6 land.
