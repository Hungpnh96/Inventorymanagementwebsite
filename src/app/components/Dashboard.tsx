import { useMemo, type ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { InventoryData } from '../types';
import {
  Package,
  Warehouse,
  Wallet,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { cn } from './ui/utils';
import { InOutChart } from './charts/InOutChart';
import { CategoryDonut } from './charts/CategoryDonut';
import { EmptyState } from './ui-ext/EmptyState';

interface DashboardProps {
  data: InventoryData;
}

const STOCK_LOW_THRESHOLD = 10;

interface KpiSpec {
  key: string;
  label: string;
  value: string | number;
  caption?: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'neutral';
  trend?: { delta: number; suffix?: string };
}

const TONE_RING: Record<KpiSpec['tone'], string> = {
  brand: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
const TONE_ACCENT: Record<KpiSpec['tone'], string> = {
  brand: 'border-l-indigo-500',
  success: 'border-l-emerald-500',
  warn: 'border-l-amber-500',
  danger: 'border-l-rose-500',
  info: 'border-l-sky-500',
  neutral: 'border-l-slate-400',
};

function KpiCard({ kpi }: { kpi: KpiSpec }) {
  const Icon = kpi.icon;
  const TrendIcon = kpi.trend
    ? kpi.trend.delta > 0
      ? TrendingUp
      : kpi.trend.delta < 0
        ? TrendingDown
        : Minus
    : null;
  const trendColor = kpi.trend
    ? kpi.trend.delta > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : kpi.trend.delta < 0
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground'
    : '';
  return (
    <Card
      className={cn(
        'border-l-4 transition-all hover:-translate-y-0.5 hover:shadow-md',
        TONE_ACCENT[kpi.tone],
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          {kpi.label}
        </CardTitle>
        <div className={cn('rounded-md p-1.5', TONE_RING[kpi.tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{kpi.value}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {kpi.caption && <span className="text-muted-foreground">{kpi.caption}</span>}
          {kpi.trend && TrendIcon && (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {kpi.trend.delta > 0 ? '+' : ''}
              {kpi.trend.delta}
              {kpi.trend.suffix ?? ''}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard({ data }: DashboardProps) {
  const stats = useMemo(() => {
    const totalProducts = data.products.length;
    const totalValue = data.products.reduce((sum, p) => sum + p.giaTriKho, 0);
    const totalStock = data.products.reduce((sum, p) => sum + p.tonKho, 0);
    const lowStock = data.products.filter((p) => p.tonKho < STOCK_LOW_THRESHOLD);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTxns = data.transactions.filter((t) => {
      const d = new Date(t.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    const todayImports = todayTxns.filter((t) => t.type === 'import').reduce((s, t) => s + t.quantity, 0);
    const todayExports = todayTxns.filter((t) => t.type === 'export').reduce((s, t) => s + t.quantity, 0);
    const todayImportCount = todayTxns.filter((t) => t.type === 'import').length;
    const todayExportCount = todayTxns.filter((t) => t.type === 'export').length;

    return {
      totalProducts,
      totalValue,
      totalStock,
      lowStock,
      todayImports,
      todayExports,
      todayImportCount,
      todayExportCount,
    };
  }, [data]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: value > 1_000_000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value);

  const kpis: KpiSpec[] = [
    {
      key: 'products',
      label: 'Tổng sản phẩm',
      value: stats.totalProducts,
      caption: 'Mã SKU',
      icon: Package,
      tone: 'brand',
    },
    {
      key: 'stock',
      label: 'Tổng tồn kho',
      value: stats.totalStock.toLocaleString('vi-VN'),
      caption: 'Đơn vị',
      icon: Warehouse,
      tone: 'success',
    },
    {
      key: 'value',
      label: 'Giá trị kho',
      value: formatCurrency(stats.totalValue),
      caption: 'Tổng giá vốn',
      icon: Wallet,
      tone: 'info',
    },
    {
      key: 'low',
      label: 'Hàng sắp hết',
      value: stats.lowStock.length,
      caption: `< ${STOCK_LOW_THRESHOLD} đơn vị`,
      icon: AlertTriangle,
      tone: stats.lowStock.length > 0 ? 'danger' : 'neutral',
    },
    {
      key: 'in',
      label: 'Nhập hôm nay',
      value: stats.todayImports,
      caption: `${stats.todayImportCount} phiếu`,
      icon: ArrowDownToLine,
      tone: 'success',
      trend: stats.todayImports > 0 ? { delta: stats.todayImports } : undefined,
    },
    {
      key: 'out',
      label: 'Xuất hôm nay',
      value: stats.todayExports,
      caption: `${stats.todayExportCount} phiếu`,
      icon: ArrowUpFromLine,
      tone: 'warn',
      trend: stats.todayExports > 0 ? { delta: -stats.todayExports } : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Tổng quan kho · cập nhật theo thời gian thực</p>
      </div>

      {/* KPI grid: 2col mobile / 3col tablet / 6col desktop */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiCard key={k.key} kpi={k} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-indigo-600" />
                Nhập / Xuất 14 ngày
              </CardTitle>
              <p className="text-xs text-muted-foreground">Tổng lượng theo ngày</p>
            </div>
          </CardHeader>
          <CardContent>
            {data.transactions.length === 0 ? (
              <EmptyState
                compact
                icon={Activity}
                title="Chưa có giao dịch"
                description="Số liệu sẽ hiển thị sau khi có nhập/xuất kho"
              />
            ) : (
              <InOutChart transactions={data.transactions} days={14} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-4 w-4 text-indigo-600" />
              Cơ cấu giá trị
            </CardTitle>
            <p className="text-xs text-muted-foreground">Theo loại hàng</p>
          </CardHeader>
          <CardContent>
            <CategoryDonut products={data.products} />
          </CardContent>
        </Card>
      </div>

      {/* 2-column section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Low stock list */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Hàng sắp hết</CardTitle>
              <p className="text-xs text-muted-foreground">Dưới ngưỡng {STOCK_LOW_THRESHOLD} đơn vị</p>
            </div>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {stats.lowStock.length}
            </span>
          </CardHeader>
          <CardContent>
            {stats.lowStock.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Không có sản phẩm tồn kho thấp 🎉
              </div>
            ) : (
              <ul className="divide-y">
                {stats.lowStock.slice(0, 6).map((p) => (
                  <li key={p.maSKU} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{p.maSKU}</span>
                        {p.loaiHang && (
                          <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                            {p.loaiHang}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm font-medium">{p.tenSanPham}</div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        p.tonKho === 0
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
                      )}
                    >
                      {p.tonKho} {p.donViTinh}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
            <p className="text-xs text-muted-foreground">{data.transactions.length} giao dịch</p>
          </CardHeader>
          <CardContent>
            {data.transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Chưa có giao dịch</div>
            ) : (
              <ul className="space-y-2.5">
                {data.transactions
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 6)
                  .map((t) => (
                    <li key={t.id} className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                          t.type === 'import'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
                        )}
                      >
                        {t.type === 'import' ? (
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpFromLine className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.tenSanPham}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(t.date).toLocaleString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {t.user}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-sm font-bold',
                          t.type === 'import'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-orange-700 dark:text-orange-400',
                        )}
                      >
                        {t.type === 'import' ? '+' : '-'}
                        {t.quantity}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
