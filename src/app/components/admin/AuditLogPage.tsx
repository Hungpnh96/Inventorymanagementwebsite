import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { adminQueryAudit, type AuditRow } from '../../utils/api';
import { DataTable, type ColumnDef } from '../ui-ext/DataTable';
import { MultiSelectFilter } from '../ui-ext/MultiSelectFilter';
import { EmptyState } from '../ui-ext/EmptyState';
import { TableSkeleton } from '../ui-ext/Skeletons';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { toast } from 'sonner';
import {
  ScrollText,
  RefreshCw,
  Filter as FilterIcon,
  Eye,
  AlertTriangle,
  KeyRound,
  LogIn,
  LogOut,
  ShieldAlert,
  Trash2,
  Pencil,
  UserPlus,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shield,
  FileSpreadsheet,
  Globe,
} from 'lucide-react';
import { cn } from '../ui/utils';

// ----- Action presentation map -----

interface ActionMeta {
  label: string;
  icon: typeof KeyRound;
  tone: 'emerald' | 'rose' | 'amber' | 'indigo' | 'sky' | 'violet' | 'slate' | 'orange';
}

const ACTION_META: Record<string, ActionMeta> = {
  'login.success': { label: 'Đăng nhập', icon: LogIn, tone: 'emerald' },
  'login.failed': { label: 'Đăng nhập THẤT BẠI', icon: ShieldAlert, tone: 'rose' },
  'login.locked': { label: 'Tài khoản bị khoá', icon: ShieldAlert, tone: 'rose' },
  'logout': { label: 'Đăng xuất', icon: LogOut, tone: 'slate' },
  'password.change': { label: 'Đổi mật khẩu', icon: KeyRound, tone: 'violet' },
  'password.reset': { label: 'Reset mật khẩu', icon: KeyRound, tone: 'violet' },
  'password.reset_request': { label: 'Yêu cầu reset mật khẩu', icon: KeyRound, tone: 'amber' },
  'product.import': { label: 'Import Excel', tone: 'emerald', icon: FileSpreadsheet },
  'product.replace': { label: 'Sửa danh mục', icon: Pencil, tone: 'amber' },
  'product.delete': { label: 'Xoá sản phẩm', icon: Trash2, tone: 'rose' },
  'transaction.create': { label: 'Giao dịch nhập/xuất', icon: ArrowDownToLine, tone: 'indigo' },
  'user.create': { label: 'Tạo user', icon: UserPlus, tone: 'emerald' },
  'user.update': { label: 'Sửa user', icon: Pencil, tone: 'amber' },
  'user.delete': { label: 'Xoá user', icon: Trash2, tone: 'rose' },
  'user.permissions.update': { label: 'Cập nhật quyền', icon: Shield, tone: 'indigo' },
  'user.logout_all': { label: 'Logout toàn bộ thiết bị', icon: LogOut, tone: 'slate' },
};

const fallback: ActionMeta = { label: 'Hành động', icon: ScrollText, tone: 'slate' };

const TONE_STYLE: Record<ActionMeta['tone'], string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
};

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? fallback;
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE_STYLE[meta.tone])}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function tryJson(s: string | null | undefined): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

function JsonPreview({ value }: { value: any }) {
  if (value == null) return <span className="text-muted-foreground text-xs italic">— rỗng —</span>;
  if (typeof value !== 'object') return <span className="text-xs">{String(value)}</span>;
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/70 p-3 text-[11px] leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ----- Page -----

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [actorFilter, setActorFilter] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string[]>([]);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminQueryAudit({
        from: from || undefined,
        to: to ? new Date(new Date(to).setHours(23, 59, 59, 999)).toISOString() : undefined,
        actor: actorFilter || undefined,
        // Note: server takes single action; if multi selected we filter client-side after
        action: actionFilter.length === 1 ? actionFilter[0] : undefined,
        resourceType: resourceTypeFilter.length === 1 ? resourceTypeFilter[0] : undefined,
        limit: 500,
      });
      setRows(res.rows);
      if (res.truncated) {
        toast.message('Đã giới hạn 500 dòng đầu tiên — dùng filter để thu hẹp.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Không tải được audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let arr = rows;
    if (actionFilter.length > 1) arr = arr.filter((r) => actionFilter.includes(r.action));
    if (resourceTypeFilter.length > 1) arr = arr.filter((r) => resourceTypeFilter.includes(r.resourceType));
    return arr;
  }, [rows, actionFilter, resourceTypeFilter]);

  const stats = useMemo(() => {
    const resetReq = rows.filter((r) => r.action === 'password.reset_request').length;
    const loginFail = rows.filter((r) => r.action === 'login.failed' || r.action === 'login.locked').length;
    const dataChange = rows.filter((r) => r.resourceType === 'product' || r.resourceType === 'products' || r.resourceType === 'user' || r.action.startsWith('transaction.')).length;
    return { resetReq, loginFail, dataChange, total: rows.length };
  }, [rows]);

  // Build filter options from loaded data
  const actionOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.action, (map.get(r.action) ?? 0) + 1);
    return Array.from(map.entries()).map(([v, c]) => ({
      value: v,
      label: ACTION_META[v]?.label ?? v,
      count: c,
    }));
  }, [rows]);
  const resourceOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.resourceType, (map.get(r.resourceType) ?? 0) + 1);
    return Array.from(map.entries()).map(([v, c]) => ({ value: v, label: v, count: c }));
  }, [rows]);

  const cols: ColumnDef<AuditRow>[] = [
    {
      id: 'at',
      header: 'Thời gian',
      sortValue: (r) => new Date(r.at).getTime(),
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
          {new Date(r.at).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Hành động',
      sortValue: (r) => r.action,
      cell: (r) => <ActionBadge action={r.action} />,
    },
    {
      id: 'actor',
      header: 'Người thực hiện',
      sortValue: (r) => r.actorUsername,
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{r.actorUsername}</span>
          {r.actorRole && (
            <span className="text-[10px] text-muted-foreground">
              {r.actorRole === 'admin' ? '★ admin' : r.actorRole}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'resource',
      header: 'Đối tượng',
      sortValue: (r) => `${r.resourceType}:${r.resourceId ?? ''}`,
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{r.resourceType}</span>
          {r.resourceId && <span className="font-mono text-xs">{r.resourceId}</span>}
        </div>
      ),
      hideClassName: 'hidden lg:table-cell',
    },
    {
      id: 'ip',
      header: 'IP',
      cell: (r) => (
        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
          {r.ipAddress ?? '—'}
        </span>
      ),
      hideClassName: 'hidden xl:table-cell',
    },
    {
      id: 'view',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
          onClick={() => setDetail(r)}
          aria-label="Xem chi tiết"
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Log</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Chỉ admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Lịch sử mọi thay đổi, đăng nhập và yêu cầu reset password</p>
        </div>
        <Button onClick={load} variant="outline" disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Tải lại
        </Button>
      </div>

      {/* KPI */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Yêu cầu reset</CardTitle>
            <div className="rounded-md bg-amber-50 p-1.5 dark:bg-amber-500/10">
              <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.resetReq}</div>
            <p className="text-xs text-muted-foreground">cần xử lý</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Đăng nhập sai</CardTitle>
            <div className="rounded-md bg-rose-50 p-1.5 dark:bg-rose-500/10">
              <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">{stats.loginFail}</div>
            <p className="text-xs text-muted-foreground">login thất bại / khoá</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Thay đổi dữ liệu</CardTitle>
            <div className="rounded-md bg-indigo-50 p-1.5 dark:bg-indigo-500/10">
              <Pencil className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{stats.dataChange}</div>
            <p className="text-xs text-muted-foreground">products/users/txn</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-400">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tổng dòng</CardTitle>
            <div className="rounded-md bg-slate-100 p-1.5 dark:bg-slate-800">
              <ScrollText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">trong query này</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FilterIcon className="h-4 w-4 text-indigo-600" />
            Bộ lọc
          </CardTitle>
          <CardDescription>Nhập điều kiện và bấm "Áp dụng" để truy vấn lại server</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Từ ngày</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Đến ngày</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">User (username)</Label>
              <Input
                placeholder="VD: admin"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 flex flex-col">
              <Label className="text-xs">&nbsp;</Label>
              <Button onClick={load} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <FilterIcon className="mr-2 h-4 w-4" />
                Áp dụng
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lịch sử</CardTitle>
          <CardDescription>Click icon mắt để xem JSON before/after chi tiết</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<AuditRow>
            data={filtered}
            columns={cols}
            rowKey={(r) => r.id.toString()}
            pageSize={50}
            initialSort={{ id: 'at', dir: 'desc' }}
            loading={loading}
            loadingSkeleton={<TableSkeleton rows={8} cols={6} />}
            toolbar={
              <>
                <MultiSelectFilter
                  label="Hành động"
                  options={actionOptions}
                  selected={actionFilter}
                  onChange={setActionFilter}
                />
                <MultiSelectFilter
                  label="Loại đối tượng"
                  options={resourceOptions}
                  selected={resourceTypeFilter}
                  onChange={setResourceTypeFilter}
                />
                {(actionFilter.length > 0 || resourceTypeFilter.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setActionFilter([]);
                      setResourceTypeFilter([]);
                    }}
                  >
                    Xoá bộ lọc
                  </Button>
                )}
              </>
            }
            empty={
              <EmptyState
                compact
                icon={ScrollText}
                title="Không có audit log"
                description="Không có dòng nào khớp với bộ lọc hiện tại"
              />
            }
            mobileCard={(r) => (
              <button
                onClick={() => setDetail(r)}
                className="w-full text-left rounded-lg border bg-card p-3 shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <ActionBadge action={r.action} />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(r.at).toLocaleString('vi-VN', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{r.actorUsername}</span>
                  {r.actorRole === 'admin' && <span className="text-[10px] text-amber-600">★ admin</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.resourceType} {r.resourceId ? `• ${r.resourceId}` : ''}
                </div>
              </button>
            )}
          />
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          {detail && (
            <>
              <SheetHeader className="border-b p-4 sm:p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONE_STYLE[(ACTION_META[detail.action] ?? fallback).tone])}>
                    {(() => {
                      const Icon = (ACTION_META[detail.action] ?? fallback).icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle>{(ACTION_META[detail.action] ?? fallback).label}</SheetTitle>
                    <SheetDescription className="font-mono text-xs">{detail.action}</SheetDescription>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Thời gian</div>
                    <div className="font-medium">{new Date(detail.at).toLocaleString('vi-VN')}</div>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Người thực hiện</div>
                    <div className="font-mono">{detail.actorUsername}</div>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Đối tượng</div>
                    <div className="font-mono">{detail.resourceType}{detail.resourceId ? ` • ${detail.resourceId}` : ''}</div>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      IP
                    </div>
                    <div className="font-mono">{detail.ipAddress ?? '—'}</div>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Before</h3>
                  <JsonPreview value={tryJson(detail.beforeJson)} />
                </section>
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">After</h3>
                  <JsonPreview value={tryJson(detail.afterJson)} />
                </section>
                {detail.userAgent && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User-Agent</h3>
                    <div className="rounded-md bg-muted/70 p-3 text-[11px] break-all">{detail.userAgent}</div>
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
