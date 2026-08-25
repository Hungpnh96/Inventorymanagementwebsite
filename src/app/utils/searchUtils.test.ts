// EPIC001 unit tests for quick-search helpers.
// Designed for vitest (vitest, @vitest/expect). The project does NOT currently
// have a test runner installed; see docs/epics/EPIC001/artifacts/IMPLEMENT-SUMMARY.md
// for the gap and how to enable.

import { describe, it, expect } from 'vitest';
import { Product } from '../types';
import {
  normalizeForSearch,
  sanitizeQuery,
  filterProducts,
} from './searchUtils';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  stt: 1,
  loaiHang: 'Đồ uống',
  maSKU: 'SKU-001',
  tenSanPham: 'Cà Phê Robusta',
  donViTinh: 'kg',
  tonKho: 10,
  giaVon: 1000,
  giaTriKho: 10000,
  ...overrides,
});

describe('normalizeForSearch', () => {
  it('lowercases ASCII (EPIC001-UT-NORM-CASE)', () => {
    expect(normalizeForSearch('ABC-001')).toBe('abc-001');
  });
  it('strips Vietnamese diacritics (EPIC001-UT-NORM-DIACRITIC)', () => {
    expect(normalizeForSearch('Cà Phê')).toBe('ca phe');
  });
  it('maps đ/Đ to d (EPIC001-UT-NORM-DSTROKE)', () => {
    expect(normalizeForSearch('Đường')).toBe('duong');
  });
  it('returns empty string for empty input (EPIC001-UT-NORM-EMPTY)', () => {
    expect(normalizeForSearch('')).toBe('');
  });
});

describe('sanitizeQuery', () => {
  it('trims surrounding whitespace (EPIC001-UT-SAN-TRIM)', () => {
    expect(sanitizeQuery('  hello  ')).toBe('hello');
  });
  it('caps length at 200 chars (EPIC001-UT-SAN-MAXLEN)', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeQuery(long).length).toBe(200);
  });
  it('returns empty string for whitespace-only input (EPIC001-UT-SAN-WHITESPACE)', () => {
    expect(sanitizeQuery('   ')).toBe('');
  });
});

describe('filterProducts', () => {
  const dataset: Product[] = [
    makeProduct({ stt: 1, maSKU: 'CF-001', tenSanPham: 'Cà Phê Robusta', loaiHang: 'Đồ uống' }),
    makeProduct({ stt: 2, maSKU: 'TR-002', tenSanPham: 'Trà Xanh',       loaiHang: 'Đồ uống' }),
    makeProduct({ stt: 3, maSKU: 'BN-003', tenSanPham: 'Bánh Mì',        loaiHang: 'Thực phẩm' }),
    makeProduct({ stt: 4, maSKU: 'ABC-004', tenSanPham: 'Đường Trắng',    loaiHang: 'Gia vị' }),
  ];

  it('returns all rows when query is empty (EPIC001-UT-FILTER-EMPTY)', () => {
    expect(filterProducts(dataset, '')).toHaveLength(dataset.length);
  });

  it('returns all rows when query is only whitespace (EPIC001-UT-FILTER-WS)', () => {
    expect(filterProducts(dataset, '   ')).toHaveLength(dataset.length);
  });

  it('matches tenSanPham diacritic-insensitively (EPIC001-AC03)', () => {
    const out = filterProducts(dataset, 'ca phe');
    expect(out.map((p) => p.maSKU)).toEqual(['CF-001']);
  });

  it('matches maSKU case-insensitively (EPIC001-AC04)', () => {
    const out = filterProducts(dataset, 'abc');
    expect(out.map((p) => p.maSKU)).toEqual(['ABC-004']);
  });

  it('matches loaiHang (EPIC001-AC02)', () => {
    const out = filterProducts(dataset, 'gia vi');
    expect(out.map((p) => p.maSKU)).toEqual(['ABC-004']);
  });

  it('returns empty array when nothing matches (EPIC001-AC05)', () => {
    expect(filterProducts(dataset, 'zzz-nothing')).toEqual([]);
  });

  it('treats regex special chars as literal (EPIC001-AC13)', () => {
    expect(() => filterProducts(dataset, '.*([)')).not.toThrow();
    expect(filterProducts(dataset, '.*([)')).toEqual([]);
  });

  it('trims whitespace from the query before matching (EPIC001-AC12)', () => {
    const out = filterProducts(dataset, '  ca phe  ');
    expect(out.map((p) => p.maSKU)).toEqual(['CF-001']);
  });

  it('does not match across field boundaries (EPIC001-UT-FILTER-BOUNDARY)', () => {
    // "001trà" should NOT match (maSKU "CF-001" + tenSanPham "Trà Xanh" are on different rows;
    // within a row they are separated by a space so cross-field concat is impossible).
    const out = filterProducts(dataset, '001tra');
    expect(out).toEqual([]);
  });

  it('performance: filters 5,000 products in under 100ms (EPIC001-AC14)', () => {
    const big: Product[] = Array.from({ length: 5000 }, (_, i) =>
      makeProduct({ stt: i, maSKU: `SKU-${i}`, tenSanPham: `Sản phẩm ${i}`, loaiHang: 'Loại A' }),
    );
    const t0 = Date.now();
    const out = filterProducts(big, 'san pham 1234');
    const elapsed = Date.now() - t0;
    expect(out.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
  });
});
