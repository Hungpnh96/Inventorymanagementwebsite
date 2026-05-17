import { useState, useMemo, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Product, Transaction, User } from '../types';
import { toast } from 'sonner';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface TransactionFormProps {
  products: Product[];
  onTransaction: (transaction: Transaction, updatedProducts: Product[]) => void;
  currentUser: User;
}

interface NewProductForm {
  loaiHang: string;
  maSKU: string;
  tenSanPham: string;
  donViTinh: string;
  giaVon: number;
}

export function TransactionForm({ products, onTransaction, currentUser }: TransactionFormProps) {
  const [type, setType] = useState<'import' | 'export'>('import');
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  // Form for new product
  const [newProductForm, setNewProductForm] = useState<NewProductForm>({
    loaiHang: '',
    maSKU: '',
    tenSanPham: '',
    donViTinh: '',
    giaVon: 0,
  });

  useEffect(() => {
    if (type === 'export') {
      setMode('select');
    }
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (quantity <= 0) {
      toast.error('Số lượng phải lớn hơn 0');
      return;
    }

    let productInfo: Product;

    // Determine product info based on mode
    if (mode === 'select') {
      if (!selectedProduct) {
        toast.error('Vui lòng chọn sản phẩm');
        return;
      }
      productInfo = selectedProduct;
    } else {
      // New product mode (only for import)
      if (!newProductForm.maSKU || !newProductForm.tenSanPham) {
        toast.error('Vui lòng nhập đầy đủ mã SKU và tên sản phẩm');
        return;
      }

      // Check if SKU already exists
      const existingProduct = products.find(p => p.maSKU === newProductForm.maSKU);
      if (existingProduct) {
        productInfo = existingProduct;
      } else {
        // Create new product entry
        productInfo = {
          stt: products.length + 1,
          loaiHang: newProductForm.loaiHang,
          maSKU: newProductForm.maSKU,
          tenSanPham: newProductForm.tenSanPham,
          donViTinh: newProductForm.donViTinh,
          tonKho: 0,
          giaVon: newProductForm.giaVon,
          giaTriKho: 0,
        };
      }
    }

    // Validate export quantity
    if (type === 'export' && quantity > productInfo.tonKho) {
      toast.error('Số lượng xuất vượt quá tồn kho');
      return;
    }

    const transaction: Transaction = {
      id: Date.now().toString(),
      productId: productInfo.maSKU,
      maSKU: productInfo.maSKU,
      tenSanPham: productInfo.tenSanPham,
      type,
      quantity,
      date: new Date(),
      note,
      user: currentUser.username,
    };

    // Update or add product
    const existingProductIndex = products.findIndex(p => p.maSKU === productInfo.maSKU);
    let updatedProducts: Product[];

    if (existingProductIndex >= 0) {
      // Update existing product
      updatedProducts = products.map(p => {
        if (p.maSKU === productInfo.maSKU) {
          const newStock = type === 'import'
            ? p.tonKho + quantity
            : p.tonKho - quantity;
          return {
            ...p,
            tonKho: newStock,
            giaTriKho: newStock * p.giaVon,
          };
        }
        return p;
      });
    } else {
      // Add new product (only possible in import mode)
      const newStock = quantity;
      const newProduct = {
        ...productInfo,
        tonKho: newStock,
        giaTriKho: newStock * productInfo.giaVon,
      };
      updatedProducts = [...products, newProduct];
    }

    onTransaction(transaction, updatedProducts);

    // Reset form
    setSelectedProduct(null);
    setQuantity(0);
    setNote('');
    setNewProductForm({
      loaiHang: '',
      maSKU: '',
      tenSanPham: '',
      donViTinh: '',
      giaVon: 0,
    });

    toast.success(`Đã ${type === 'import' ? 'nhập' : 'xuất'} kho thành công`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Xuất nhập kho</h2>
        <p className="text-muted-foreground">Ghi nhận giao dịch xuất nhập kho</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin giao dịch</CardTitle>
          <CardDescription>Nhập thông tin để ghi nhận giao dịch</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex gap-4">
              <Button
                type="button"
                variant={type === 'import' ? 'default' : 'outline'}
                onClick={() => setType('import')}
                className="flex-1"
              >
                Nhập kho
              </Button>
              <Button
                type="button"
                variant={type === 'export' ? 'default' : 'outline'}
                onClick={() => setType('export')}
                className="flex-1"
              >
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
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className="w-full justify-between"
                        >
                          {selectedProduct
                            ? `${selectedProduct.tenSanPham} (${selectedProduct.maSKU})`
                            : "Chọn sản phẩm..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Tìm kiếm sản phẩm..." />
                          <CommandList>
                            <CommandEmpty>Không tìm thấy sản phẩm.</CommandEmpty>
                            <CommandGroup>
                              {products.map((product) => (
                                <CommandItem
                                  key={product.maSKU}
                                  value={`${product.tenSanPham} ${product.maSKU}`}
                                  onSelect={() => {
                                    setSelectedProduct(product);
                                    setOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProduct?.maSKU === product.maSKU
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{product.tenSanPham}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {product.maSKU} - Tồn: {product.tonKho} {product.donViTinh}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maSKU">Mã SKU *</Label>
                      <Input
                        id="maSKU"
                        value={newProductForm.maSKU}
                        onChange={(e) => setNewProductForm({ ...newProductForm, maSKU: e.target.value })}
                        placeholder="Nhập mã SKU"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loaiHang">Loại hàng</Label>
                      <Input
                        id="loaiHang"
                        value={newProductForm.loaiHang}
                        onChange={(e) => setNewProductForm({ ...newProductForm, loaiHang: e.target.value })}
                        placeholder="Loại hàng"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="tenSanPham">Tên sản phẩm *</Label>
                      <Input
                        id="tenSanPham"
                        value={newProductForm.tenSanPham}
                        onChange={(e) => setNewProductForm({ ...newProductForm, tenSanPham: e.target.value })}
                        placeholder="Nhập tên sản phẩm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="donViTinh">Đơn vị tính</Label>
                      <Input
                        id="donViTinh"
                        value={newProductForm.donViTinh}
                        onChange={(e) => setNewProductForm({ ...newProductForm, donViTinh: e.target.value })}
                        placeholder="Cái, Hộp, Kg..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="giaVon">Giá vốn</Label>
                      <Input
                        id="giaVon"
                        type="number"
                        value={newProductForm.giaVon || ''}
                        onChange={(e) => setNewProductForm({ ...newProductForm, giaVon: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                    <strong>Lưu ý:</strong> Nếu mã SKU đã tồn tại, hệ thống sẽ tự động cộng thêm số lượng vào sản phẩm có sẵn.
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {type === 'export' && (
              <div className="space-y-2">
                <Label>Sản phẩm</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      {selectedProduct
                        ? `${selectedProduct.tenSanPham} (${selectedProduct.maSKU})`
                        : "Chọn sản phẩm..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Tìm kiếm sản phẩm..." />
                      <CommandList>
                        <CommandEmpty>Không tìm thấy sản phẩm.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.maSKU}
                              value={`${product.tenSanPham} ${product.maSKU}`}
                              onSelect={() => {
                                setSelectedProduct(product);
                                setOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProduct?.maSKU === product.maSKU
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{product.tenSanPham}</span>
                                <span className="text-xs text-muted-foreground">
                                  {product.maSKU} - Tồn: {product.tonKho} {product.donViTinh}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
              className="w-full"
              disabled={mode === 'select' && !selectedProduct}
            >
              {type === 'import' ? 'Nhập kho' : 'Xuất kho'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
