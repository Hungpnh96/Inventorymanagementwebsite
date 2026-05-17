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
        <h2 className="text-3xl font-bold tracking-tight">Báo cáo thống kê</h2>
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
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Mã SKU</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Ghi chú</TableHead>
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
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.date).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={transaction.type === 'import' ? 'default' : 'destructive'}
                        >
                          {transaction.type === 'import' ? 'Nhập' : 'Xuất'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{transaction.maSKU}</TableCell>
                      <TableCell>{transaction.tenSanPham}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        transaction.type === 'import' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'import' ? '+' : '-'}{transaction.quantity}
                      </TableCell>
                      <TableCell>{transaction.user}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.note || '-'}
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
