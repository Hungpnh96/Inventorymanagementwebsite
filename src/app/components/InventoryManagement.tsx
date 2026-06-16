import { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Product, User } from '../types';
import { exportToExcel } from '../utils/excelUtils';
import { importInventoryXlsx, replaceProducts, deleteProduct, updateProduct } from '../utils/api';
import { filterProducts, sanitizeQuery } from '../utils/searchUtils';
import { Upload, Download, Pencil, Trash2, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface InventoryManagementProps {
  products: Product[];
  onProductsUpdate: (products: Product[]) => void;
  onRefresh: () => void;
  currentUser: User;
}

export function InventoryManagement({
  products,
  onProductsUpdate,
  onRefresh,
  currentUser,
}: InventoryManagementProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchInput), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const filteredProducts = useMemo(
    () => filterProducts(products, debouncedQuery),
    [products, debouncedQuery],
  );
  const activeQuery = sanitizeQuery(debouncedQuery);
  const isFiltering = activeQuery.length > 0;

  const clearSearch = () => {
    setSearchInput('');
    setDebouncedQuery('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const data = await importInventoryXlsx(currentUser, file);
      onProductsUpdate(data.products);
      toast.success(`Đã import ${data.products.length} sản phẩm vào file Excel trên server`);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi import file Excel');
      console.error(error);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const persist = async (next: Product[]) => {
    setBusy(true);
    try {
      const data = await replaceProducts(currentUser, next);
      onProductsUpdate(data.products);
    } catch (e: any) {
      toast.error(e.message || 'Không lưu được vào file Excel');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    exportToExcel(products);
    toast.success('Đã xuất file Excel thành công');
  };

  const handleEdit = (product: Product) => {
    setEditingProduct({ ...product });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setBusy(true);
    try {
      const original = products.find((p) => p.maSKU === editingProduct.maSKU);
      const { adjustment } = await updateProduct(currentUser, editingProduct.maSKU, editingProduct);
      onRefresh();
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      if (adjustment) {
        const sign = adjustment.type === 'import' ? '+' : '-';
        toast.success(
          `Đã cập nhật. Ghi nhận điều chỉnh tồn kho ${sign}${adjustment.quantity} vào lịch sử.`,
        );
      } else if (
        original &&
        (original.tenSanPham !== editingProduct.tenSanPham ||
          original.loaiHang !== editingProduct.loaiHang ||
          original.donViTinh !== editingProduct.donViTinh ||
          original.giaVon !== editingProduct.giaVon)
      ) {
        toast.success('Đã cập nhật thông tin sản phẩm');
      } else {
        toast.success('Đã cập nhật sản phẩm');
      }
    } catch (e: any) {
      toast.error(e.message || 'Không cập nhật được');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (maSKU: string) => {
    if (!confirm('Xoá sản phẩm này VÀ toàn bộ lịch sử giao dịch của nó khỏi báo cáo?')) return;
    setBusy(true);
    try {
      await deleteProduct(currentUser, maSKU);
      onRefresh();
      toast.success('Đã xoá sản phẩm và lịch sử giao dịch liên quan');
    } catch (e: any) {
      toast.error(e.message || 'Không xoá được');
    } finally {
      setBusy(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Quản lý tồn kho</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Quản lý danh sách sản phẩm trong kho</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {currentUser.role === 'admin' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Upload className="mr-2 h-4 w-4" />
                {busy ? 'Đang ghi vào Excel...' : 'Import Excel'}
              </Button>
            </>
          )}
          <Button onClick={onRefresh} variant="outline" disabled={busy} className="border-slate-300">
            <RefreshCw className="mr-2 h-4 w-4 text-slate-600" />
            Tải lại
          </Button>
          <Button
            onClick={handleExport}
            disabled={products.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách sản phẩm ({products.length})</CardTitle>
          <CardDescription>
            Tổng giá trị kho: {formatCurrency(products.reduce((sum, p) => sum + p.giaTriKho, 0))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative w-full sm:w-[360px]">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchInput.length > 0) {
                    e.preventDefault();
                    clearSearch();
                  }
                }}
                placeholder="Tìm theo SKU, tên sản phẩm, loại hàng…"
                aria-label="Tìm kiếm sản phẩm"
                disabled={products.length === 0}
                className="pl-9 pr-9"
                maxLength={200}
              />
              {searchInput.length > 0 && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Xoá từ khoá tìm kiếm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {isFiltering && (
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {filteredProducts.length} / {products.length} sản phẩm
              </span>
            )}
          </div>
          {/* Mobile card list (under md). Built from the same filteredProducts so search works. */}
          <div className="md:hidden space-y-3">
            {products.length === 0 ? (
              <div className="rounded-md border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                Chưa có sản phẩm nào. {currentUser.role === 'admin' ? 'Hãy import file Excel để bắt đầu.' : ''}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-md border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <span>Không tìm thấy sản phẩm khớp với "{activeQuery}".</span>
                  <Button variant="outline" size="sm" onClick={clearSearch}>
                    Xoá bộ lọc
                  </Button>
                </div>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const lowStock = product.tonKho < 10;
                const tonKhoCls = lowStock
                  ? 'inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700'
                  : product.tonKho < 50
                    ? 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700'
                    : 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700';
                return (
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
                      <span className={tonKhoCls}>
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
                    {currentUser.role === 'admin' && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(product)}
                          className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          <Pencil className="mr-1.5 h-4 w-4" /> Sửa
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(product.maSKU)}
                          className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" /> Xoá
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table (md+) */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[60px] font-semibold text-slate-700">STT</TableHead>
                  <TableHead className="font-semibold text-slate-700">Loại hàng</TableHead>
                  <TableHead className="font-semibold text-slate-700">Mã SKU</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tên sản phẩm</TableHead>
                  <TableHead className="font-semibold text-slate-700">Đơn vị</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Tồn kho</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Giá vốn</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Giá trị kho</TableHead>
                  {currentUser.role === 'admin' && (
                    <TableHead className="text-right w-[100px] font-semibold text-slate-700">Thao tác</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentUser.role === 'admin' ? 9 : 8} className="text-center py-8 text-muted-foreground">
                      Chưa có sản phẩm nào. Hãy import file Excel để bắt đầu.
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentUser.role === 'admin' ? 9 : 8} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <span>Không tìm thấy sản phẩm khớp với "{activeQuery}".</span>
                        <Button variant="outline" size="sm" onClick={clearSearch}>
                          Xoá bộ lọc
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const lowStock = product.tonKho < 10;
                    const tonKhoCls = lowStock
                      ? 'inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700'
                      : product.tonKho < 50
                        ? 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700'
                        : 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700';
                    return (
                      <TableRow key={product.maSKU} className="hover:bg-indigo-50/40 transition-colors">
                        <TableCell className="text-slate-500">{product.stt}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {product.loaiHang || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-indigo-700">{product.maSKU}</TableCell>
                        <TableCell className="font-medium">{product.tenSanPham}</TableCell>
                        <TableCell className="text-slate-600">{product.donViTinh}</TableCell>
                        <TableCell className="text-right">
                          <span className={tonKhoCls}>
                            {product.tonKho} {product.donViTinh}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-slate-700">{formatCurrency(product.giaVon)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">{formatCurrency(product.giaTriKho)}</TableCell>
                        {currentUser.role === 'admin' && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(product)}
                                className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                aria-label="Sửa sản phẩm"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(product.maSKU)}
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                aria-label="Xoá sản phẩm"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin sản phẩm
            </DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loại hàng</Label>
                <Input
                  value={editingProduct.loaiHang}
                  onChange={(e) => setEditingProduct({ ...editingProduct, loaiHang: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mã SKU</Label>
                <Input
                  value={editingProduct.maSKU}
                  onChange={(e) => setEditingProduct({ ...editingProduct, maSKU: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Tên sản phẩm</Label>
                <Input
                  value={editingProduct.tenSanPham}
                  onChange={(e) => setEditingProduct({ ...editingProduct, tenSanPham: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Đơn vị tính</Label>
                <Input
                  value={editingProduct.donViTinh}
                  onChange={(e) => setEditingProduct({ ...editingProduct, donViTinh: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tồn kho</Label>
                <Input
                  type="number"
                  value={editingProduct.tonKho}
                  onChange={(e) => setEditingProduct({ ...editingProduct, tonKho: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Giá vốn</Label>
                <Input
                  type="number"
                  value={editingProduct.giaVon}
                  onChange={(e) => {
                    const giaVon = Number(e.target.value);
                    setEditingProduct({
                      ...editingProduct,
                      giaVon,
                      giaTriKho: giaVon * editingProduct.tonKho
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Giá trị kho</Label>
                <Input
                  type="number"
                  value={editingProduct.giaTriKho}
                  disabled
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveEdit} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Pencil className="mr-2 h-4 w-4" />
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
