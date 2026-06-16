import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Product, Transaction, InventoryData, User } from '../types';
import { toast } from 'sonner';
import { Plus, Package, RefreshCw, ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ProductCombobox } from './ProductCombobox';
import { postTransaction } from '../utils/api';

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

export function TransactionForm({ products, onTransaction, onRefresh, currentUser }: TransactionFormProps) {
  const [type, setType] = useState<'import' | 'export'>('import');
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [newProductForm, setNewProductForm] = useState<NewProductForm>({
    loaiHang: '',
    maSKU: '',
    tenSanPham: '',
    donViTinh: '',
    giaVon: 0,
  });

  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    if (type === 'export') setMode('select');
    setSelectedProduct(null);
  }, [type]);

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
      };
    }

    setSubmitting(true);
    try {
      const { transaction, data } = await postTransaction(currentUser, payload);
      onTransaction(transaction, data.products, data);
      setSelectedProduct(null);
      setQuantity(0);
      setNote('');
      setNewProductForm({ loaiHang: '', maSKU: '', tenSanPham: '', donViTinh: '', giaVon: 0 });
      toast.success(`Đã ${type === 'import' ? 'nhập' : 'xuất'} kho thành công`);
    } catch (err: any) {
      toast.error(err.message || 'Giao dịch thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Xuất nhập kho</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Ghi nhận giao dịch xuất nhập kho</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm flex-1 sm:flex-initial">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">
              Kho có <strong>{products.length}</strong> sản phẩm
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tải lại
          </Button>
        </div>
      </div>

      {products.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Kho đang rỗng. {isAdmin
            ? 'Vào trang "Quản lý kho" để import file Excel làm dữ liệu gốc.'
            : 'Cần tài khoản admin để import dữ liệu ban đầu vào hệ thống.'}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin giao dịch</CardTitle>
          <CardDescription>Mọi thay đổi đều được ghi trực tiếp vào file Excel trên server</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex gap-4">
              <Button
                type="button"
                onClick={() => setType('import')}
                className={
                  type === 'import'
                    ? 'flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'flex-1 border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
                }
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Nhập kho
              </Button>
              <Button
                type="button"
                onClick={() => setType('export')}
                className={
                  type === 'export'
                    ? 'flex-1 bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
                    : 'flex-1 border border-orange-300 bg-white text-orange-700 hover:bg-orange-50'
                }
              >
                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                Xuất kho
              </Button>
            </div>

            {type === 'import' && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'select' | 'new')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="select">Chọn sản phẩm có sẵn</TabsTrigger>
                  <TabsTrigger value="new">
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm mới / Nhập theo SKU
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="select" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Sản phẩm</Label>
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
                  </div>

                  {selectedProduct && (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tồn kho hiện tại:</span>
                        <span className="text-sm font-medium">
                          {selectedProduct.tonKho} {selectedProduct.donViTinh}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Giá vốn:</span>
                        <span className="text-sm font-medium">
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND',
                          }).format(selectedProduct.giaVon)}
                        </span>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="new" className="space-y-4">
                  <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maSKU">Mã SKU *</Label>
                          <Input
                            id="maSKU"
                            value={newProductForm.maSKU}
                            onChange={(e) =>
                              setNewProductForm({ ...newProductForm, maSKU: e.target.value })
                            }
                            placeholder="Nhập mã SKU"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="loaiHang">Loại hàng</Label>
                          <Input
                            id="loaiHang"
                            value={newProductForm.loaiHang}
                            onChange={(e) =>
                              setNewProductForm({ ...newProductForm, loaiHang: e.target.value })
                            }
                            placeholder="Loại hàng"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="tenSanPham">Tên sản phẩm *</Label>
                          <Input
                            id="tenSanPham"
                            value={newProductForm.tenSanPham}
                            onChange={(e) =>
                              setNewProductForm({ ...newProductForm, tenSanPham: e.target.value })
                            }
                            placeholder="Nhập tên sản phẩm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="donViTinh">Đơn vị tính</Label>
                          <Input
                            id="donViTinh"
                            value={newProductForm.donViTinh}
                            onChange={(e) =>
                              setNewProductForm({ ...newProductForm, donViTinh: e.target.value })
                            }
                            placeholder="Cái, Hộp, Kg..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="giaVon">Giá vốn</Label>
                          <Input
                            id="giaVon"
                            type="number"
                            value={newProductForm.giaVon || ''}
                            onChange={(e) =>
                              setNewProductForm({
                                ...newProductForm,
                                giaVon: Number(e.target.value),
                              })
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                      <strong>Lưu ý:</strong> Nếu mã SKU đã tồn tại, hệ thống sẽ cộng thêm số lượng
                      vào sản phẩm có sẵn.
                    </div>
                  </>
                </TabsContent>
              </Tabs>
            )}

            {type === 'export' && (
              <div className="space-y-2">
                <Label>Sản phẩm</Label>
                <ProductCombobox
                  products={products.filter((p) => p.tonKho > 0)}
                  value={selectedProduct}
                  onChange={setSelectedProduct}
                  emptyText="Không có sản phẩm nào còn tồn kho."
                />
                {selectedProduct && (
                  <div className="p-4 bg-muted rounded-lg space-y-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Tồn kho hiện tại:</span>
                      <span className="text-sm font-medium">
                        {selectedProduct.tonKho} {selectedProduct.donViTinh}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Giá vốn:</span>
                      <span className="text-sm font-medium">
                        {new Intl.NumberFormat('vi-VN', {
                          style: 'currency',
                          currency: 'VND',
                        }).format(selectedProduct.giaVon)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quantity">Số lượng</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder="Nhập số lượng"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Ghi chú (tùy chọn)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú"
                rows={3}
              />
            </div>

            <Button
              type="submit"
              className={
                type === 'import'
                  ? 'w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'w-full bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
              }
              disabled={submitting || (mode === 'select' && !selectedProduct)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {submitting
                ? 'Đang ghi vào Excel...'
                : type === 'import'
                  ? 'Xác nhận nhập kho'
                  : 'Xác nhận xuất kho'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
