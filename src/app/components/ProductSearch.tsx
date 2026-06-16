import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Product } from '../types';
import { Search, PackageSearch, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface ProductSearchProps {
  products: Product[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function ProductSearch({ products }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    const term = normalize(searchTerm);
    if (!term) return products;
    return products.filter((p) => {
      const name = normalize(p.tenSanPham || '');
      const sku = normalize(p.maSKU || '');
      const loai = normalize(p.loaiHang || '');
      return name.includes(term) || sku.includes(term) || loai.includes(term);
    });
  }, [products, searchTerm]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  const tonKhoCls = (ton: number) =>
    ton < 10
      ? 'inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700'
      : ton < 50
        ? 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700'
        : 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tìm kiếm sản phẩm</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Tìm theo tên, mã SKU hoặc loại hàng — bỏ dấu OK</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tìm kiếm</CardTitle>
          <CardDescription>Gõ một phần tên / SKU / loại hàng để lọc nhanh</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-9"
              maxLength={200}
            />
            {searchTerm.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Xoá từ khoá"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Tìm thấy <strong>{filteredProducts.length}</strong> / {products.length} sản phẩm
            </p>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="rounded-md border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <PackageSearch className="h-6 w-6" />
                  {searchTerm ? 'Không tìm thấy sản phẩm nào' : 'Nhập từ khoá để tìm kiếm'}
                </div>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.maSKU}
                  className="rounded-lg border bg-white p-3 shadow-sm active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-indigo-700">{product.maSKU}</span>
                        {product.loaiHang && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                            {product.loaiHang}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-semibold text-slate-900 break-words">{product.tenSanPham}</h3>
                    </div>
                    <span className={tonKhoCls(product.tonKho)}>
                      {product.tonKho} {product.donViTinh}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-slate-50 px-2 py-1.5">
                      <div className="text-slate-500">Giá vốn</div>
                      <div className="font-medium text-slate-800">{formatCurrency(product.giaVon)}</div>
                    </div>
                    <div className="rounded-md bg-slate-50 px-2 py-1.5">
                      <div className="text-slate-500">Giá trị kho</div>
                      <div className="font-semibold text-slate-900">{formatCurrency(product.giaTriKho)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Mã SKU</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tên sản phẩm</TableHead>
                  <TableHead className="font-semibold text-slate-700">Loại hàng</TableHead>
                  <TableHead className="font-semibold text-slate-700">Đơn vị</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Tồn kho</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Giá vốn</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Giá trị</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <PackageSearch className="h-6 w-6" />
                        {searchTerm ? 'Không tìm thấy sản phẩm nào' : 'Nhập từ khoá để tìm kiếm'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.maSKU} className="hover:bg-indigo-50/40 transition-colors">
                      <TableCell className="font-mono text-xs text-indigo-700">{product.maSKU}</TableCell>
                      <TableCell className="font-medium">{product.tenSanPham}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {product.loaiHang || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600">{product.donViTinh}</TableCell>
                      <TableCell className="text-right">
                        <span className={tonKhoCls(product.tonKho)}>
                          {product.tonKho} {product.donViTinh}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-slate-700">{formatCurrency(product.giaVon)}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatCurrency(product.giaTriKho)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
