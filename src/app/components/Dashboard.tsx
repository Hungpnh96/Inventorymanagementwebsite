import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { InventoryData } from '../types';
import { Package, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { stockStatusFromValue, STOCK_COLOR, STOCK_LABEL, TX_COLOR, STOCK_LOW_THRESHOLD } from '../design';

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
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Tổng quan hệ thống quản lý kho</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* EPIC-002-AC40: each KPI card has a distinct accent color, WCAG AA contrast preserved */}
        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Tổng sản phẩm</CardTitle>
            <div className="rounded-md bg-indigo-100 p-1.5">
              <Package className="h-4 w-4 text-indigo-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-900">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Loại sản phẩm</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">Tổng tồn kho</CardTitle>
            <div className="rounded-md bg-emerald-100 p-1.5">
              <Package className="h-4 w-4 text-emerald-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{stats.totalStock}</div>
            <p className="text-xs text-muted-foreground">Đơn vị</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Giá trị kho</CardTitle>
            <div className="rounded-md bg-amber-100 p-1.5">
              <DollarSign className="h-4 w-4 text-amber-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">{formatCurrency(stats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">Tổng giá trị</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Giao dịch hôm nay</CardTitle>
            <div className="rounded-md bg-purple-100 p-1.5">
              <TrendingUp className="h-4 w-4 text-purple-700" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-emerald-700" />
                <span className="text-sm text-purple-900">Nhập: {stats.todayImports}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3 w-3 text-rose-700" />
                <span className="text-sm text-purple-900">Xuất: {stats.todayExports}</span>
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
                .filter(p => p.tonKho < STOCK_LOW_THRESHOLD)
                .slice(0, 5)
                .map((product) => {
                  const status = stockStatusFromValue(product.tonKho);
                  return (
                    <div key={product.maSKU} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{product.tenSanPham}</p>
                        <p className="text-xs text-muted-foreground">{product.maSKU}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STOCK_COLOR[status]}`}
                        title={STOCK_LABEL[status]}
                      >
                        {product.tonKho} {product.donViTinh}
                      </span>
                    </div>
                  );
                })}
              {data.products.filter(p => p.tonKho < STOCK_LOW_THRESHOLD).length === 0 && (
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
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${TX_COLOR[transaction.type]}`}
                    >
                      {transaction.type === 'import' ? '+' : '-'}{transaction.quantity}
                    </span>
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
