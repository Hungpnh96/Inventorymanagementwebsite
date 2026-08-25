import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Product, Transaction, InventoryData, User } from '../types';
import { toast } from 'sonner';
import {
  Plus,
  Package,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Calculator,
  Info,
  AlertTriangle,
  Truck,
  ClipboardList,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ProductCombobox } from './ProductCombobox';
import { postTransaction } from '../utils/api';
import { cn } from './ui/utils';

interface TransactionFormProps {
  products: Product[];
  onTransaction: (transaction: Transaction, updatedProducts: Product[], serverData?: InventoryData) => void;
  onRefresh: () => void;
  currentUser: User;
}

interface NewProductForm {
  loaiHang: string;
  maSKU: string;
  tenSanPham: string;
  donViTinh: string;
  giaVon: number;
}

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

export function TransactionForm({ products, onTransaction, onRefresh, currentUser }: TransactionFormProps) {
  const [type, setType] = useState<'import' | 'export'>('import');
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newProductForm, setNewProductForm] = useState<NewProductForm>({
    loaiHang: '',
    maSKU: '',
    tenSanPham: '',
    donViTinh: '',
    giaVon: 0,
  });

  useEffect(() => {
    if (type === 'export') setMode('select');
    setSelectedProduct(null);
    setUnitPrice('');
  }, [type]);

  // Auto-fill unit price when product selected and price field is empty
  useEffect(() => {
    if (type !== 'import') return;
    if (mode === 'select' && selectedProduct && unitPrice === '') {
      setUnitPrice(selectedProduct.giaVon);
    }
    if (mode === 'new' && newProductForm.giaVon > 0 && unitPrice === '') {
      setUnitPrice(newProductForm.giaVon);
    }
  }, [mode, selectedProduct, newProductForm.giaVon, type, unitPrice]);

  // Derived summary
  const summary = useMemo(() => {
    const product = mode === 'select' ? selectedProduct : null;
    const currentPrice = product ? product.giaVon : mode === 'new' ? newProductForm.giaVon : 0;
    // For imports, use the entered unitPrice; for exports use current WAC
    const effectivePrice = type === 'import' && unitPrice !== '' ? unitPrice : currentPrice;
    const totalValue = quantity * effectivePrice;
    const currentStock = product?.tonKho ?? 0;
    const newStock = type === 'import' ? currentStock + quantity : currentStock - quantity;
    const overExport = type === 'export' && quantity > currentStock;
    // WAC preview for imports
    const wacAfter =
      type === 'import' && newStock > 0
        ? (currentStock * currentPrice + quantity * effectivePrice) / newStock
        : currentPrice;
    return { product, giaVon: currentPrice, effectivePrice, totalValue, currentStock, newStock, overExport, wacAfter };
  }, [mode, selectedProduct, newProductForm, quantity, unitPrice, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      toast.error('Số lượng phải lớn hơn 0');
      return;
    }
    let payload: Parameters<typeof postTransaction>[1];
    if (mode === 'select') {
      if (!selectedProduct) {
        toast.error('Vui lòng chọn sản phẩm');
        return;
      }
      payload = {
        maSKU: selectedProduct.maSKU,
        tenSanPham: selectedProduct.tenSanPham,
        type,
        quantity,
        note,
        unitPrice: type === 'import' && unitPrice !== '' ? Number(unitPrice) : undefined,
      };
    } else {
      if (!newProductForm.maSKU || !newProductForm.tenSanPham) {
        toast.error('Vui lòng nhập đầy đủ mã SKU và tên sản phẩm');
        return;
      }
      const existing = products.find((p) => p.maSKU === newProductForm.maSKU);
      const newProduct: Product = existing ?? {
        stt: products.length + 1,
        loaiHang: newProductForm.loaiHang,
        maSKU: newProductForm.maSKU,
        tenSanPham: newProductForm.tenSanPham,
        donViTinh: newProductForm.donViTinh,
        tonKho: 0,
        giaVon: newProductForm.giaVon,
        giaTriKho: 0,
      };
      payload = {
        maSKU: newProduct.maSKU,
        tenSanPham: newProduct.tenSanPham,
        type,
        quantity,
        note,
        newProduct,
        unitPrice: type === 'import' && unitPrice !== '' ? Number(unitPrice) : undefined,
      };
    }
    setSubmitting(true);
    try {
      const { transaction, data } = await postTransaction(currentUser, payload);
      onTransaction(transaction, data.products, data);
      setSelectedProduct(null);
      setQuantity(0);
      setUnitPrice('');
      setNote('');
      setNewProductForm({ loaiHang: '', maSKU: '', tenSanPham: '', donViTinh: '', giaVon: 0 });
      toast.success(`Đã ${type === 'import' ? 'nhập' : 'xuất'} kho thành công`);
    } catch (err: any) {
      toast.error(err.message || 'Giao dịch thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const accentBg = type === 'import' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700';
  const accentRing = type === 'import' ? 'ring-emerald-500/30' : 'ring-orange-500/30';
  const accentText = type === 'import' ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400';
  const accentLight =
    type === 'import'
      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
      : 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30';

  const canSubmit = !submitting && quantity > 0 && (mode === 'new' ? !!newProductForm.maSKU && !!newProductForm.tenSanPham : !!selectedProduct) && !summary.overExport;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Xuất nhập kho</h2>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                type === 'import'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
              )}
            >
              {type === 'import' ? '↓ Nhập' : '↑ Xuất'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Ghi nhận giao dịch — lưu trực tiếp vào Postgres</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            Kho có <strong>{products.length}</strong> SP
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tải lại
          </Button>
        </div>
      </div>

      {products.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Kho đang rỗng</div>
            {currentUser.role === 'admin'
              ? 'Vào trang Quản lý kho → Import Excel để khởi tạo dữ liệu.'
              : 'Cần admin import dữ liệu ban đầu trước khi giao dịch.'}
          </div>
        </div>
      )}

      {/* Type toggle — segmented */}
      <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm w-full sm:w-auto">
        <button
          type="button"
          onClick={() => setType('import')}
          className={cn(
            'flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all',
            type === 'import'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <ArrowDownToLine className="h-4 w-4" />
          Nhập kho
        </button>
        <button
          type="button"
          onClick={() => setType('export')}
          className={cn(
            'flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all',
            type === 'export'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Xuất kho
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
        {/* Left: form (col-span 2) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Section 1: chọn / tạo sản phẩm */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className={cn('h-4 w-4', accentText)} />
                1. Chọn sản phẩm
              </CardTitle>
              <CardDescription>
                {type === 'import'
                  ? 'Chọn từ danh mục có sẵn hoặc tạo mới ngay tại đây'
                  : 'Chỉ liệt kê sản phẩm còn tồn kho'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {type === 'import' ? (
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'select' | 'new')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="select">Sản phẩm có sẵn</TabsTrigger>
                    <TabsTrigger value="new">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Tạo mới / SKU mới
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="select" className="mt-4 space-y-3">
                    <ProductCombobox
                      products={products}
                      value={selectedProduct}
                      onChange={setSelectedProduct}
                      onCreateNew={(q) => {
                        setMode('new');
                        setNewProductForm((prev) => ({ ...prev, tenSanPham: q }));
                      }}
                      createLabel="Tạo sản phẩm mới"
                    />
                  </TabsContent>

                  <TabsContent value="new" className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="tenSanPham" className="text-xs font-medium">
                          Tên sản phẩm <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="tenSanPham"
                          value={newProductForm.tenSanPham}
                          onChange={(e) => setNewProductForm({ ...newProductForm, tenSanPham: e.target.value })}
                          placeholder="VD: Phân bón NPK 16-16-8"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="maSKU" className="text-xs font-medium">
                          Mã SKU <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          id="maSKU"
                          value={newProductForm.maSKU}
                          onChange={(e) => setNewProductForm({ ...newProductForm, maSKU: e.target.value })}
                          placeholder="VD: PB001"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="loaiHang" className="text-xs font-medium">Loại hàng</Label>
                        <Input
                          id="loaiHang"
                          value={newProductForm.loaiHang}
                          onChange={(e) => setNewProductForm({ ...newProductForm, loaiHang: e.target.value })}
                          placeholder="VD: Phân bón"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="donViTinh" className="text-xs font-medium">Đơn vị tính</Label>
                        <Input
                          id="donViTinh"
                          value={newProductForm.donViTinh}
                          onChange={(e) => setNewProductForm({ ...newProductForm, donViTinh: e.target.value })}
                          placeholder="VD: Bao, Kg, Chai..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="giaVon" className="text-xs font-medium">Giá vốn (VNĐ)</Label>
                        <Input
                          id="giaVon"
                          type="number"
                          inputMode="numeric"
                          value={newProductForm.giaVon || ''}
                          onChange={(e) =>
                            setNewProductForm({ ...newProductForm, giaVon: Number(e.target.value) })
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-300">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      Nếu mã SKU đã tồn tại trong kho, hệ thống sẽ cộng dồn số lượng vào sản phẩm đó.
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <ProductCombobox
                  products={products.filter((p) => p.tonKho > 0)}
                  value={selectedProduct}
                  onChange={setSelectedProduct}
                  emptyText="Không có sản phẩm nào còn tồn kho."
                />
              )}
            </CardContent>
          </Card>

          {/* Section 2: số lượng + ghi chú */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className={cn('h-4 w-4', accentText)} />
                2. Số lượng &amp; ghi chú
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs font-medium">
                  Số lượng <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="quantity"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    placeholder="0"
                    className={cn(
                      'text-lg font-semibold h-11 pr-20',
                      summary.overExport && 'border-rose-400 focus-visible:ring-rose-400',
                    )}
                    required
                  />
                  {summary.product?.donViTinh && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {summary.product.donViTinh}
                    </span>
                  )}
                </div>
                {summary.overExport && (
                  <p className="text-xs text-rose-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Vượt tồn kho ({summary.currentStock} {summary.product?.donViTinh})
                  </p>
                )}
              </div>

              {/* Unit price — only for imports; export uses current WAC automatically */}
              {type === 'import' && (
                <div className="space-y-1.5">
                  <Label htmlFor="unit-price" className="text-xs font-medium">
                    Đơn giá nhập (VNĐ / {summary.product?.donViTinh || 'đv'}){' '}
                    <span className="text-muted-foreground">— dùng để tính giá vốn bình quân</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="unit-price"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={unitPrice === '' ? '' : unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={summary.product ? String(summary.product.giaVon) : '0'}
                      className="h-11 pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      VNĐ
                    </span>
                  </div>
                  {summary.product && unitPrice !== '' && Number(unitPrice) !== summary.product.giaVon && (
                    <p className="text-xs text-sky-700 dark:text-sky-400 rounded bg-sky-50 dark:bg-sky-500/10 px-2 py-1">
                      💡 Giá vốn hiện tại: {fmtVND(summary.product.giaVon)}. Sau giao dịch, giá vốn bình quân{' '}
                      = <strong>{fmtVND(summary.wacAfter)}</strong>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="note" className="text-xs font-medium">Ghi chú</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    type === 'import'
                      ? 'VD: Nhập từ nhà cung cấp ABC, hóa đơn #123'
                      : 'VD: Xuất cho khách XYZ, đơn hàng #456'
                  }
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: summary sidebar */}
        <div className="space-y-4">
          <Card className={cn('border-2', accentLight)}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className={cn('h-4 w-4', accentText)} />
                Tóm tắt giao dịch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {summary.product || (mode === 'new' && newProductForm.tenSanPham) ? (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">Sản phẩm</div>
                    <div className="font-medium">
                      {summary.product?.tenSanPham || newProductForm.tenSanPham}
                    </div>
                    <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      {summary.product?.maSKU || newProductForm.maSKU}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-card/50 dark:bg-card px-2.5 py-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tồn hiện tại</div>
                      <div className="font-semibold">
                        {summary.currentStock} {summary.product?.donViTinh ?? ''}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'rounded-md px-2.5 py-1.5',
                        summary.overExport
                          ? 'bg-rose-100 dark:bg-rose-500/15'
                          : 'bg-card/50 dark:bg-card',
                      )}
                    >
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sau giao dịch</div>
                      <div
                        className={cn(
                          'font-semibold',
                          summary.overExport && 'text-rose-700 dark:text-rose-400',
                        )}
                      >
                        {summary.newStock} {summary.product?.donViTinh ?? ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">Giá trị giao dịch</span>
                    <span className={cn('text-lg font-bold tabular-nums', accentText)}>
                      {fmtVND(summary.totalValue)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Chọn sản phẩm và nhập số lượng để xem tóm tắt
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            className={cn('h-12 w-full text-base font-semibold text-white shadow-sm', accentBg, accentRing, 'ring-4')}
            disabled={!canSubmit}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {submitting
              ? 'Đang ghi...'
              : type === 'import'
                ? `Xác nhận nhập ${quantity > 0 ? quantity : ''}`.trim()
                : `Xác nhận xuất ${quantity > 0 ? quantity : ''}`.trim()}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Ấn nút để ghi giao dịch vào hệ thống · không thể hoàn tác
          </p>
        </div>
      </form>
    </div>
  );
}
