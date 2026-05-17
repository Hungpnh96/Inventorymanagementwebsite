import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { InventoryData } from '../types';
import { Package, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface DashboardProps {
  data: InventoryData;
}

export function Dashboard({ data }: DashboardProps) {
  const stats = useMemo(() => {
    const totalProducts = data.products.length;
    const totalValue = data.products.reduce((sum, p) => sum + p.giaTriKho, 0);
    const totalStock = data.products.reduce((sum, p) => sum + p.tonKho, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = data.transactions.filter(t => {
      const tDate = new Date(t.date);
      tDate.setHours(0, 0, 0, 0);
      return tDate.getTime() === today.getTime();
    });

    const todayImports = todayTransactions
      .filter(t => t.type === 'import')
      .reduce((sum, t) => sum + t.quantity, 0);

    const todayExports = todayTransactions
      .filter(t => t.type === 'export')
      .reduce((sum, t) => sum + t.quantity, 0);

    return {
      totalProducts,
      totalValue,
      totalStock,
      todayImports,
      todayExports,
    };
  }, [data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Tổng quan hệ thống quản lý kho</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng sản phẩm</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Loại sản phẩm</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng tồn kho</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStock}</div>
            <p className="text-xs text-muted-foreground">Đơn vị</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Giá trị kho</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Tổng giá trị</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Giao dịch hôm nay</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-sm">Nhập: {stats.todayImports}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3 w-3 text-red-600" />
                <span className="text-sm">Xuất: {stats.todayExports}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sản phẩm tồn kho thấp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.products
                .filter(p => p.tonKho < 10)
                .slice(0, 5)
                .map((product) => (
                  <div key={product.maSKU} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{product.tenSanPham}</p>
                      <p className="text-xs text-muted-foreground">{product.maSKU}</p>
                    </div>
                    <div className="text-sm font-bold text-red-600">
                      {product.tonKho} {product.donViTinh}
                    </div>
                  </div>
                ))}
              {data.products.filter(p => p.tonKho < 10).length === 0 && (
                <p className="text-sm text-muted-foreground">Không có sản phẩm tồn kho thấp</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Giao dịch gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.transactions
                .slice(-5)
                .reverse()
                .map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{transaction.tenSanPham}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <div className={`text-sm font-bold ${
                      transaction.type === 'import' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'import' ? '+' : '-'}{transaction.quantity}
                    </div>
                  </div>
                ))}
              {data.transactions.length === 0 && (
                <p className="text-sm text-muted-foreground">Chưa có giao dịch nào</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
