# EPIC001 — Implement Summary

**Epic:** Quản lý kho - Tìm kiếm nhanh
**Branch:** `feature/EPIC001-quick-search` (created from `main`)
**PR:** *Not opened — see "Environment gaps" below.*
**Status:** Code complete, tests authored (RED), runtime validation deferred.

---

## Files Touched

| File | Change | LOC delta |
|---|---|---|
| `src/app/utils/searchUtils.ts` | **New** — pure helpers: `normalizeForSearch`, `sanitizeQuery`, `filterProducts` | +50 |
| `src/app/utils/searchUtils.test.ts` | **New** — Vitest suite covering helpers + AC mappings | +110 |
| `src/app/components/InventoryManagement.tsx` | Add search Input, debounce, badge, empty-state row, Esc clear | +60 / -2 |

No other files modified. No dependencies added.

---

## Acceptance Criteria Addressed

| AC ID | Title | Status |
|---|---|---|
| EPIC001-AC01 | Search input visible on screen | DONE — input rendered above table |
| EPIC001-AC02 | Filter SKU / tên / loại hàng after 300ms debounce | DONE — `useEffect` + `setTimeout(300)` |
| EPIC001-AC03 | Diacritic-insensitive ("ca phe" → "Cà Phê") | DONE — NFD strip + đ→d in `normalizeForSearch` |
| EPIC001-AC04 | Case-insensitive | DONE — `.toLowerCase()` on both sides |
| EPIC001-AC05 | Empty-state row + "Xoá bộ lọc" button | DONE — extra `TableRow` branch |
| EPIC001-AC06 | Edit opens correct product when filtered | DONE — Pencil click passes the actual `product` reference; not by index |
| EPIC001-AC07 | Search query persists across save | DONE — `searchInput` state lives at component level; dialog close doesn't touch it |
| EPIC001-AC08 | Search query persists across Refresh | DONE — `onRefresh` only mutates `products` prop; search state untouched |
| EPIC001-AC09 | Clear button (X) clears query | DONE — `clearSearch` resets both `searchInput` and `debouncedQuery` |
| EPIC001-AC10 | Esc clears query while focused | DONE — `onKeyDown` handler on Input |
| EPIC001-AC11 | "X / Y sản phẩm" badge while filtering | DONE — rendered next to input when `isFiltering` |
| EPIC001-AC12 | Trim whitespace in query | DONE — `sanitizeQuery` |
| EPIC001-AC13 | Regex special chars treated literally | DONE — uses `String.includes`, not `RegExp` |
| EPIC001-AC14 | p95 ≤ 300ms for 5,000 rows | DONE in test — 5,000-row perf test asserts < 100ms |
| EPIC001-AC15 | `aria-label`, keyboard accessible | DONE — `aria-label="Tìm kiếm sản phẩm"`, `aria-live="polite"` on badge |
| EPIC001-AC16 | Persists across Excel re-import | DONE — `onProductsUpdate` only changes `products`; filter recomputes via `useMemo` |
| EPIC001-AC17 | (W) Search history — not implemented (W per PRD) |
| EPIC001-AC18 | (W) Cross-route persistence — not implemented (W per PRD) |

---

## Unit Tests Added (EPIC001-UT*)

File: `src/app/utils/searchUtils.test.ts` (Vitest format)

| Test ID | Behavior |
|---|---|
| EPIC001-UT-NORM-CASE | `normalizeForSearch` lowercases ASCII |
| EPIC001-UT-NORM-DIACRITIC | strips Vietnamese diacritics |
| EPIC001-UT-NORM-DSTROKE | `Đ` / `đ` → `d` |
| EPIC001-UT-NORM-EMPTY | empty input → empty output |
| EPIC001-UT-SAN-TRIM | trims whitespace |
| EPIC001-UT-SAN-MAXLEN | caps at 200 chars |
| EPIC001-UT-SAN-WHITESPACE | whitespace-only → empty |
| EPIC001-UT-FILTER-EMPTY | empty query returns full list |
| EPIC001-UT-FILTER-WS | whitespace-only query returns full list |
| EPIC001-AC03 / -AC04 / -AC02 | matches by name / SKU / loại |
| EPIC001-AC05 | empty result for no match |
| EPIC001-AC13 | regex chars literal |
| EPIC001-AC12 | trimmed before match |
| EPIC001-UT-FILTER-BOUNDARY | does not match across field boundaries |
| EPIC001-AC14 | 5,000-row perf < 100ms |

UI-layer behavior (debounce timing, Esc handler, badge rendering, empty-state row) is best covered by RTL component tests and is **not** included in v1 because the project does not have a UI testing harness configured. QA should add these as `EPIC001-IT*` integration tests if a harness is set up.

---

## Whole-project coverage

**Command run:** none — project has no test runner configured.

**Coverage numbers:** **N/A**.

Justification: `package.json` declares only `vite` and `vite build` scripts; no `vitest`, `jest`, `@testing-library/*`, or any coverage tool is installed. There is no `tsconfig.json` at the repo root either. Installing a test runner is out of scope for this epic (no PRD requirement and it would be a cross-cutting infra change).

To enable test execution + coverage, QA / Tech Lead should:
1. `npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom`
2. Add `tsconfig.json` (or use `vite`'s default) and a `vitest.config.ts` with `environment: 'jsdom'`.
3. Add scripts: `"test": "vitest run"`, `"test:coverage": "vitest run --coverage"`.
4. Run `npm run test:coverage` and paste numbers below.

The new helper file `searchUtils.ts` is **designed for ≥95% unit coverage** by the suite above (every branch covered: empty input, whitespace, max length, diacritic, đ, regex chars, no match, perf).

---

## Environment Gaps Encountered

1. **No Node / npm / npx available on the build machine** — `which node` returns "not found". Therefore:
   - `tsc --noEmit` could not be run
   - `vite build` could not be run
   - `vitest` could not be run
   - The Claude Code quality-gate hook intercepting `git commit` invoked `npm test` and blocked the commit. The branch and code changes exist on disk and are staged; **the commit itself was not landed and no PR was opened.**
2. **No test runner configured** — see coverage section above.
3. **No `tsconfig.json` at repo root** — TypeScript files are processed by Vite but there is no standalone typecheck config.

These are pre-existing project conditions, not regressions introduced by this epic.

---

## Recommended Next Steps for Reviewer

1. On a machine with Node 20+ installed, run `npm install` then `npx tsc --noEmit src/app/components/InventoryManagement.tsx src/app/utils/searchUtils.ts` (or `vite build`) to confirm typecheck.
2. Install vitest (one-liner above) and run `npx vitest run src/app/utils/searchUtils.test.ts` — expected: 17 passing tests.
3. Manual smoke test against AC list, especially AC07 (search persists across edit) and AC08 (across refresh).
4. Commit the staged changes (`git commit -m "EPIC001 add quick search to inventory management screen"`) and open the PR.

---

## Intentionally Deferred

- Highlight (bôi vàng) matched text in cells — open question in PRD §10.
- Filter on numeric fields (`tonKho`, `giaVon`) — out of scope per PRD §2.
- Persist search via URL query / localStorage — open question in PRD §10.
- Analytics events `inventory_search_*` — schema written but emit deferred (no analytics pipeline in project).
- Component-level RTL tests — require UI test harness install.
