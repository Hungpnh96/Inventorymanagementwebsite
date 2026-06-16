import { Product } from '../types';

const MAX_QUERY_LENGTH = 200;

/**
 * Remove Vietnamese diacritics and lowercase the string so search is
 * case-insensitive and diacritic-insensitive ("ca phe" matches "Cà Phê").
 */
export function normalizeForSearch(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

/**
 * Sanitize a raw user query: trim whitespace and cap length.
 * Special regex characters are treated as literal substrings (we use
 * String.includes, not RegExp).
 */
export function sanitizeQuery(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  return trimmed.length > MAX_QUERY_LENGTH
    ? trimmed.slice(0, MAX_QUERY_LENGTH)
    : trimmed;
}

/**
 * Filter products by a free-text query against maSKU, tenSanPham and loaiHang.
 * Empty / whitespace-only queries return the original list (no filtering).
 * Fields are joined with a space separator so a query cannot span field boundaries.
 */
export function filterProducts(products: Product[], rawQuery: string): Product[] {
  const query = sanitizeQuery(rawQuery);
  if (!query) return products;
  const needle = normalizeForSearch(query);
  return products.filter((p) => {
    const hay = [
      normalizeForSearch(p.maSKU),
      normalizeForSearch(p.tenSanPham),
      normalizeForSearch(p.loaiHang),
    ].join(' ');
    return hay.includes(needle);
  });
}
