// EPIC-005 — Semantic color rules per status. Use these instead of inline color hex.

export type StockStatus = 'low' | 'normal' | 'high';
export type TransactionType = 'import' | 'export';
export type RoleBadge = 'admin' | 'user';

/** Tailwind classes for stock-level badges. */
export const STOCK_COLOR: Record<StockStatus, string> = {
  low:    'bg-red-100 text-red-800 border border-red-200',
  normal: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  high:   'bg-blue-100 text-blue-800 border border-blue-200',
};

/** Tailwind classes for transaction-type chips (Nhập = xanh, Xuất = đỏ). */
export const TX_COLOR: Record<TransactionType, string> = {
  import: 'text-emerald-700 bg-emerald-50',
  export: 'text-rose-700 bg-rose-50',
};

/** shadcn Badge variant per user role. */
export const ROLE_BADGE_VARIANT: Record<RoleBadge, 'default' | 'secondary'> = {
  admin: 'default',
  user:  'secondary',
};

/** Default stock-low threshold (in product unit). Single source of truth. */
export const STOCK_LOW_THRESHOLD = 10;

/** Categorize a stock value into a semantic status. */
export function stockStatusFromValue(tonKho: number, threshold = STOCK_LOW_THRESHOLD): StockStatus {
  if (tonKho < threshold) return 'low';
  if (tonKho < threshold * 5) return 'normal';
  return 'high';
}

/** Vietnamese label for a stock status (for tooltip / aria). */
export const STOCK_LABEL: Record<StockStatus, string> = {
  low:    'Tồn kho thấp',
  normal: 'Tồn kho bình thường',
  high:   'Tồn kho cao',
};
