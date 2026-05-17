import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Product } from '../types';
import { Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface ProductSearchProps {
  products: Product[];
}

export function ProductSearch({ products }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products;
    }

    const term = searchTerm.toLowerCase();
    return products.filter(
      (product) =>
        product.tenSanPham.toLowerCase().includes(term) ||
        product.maSKU.toLowerCase().includes(term) ||
        product.loaiHang.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tìm kiếm sản phẩm</h2>
        <p className="text-muted-foreground">Tìm kiếm nhanh theo tên hoặc mã SKU</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tìm kiếm</CardTitle>
          <CardDescription>Nhập tên sản phẩm, mã SKU hoặc loại hàng để tìm kiếm</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Tìm thấy {filteredProducts.length} sản phẩm
            </p>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã SKU</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead>Loại hàng</TableHead>
                    <TableHead>Đơn vị</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                    <TableHead className="text-right">Giá vốn</TableHead>
                    <TableHead className="text-right">Giá trị</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchTerm
                          ? 'Không tìm thấy sản phẩm nào'
                          : 'Nhập từ khóa để tìm kiếm'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.maSKU}>
                        <TableCell className="font-mono">{product.maSKU}</TableCell>
                        <TableCell className="font-medium">{product.tenSanPham}</TableCell>
                        <TableCell>{product.loaiHang}</TableCell>
                        <TableCell>{product.donViTinh}</TableCell>
                        <TableCell className="text-right">
                          <span className={product.tonKho < 10 ? 'text-red-600 font-bold' : ''}>
                            {product.tonKho}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(product.giaVon)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(product.giaTriKho)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
