import { useEffect, useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Dot,
} from 'recharts';
import { LineChart as LineIcon, TrendingUp, TrendingDown, Wallet, Package } from 'lucide-react';
import { fetchPriceHistory } from '../utils/api';
import { PriceHistoryRow, Product } from '../types';
import { EmptyState } from './ui-ext/EmptyState';
import { ChartSkeleton, TableSkeleton } from './ui-ext/Skeletons';
import { cn } from './ui/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export function PriceHistoryDialog({ open, onOpenChange, product }: Props) {
  const [rows, setRows] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    let cancelled = false;
    setLoading(true);
    fetchPriceHistory(product.maSKU)
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, product]);

  // Build chart data: for each import row, unit_price; also compute running WAC
  const chartData = useMemo(() => {
    let runningStock = 0;
    let runningValue = 0;
    return rows.map((r) => {
      if (r.type === 'import') {
        runningValue += r.quantity * r.unitPrice;
        runningStock += r.quantity;
      } else {
        // export at current WAC
        const wac = runningStock > 0 ? runningValue / runningStock : 0;
        runningValue -= r.quantity * wac;
        runningStock -= r.quantity;
      }
      const wac = runningStock > 0 ? runningValue / runningStock : r.unitPrice;
      return {
        date: new Date(r.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        fullDate: new Date(r.date).toLocaleString('vi-VN'),
        type: r.type,
        unitPrice: r.unitPrice,
        wac: Number(wac.toFixed(2)),
        quantity: r.quantity,
      };
    });
  }, [rows]);

  const stats = useMemo(() => {
    const imports = rows.filter((r) => r.type === 'import');
    if (imports.length === 0) return null;
    const prices = imports.map((r) => r.unitPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = imports[0];
    const last = imports[imports.length - 1];
    const delta = last.unitPrice - first.unitPrice;
    const deltaPct = first.unitPrice > 0 ? (delta / first.unitPrice) * 100 : 0;
    return { min, max, first, last, delta, deltaPct, count: imports.length };
  }, [rows]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="border-b p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/15">
              <LineIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle>Lịch sử giá</SheetTitle>
              {product && (
                <SheetDescription className="text-xs">
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{product.maSKU}</span>{' '}
                  — {product.tenSanPham}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Stats mini */}
          {product && (
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="rounded-md border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Giá vốn hiện tại
                </div>
                <div className="font-bold text-indigo-700 dark:text-indigo-400">
                  {fmtVND(product.giaVon)}
                </div>
                <div className="text-[10px] text-muted-foreground">bình quân gia quyền</div>
              </div>
              <div className="rounded-md border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" /> Tồn hiện tại
                </div>
                <div className="font-bold">{product.tonKho}</div>
                <div className="text-[10px] text-muted-foreground">{product.donViTinh}</div>
              </div>
              {stats && (
                <>
                  <div className="rounded-md border bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cao nhất / Thấp nhất</div>
                    <div className="text-sm">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{fmtVND(stats.max)}</span>{' '}
                      <span className="text-muted-foreground">·</span>{' '}
                      <span className="font-bold text-rose-700 dark:text-rose-400">{fmtVND(stats.min)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{stats.count} lần nhập</div>
                  </div>
                  <div className="rounded-md border bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      {stats.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      Biến động (so lần đầu)
                    </div>
                    <div
                      className={cn(
                        'font-bold text-sm tabular-nums',
                        stats.delta > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : stats.delta < 0
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {stats.delta >= 0 ? '+' : ''}
                      {fmtVND(stats.delta)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      ({stats.deltaPct >= 0 ? '+' : ''}
                      {stats.deltaPct.toFixed(1)}%)
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Chart */}
          <section>
            <h3 className="mb-2 text-sm font-semibold flex items-center gap-2">
              <LineIcon className="h-4 w-4 text-indigo-600" />
              Biểu đồ giá theo thời gian
            </h3>
            {loading ? (
              <ChartSkeleton height={240} />
            ) : chartData.length === 0 ? (
              <EmptyState
                compact
                icon={LineIcon}
                title="Chưa có dữ liệu giá"
                description="Sản phẩm này chưa có phiếu nhập/xuất nào ghi nhận đơn giá"
              />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.6 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--popover-foreground)',
                    }}
                    formatter={(v: number, name: string) => [fmtVND(v), name === 'unitPrice' ? 'Đơn giá' : 'Giá vốn BQ']}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => (v === 'unitPrice' ? 'Đơn giá giao dịch' : 'Giá vốn bình quân (WAC)')}
                  />
                  <Line
                    type="monotone"
                    dataKey="unitPrice"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={(props: any) => (
                      <Dot
                        {...props}
                        r={4}
                        fill={props.payload.type === 'import' ? '#10b981' : '#f97316'}
                        stroke={props.payload.type === 'import' ? '#059669' : '#ea580c'}
                      />
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="wac"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Table */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Chi tiết giao dịch</h3>
            {loading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : rows.length === 0 ? null : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Ngày</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Loại</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">SL</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Đơn giá</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...rows].reverse().map((r) => (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                          {new Date(r.date).toLocaleString('vi-VN', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              r.type === 'import'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
                            )}
                          >
                            {r.type === 'import' ? '↓ Nhập' : '↑ Xuất'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={cn(r.type === 'import' ? 'text-emerald-700 dark:text-emerald-400' : 'text-orange-700 dark:text-orange-400', 'font-semibold')}>
                            {r.type === 'import' ? '+' : '-'}{r.quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fmtVND(r.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                          {fmtVND(r.quantity * r.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
