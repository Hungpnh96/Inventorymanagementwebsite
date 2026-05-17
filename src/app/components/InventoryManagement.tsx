import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Product, User } from '../types';
import { parseExcelFile, exportToExcel } from '../utils/excelUtils';
import { Upload, Download, Pencil, Trash2 } from 'lucide-react';
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
  currentUser: User;
}

export function InventoryManagement({ products, onProductsUpdate, currentUser }: InventoryManagementProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedProducts = await parseExcelFile(file);
      onProductsUpdate(parsedProducts);
      toast.success(`Đã import ${parsedProducts.length} sản phẩm thành công`);
    } catch (error) {
      toast.error('Lỗi khi import file Excel');
      console.error(error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  const handleSaveEdit = () => {
    if (!editingProduct) return;

    const updatedProducts = products.map(p =>
      p.maSKU === editingProduct.maSKU ? editingProduct : p
    );
    onProductsUpdate(updatedProducts);
    setIsEditDialogOpen(false);
    setEditingProduct(null);
    toast.success('Đã cập nhật sản phẩm');
  };

  const handleDelete = (maSKU: string) => {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
      const updatedProducts = products.filter(p => p.maSKU !== maSKU);
      onProductsUpdate(updatedProducts);
      toast.success('Đã xóa sản phẩm');
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
          <h2 className="text-3xl font-bold tracking-tight">Quản lý tồn kho</h2>
          <p className="text-muted-foreground">Quản lý danh sách sản phẩm trong kho</p>
        </div>
        <div className="flex gap-2">
          {currentUser.role === 'admin' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import Excel
              </Button>
            </>
          )}
          <Button onClick={handleExport} disabled={products.length === 0}>
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
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">STT</TableHead>
                  <TableHead>Loại hàng</TableHead>
                  <TableHead>Mã SKU</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead className="text-right">Tồn kho</TableHead>
                  <TableHead className="text-right">Giá vốn</TableHead>
                  <TableHead className="text-right">Giá trị kho</TableHead>
                  {currentUser.role === 'admin' && (
                    <TableHead className="text-right w-[100px]">Thao tác</TableHead>
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
                ) : (
                  products.map((product) => (
                    <TableRow key={product.maSKU}>
                      <TableCell>{product.stt}</TableCell>
                      <TableCell>{product.loaiHang}</TableCell>
                      <TableCell className="font-mono">{product.maSKU}</TableCell>
                      <TableCell>{product.tenSanPham}</TableCell>
                      <TableCell>{product.donViTinh}</TableCell>
                      <TableCell className="text-right">{product.tonKho}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.giaVon)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.giaTriKho)}</TableCell>
                      {currentUser.role === 'admin' && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(product.maSKU)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
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
            <Button onClick={handleSaveEdit}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
