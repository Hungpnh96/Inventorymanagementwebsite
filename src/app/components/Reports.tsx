import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Transaction } from '../types';
import { FileText, TrendingUp, TrendingDown, FileSpreadsheet, Filter as FilterIcon, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { DataTable, ColumnDef } from './ui-ext/DataTable';
import { MultiSelectFilter } from './ui-ext/MultiSelectFilter';
import { EmptyState } from './ui-ext/EmptyState';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface ReportsProps {
  transactions: Transaction[];
}

export function Reports({ transactions }: ReportsProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);

  const dateFiltered = useMemo(() => {
    let arr = [...transactions];
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      arr = arr.filter((t) => new Date(t.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      arr = arr.filter((t) => new Date(t.date) <= end);
    }
    return arr;
  }, [transactions, startDate, endDate]);

  const filtered = useMemo(() => {
    let arr = dateFiltered;
    if (typeFilter.length > 0) arr = arr.filter((t) => typeFilter.includes(t.type));
    if (userFilter.length > 0) arr = arr.filter((t) => userFilter.includes(t.user));
    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dateFiltered, typeFilter, userFilter]);

  const stats = useMemo(() => {
    const totalImport = filtered.filter((t) => t.type === 'import').reduce((s, t) => s + t.quantity, 0);
    const totalExport = filtered.filter((t) => t.type === 'export').reduce((s, t) => s + t.quantity, 0);
    return {
      totalImport,
      totalExport,
      importCount: filtered.filter((t) => t.type === 'import').length,
      exportCount: filtered.filter((t) => t.type === 'export').length,
      balance: totalImport - totalExport,
    };
  }, [filtered]);

  const userOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of dateFiltered) map.set(t.user, (map.get(t.user) ?? 0) + 1);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([u, count]) => ({ value: u, label: u, count }));
  }, [dateFiltered]);

  const typeOptions = [
    { value: 'import', label: '↓ Nhập', count: dateFiltered.filter((t) => t.type === 'import').length },
    { value: 'export', label: '↑ Xuất', count: dateFiltered.filter((t) => t.type === 'export').length },
  ];

  const exportCsv = () => {
    const header = ['Ngày', 'Loại', 'Mã SKU', 'Sản phẩm', 'Số lượng', 'Người', 'Ghi chú'];
    const rows = filtered.map((t) => [
      new Date(t.date).toLocaleString('vi-VN'),
      t.type === 'import' ? 'Nhập' : 'Xuất',
      t.maSKU,
      t.tenSanPham,
      (t.type === 'import' ? '+' : '-') + t.quantity,
      t.user,
      (t.note || '').replace(/[\r\n]+/g, ' '),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map((v) => escape(String(v))).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<Transaction>[] = [
    {
      id: 'date',
      header: 'Ngày',
      sortValue: (t) => new Date(t.date).getTime(),
      cell: (t) => (
        <span className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {new Date(t.date).toLocaleString('vi-VN', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Loại',
      sortValue: (t) => t.type,
      cell: (t) => (
        <span
          className={
            t.type === 'import'
              ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
          }
        >
          {t.type === 'import' ? '↓ Nhập' : '↑ Xuất'}
        </span>
      ),
    },
    {
      id: 'sku',
      header: 'Mã SKU',
      sortValue: (t) => t.maSKU,
      cell: (t) => <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{t.maSKU}</span>,
    },
    {
      id: 'name',
      header: 'Sản phẩm',
      sortValue: (t) => t.tenSanPham,
      cell: (t) => <span className="font-medium">{t.tenSanPham}</span>,
    },
    {
      id: 'qty',
      header: 'Số lượng',
      align: 'right',
      sortValue: (t) => t.quantity,
      cell: (t) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            t.type === 'import'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-orange-700 dark:text-orange-400',
          )}
        >
          {t.type === 'import' ? '+' : '-'}{t.quantity}
        </span>
      ),
    },
    {
      id: 'user',
      header: 'Người',
      sortValue: (t) => t.user,
      cell: (t) => <span className="text-slate-600 dark:text-slate-400">{t.user}</span>,
      hideClassName: 'hidden xl:table-cell',
    },
    {
      id: 'note',
      header: 'Ghi chú',
      cell: (t) => <span className="max-w-xs truncate text-slate-500 block">{t.note || '—'}</span>,
      hideClassName: 'hidden xl:table-cell',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Báo cáo thống kê</h2>
        <p className="text-sm text-muted-foreground">Lịch sử giao dịch · lọc · sort · export CSV</p>
      </div>

      {/* Date range filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FilterIcon className="h-4 w-4 text-indigo-600" />
            Khoảng thời gian
          </CardTitle>
          <CardDescription>Chọn khoảng để tính tổng và lọc lịch sử bên dưới</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-xs">Từ ngày</Label>
              <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-xs">Đến ngày</Label>
              <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tổng nhập</CardTitle>
            <div className="rounded-md bg-emerald-50 p-1.5 dark:bg-emerald-500/10">
              <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.totalImport.toLocaleString('vi-VN')}</div>
            <p className="text-xs text-muted-foreground">{stats.importCount} giao dịch</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tổng xuất</CardTitle>
            <div className="rounded-md bg-orange-50 p-1.5 dark:bg-orange-500/10">
              <ArrowUpFromLine className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.totalExport.toLocaleString('vi-VN')}</div>
            <p className="text-xs text-muted-foreground">{stats.exportCount} giao dịch</p>
          </CardContent>
        </Card>

        <Card className={cn('border-l-4', stats.balance >= 0 ? 'border-l-indigo-500' : 'border-l-rose-500')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chênh lệch</CardTitle>
            <div className={cn('rounded-md p-1.5', stats.balance >= 0 ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-rose-50 dark:bg-rose-500/10')}>
              {stats.balance >= 0 ? (
                <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold tabular-nums', stats.balance >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-rose-700 dark:text-rose-400')}>
              {stats.balance > 0 ? '+' : ''}{stats.balance.toLocaleString('vi-VN')}
            </div>
            <p className="text-xs text-muted-foreground">Nhập − Xuất</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tổng giao dịch</CardTitle>
            <div className="rounded-md bg-slate-100 p-1.5 dark:bg-slate-800">
              <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filtered.length}</div>
            <p className="text-xs text-muted-foreground">Trong khoảng đã lọc</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lịch sử giao dịch</CardTitle>
          <CardDescription>Bấm tiêu đề cột để sắp xếp · click chip để lọc</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<Transaction>
            data={filtered}
            columns={columns}
            rowKey={(t) => t.id}
            pageSize={25}
            initialSort={{ id: 'date', dir: 'desc' }}
            toolbar={
              <>
                <MultiSelectFilter
                  label="Loại"
                  options={typeOptions}
                  selected={typeFilter}
                  onChange={setTypeFilter}
                />
                <MultiSelectFilter
                  label="Người thực hiện"
                  options={userOptions}
                  selected={userFilter}
                  onChange={setUserFilter}
                />
                {(typeFilter.length > 0 || userFilter.length > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setTypeFilter([]);
                      setUserFilter([]);
                    }}
                  >
                    Xoá bộ lọc
                  </Button>
                )}
              </>
            }
            toolbarRight={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={filtered.length === 0}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4 text-blue-600" />
                Export CSV
              </Button>
            }
            empty={
              <EmptyState
                compact
                icon={FileText}
                title="Không có giao dịch"
                description={
                  startDate || endDate || typeFilter.length || userFilter.length
                    ? 'Không có giao dịch khớp với bộ lọc hiện tại'
                    : 'Chưa có giao dịch nào trong hệ thống'
                }
              />
            }
            mobileCard={(t) => (
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      t.type === 'import'
                        ? 'inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
                    }
                  >
                    {t.type === 'import' ? '↓ Nhập' : '↑ Xuất'}
                  </span>
                  <span
                    className={cn(
                      'font-bold text-base tabular-nums',
                      t.type === 'import' ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400',
                    )}
                  >
                    {t.type === 'import' ? '+' : '-'}{t.quantity}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="font-medium break-words">{t.tenSanPham}</div>
                  <div className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{t.maSKU}</div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {new Date(t.date).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>👤 {t.user}</span>
                </div>
                {t.note && (
                  <div className="mt-1.5 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">{t.note}</div>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
