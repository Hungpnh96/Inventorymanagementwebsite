import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Transaction } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { FileText, TrendingUp, TrendingDown } from 'lucide-react';

interface ReportsProps {
  transactions: Transaction[];
}

export function Reports({ transactions }: ReportsProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => new Date(t.date) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.date) <= end);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, startDate, endDate]);

  const stats = useMemo(() => {
    const totalImport = filteredTransactions
      .filter(t => t.type === 'import')
      .reduce((sum, t) => sum + t.quantity, 0);

    const totalExport = filteredTransactions
      .filter(t => t.type === 'export')
      .reduce((sum, t) => sum + t.quantity, 0);

    const importCount = filteredTransactions.filter(t => t.type === 'import').length;
    const exportCount = filteredTransactions.filter(t => t.type === 'export').length;

    return {
      totalImport,
      totalExport,
      importCount,
      exportCount,
      balance: totalImport - totalExport,
    };
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Báo cáo thống kê</h2>
        <p className="text-muted-foreground">Thống kê xuất nhập kho theo khoảng thời gian</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lọc theo thời gian</CardTitle>
          <CardDescription>Chọn khoảng thời gian để xem báo cáo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Từ ngày</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Đến ngày</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng nhập kho</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalImport}</div>
            <p className="text-xs text-muted-foreground">{stats.importCount} giao dịch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng xuất kho</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalExport}</div>
            <p className="text-xs text-muted-foreground">{stats.exportCount} giao dịch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chênh lệch</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              stats.balance > 0 ? 'text-green-600' : stats.balance < 0 ? 'text-red-600' : ''
            }`}>
              {stats.balance > 0 ? '+' : ''}{stats.balance}
            </div>
            <p className="text-xs text-muted-foreground">Nhập - Xuất</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng giao dịch</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTransactions.length}</div>
            <p className="text-xs text-muted-foreground">Trong khoảng thời gian</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử giao dịch</CardTitle>
          <CardDescription>
            Hiển thị {filteredTransactions.length} giao dịch
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {filteredTransactions.length === 0 ? (
              <div className="rounded-md border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                Không có giao dịch nào trong khoảng thời gian này
              </div>
            ) : (
              filteredTransactions.map((transaction) => (
                <div key={transaction.id} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={
                        transaction.type === 'import'
                          ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                          : 'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700'
                      }
                    >
                      {transaction.type === 'import' ? '↓ Nhập' : '↑ Xuất'}
                    </span>
                    <span
                      className={`font-bold text-base ${
                        transaction.type === 'import' ? 'text-emerald-700' : 'text-orange-700'
                      }`}
                    >
                      {transaction.type === 'import' ? '+' : '-'}
                      {transaction.quantity}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="font-medium text-slate-900 break-words">{transaction.tenSanPham}</div>
                    <div className="font-mono text-xs text-indigo-700">{transaction.maSKU}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {new Date(transaction.date).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>👤 {transaction.user}</span>
                  </div>
                  {transaction.note && (
                    <div className="mt-1.5 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      {transaction.note}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Ngày</TableHead>
                  <TableHead className="font-semibold text-slate-700">Loại</TableHead>
                  <TableHead className="font-semibold text-slate-700">Mã SKU</TableHead>
                  <TableHead className="font-semibold text-slate-700">Sản phẩm</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Số lượng</TableHead>
                  <TableHead className="font-semibold text-slate-700">Người thực hiện</TableHead>
                  <TableHead className="font-semibold text-slate-700">Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Không có giao dịch nào trong khoảng thời gian này
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-indigo-50/40 transition-colors">
                      <TableCell className="text-slate-600">
                        {new Date(transaction.date).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            transaction.type === 'import'
                              ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700'
                              : 'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700'
                          }
                        >
                          {transaction.type === 'import' ? '↓ Nhập' : '↑ Xuất'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-indigo-700">{transaction.maSKU}</TableCell>
                      <TableCell className="font-medium">{transaction.tenSanPham}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          transaction.type === 'import' ? 'text-emerald-700' : 'text-orange-700'
                        }`}
                      >
                        {transaction.type === 'import' ? '+' : '-'}
                        {transaction.quantity}
                      </TableCell>
                      <TableCell className="text-slate-600">{transaction.user}</TableCell>
                      <TableCell className="max-w-xs truncate text-slate-500">
                        {transaction.note || '—'}
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
