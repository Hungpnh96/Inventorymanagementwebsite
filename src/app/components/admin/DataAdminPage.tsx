import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  adminClearData,
  adminDownloadBackup,
  adminListBackups,
  adminRestoreBackup,
  type BackupInfo,
} from '../../utils/api';
import { DataTable, type ColumnDef } from '../ui-ext/DataTable';
import { EmptyState } from '../ui-ext/EmptyState';
import { TableSkeleton } from '../ui-ext/Skeletons';
import { useConfirm } from '../ui-ext/ConfirmDialog';
import { toast } from 'sonner';
import {
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  History,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { cn } from '../ui/utils';

const CONFIRM_WORD = 'XOA';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  /** Reload inventory in the parent after a destructive operation. */
  onRefresh?: () => void;
}

export function DataAdminPage({ onRefresh }: Props) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = async () => {
    setLoading(true);
    try {
      setBackups(await adminListBackups());
    } catch (e: any) {
      toast.error(e.message || 'Không tải được danh sách bản sao lưu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = async () => {
    const ok = await confirm({
      title: 'Xoá toàn bộ dữ liệu tạm?',
      description: (
        <>
          Hệ thống sẽ xoá <strong>Sản phẩm</strong> và <strong>Giao dịch</strong>. Tài khoản người dùng
          và nhật ký audit được giữ nguyên. Một bản sao lưu Excel sẽ được tạo tự động trước khi xoá.
        </>
      ),
      confirmText: 'Xác nhận xoá',
      variant: 'danger',
      requireTyping: CONFIRM_WORD,
    });
    if (!ok) return;

    setClearing(true);
    try {
      const res = await adminClearData(CONFIRM_WORD);
      toast.success(`Đã xoá dữ liệu. Bản sao lưu: ${res.backupFile}`);
      onRefresh?.();
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Xoá dữ liệu thất bại');
    } finally {
      setClearing(false);
    }
  };

  const handleDownload = async (fileName: string) => {
    setBusyFile(fileName);
    try {
      await adminDownloadBackup(fileName);
    } catch (e: any) {
      toast.error(e.message || 'Không tải được file sao lưu');
    } finally {
      setBusyFile(null);
    }
  };

  const handleRestore = async (fileName: string) => {
    const ok = await confirm({
      title: 'Khôi phục từ bản sao lưu?',
      description: (
        <>
          Dữ liệu hiện tại sẽ bị <strong>ghi đè</strong> bằng nội dung của{' '}
          <code className="font-mono">{fileName}</code>. Hệ thống tự tạo một bản sao lưu an toàn của
          dữ liệu hiện tại trước khi khôi phục.
        </>
      ),
      confirmText: 'Khôi phục',
      variant: 'warning',
    });
    if (!ok) return;

    setBusyFile(fileName);
    try {
      const res = await adminRestoreBackup(fileName);
      toast.success(
        `Đã khôi phục từ ${res.restoredFrom}. Bản sao lưu an toàn: ${res.safetyBackup}`,
      );
      onRefresh?.();
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Khôi phục thất bại');
    } finally {
      setBusyFile(null);
    }
  };

  const cols: ColumnDef<BackupInfo>[] = [
    {
      id: 'fileName',
      header: 'Tên file',
      sortValue: (r) => r.fileName,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-xs break-all">{r.fileName}</span>
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: 'Thời gian tạo',
      sortValue: (r) => new Date(r.createdAt).getTime(),
      cell: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
          {formatDate(r.createdAt)}
        </span>
      ),
    },
    {
      id: 'sizeBytes',
      header: 'Dung lượng',
      sortValue: (r) => r.sizeBytes,
      cell: (r) => <span className="text-xs tabular-nums">{formatSize(r.sizeBytes)}</span>,
      hideClassName: 'hidden sm:table-cell',
    },
    {
      id: 'actions',
      header: 'Hành động',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={busyFile === r.fileName}
            onClick={() => handleDownload(r.fileName)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Tải xuống
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
            disabled={busyFile === r.fileName}
            onClick={() => handleRestore(r.fileName)}
          >
            <History className="mr-1.5 h-3.5 w-3.5" />
            Khôi phục
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Quản trị dữ liệu</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Chỉ admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Xoá dữ liệu chạy thử trước khi bàn giao cho khách hàng, và khôi phục lại từ bản sao lưu khi cần
          </p>
        </div>
        <Button onClick={load} variant="outline" disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Tải lại
        </Button>
      </div>

      {/* Clear data */}
      <Card className="border-l-4 border-l-rose-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            Xoá dữ liệu tạm
          </CardTitle>
          <CardDescription>
            Xoá toàn bộ <strong>Sản phẩm</strong> và <strong>Giao dịch</strong> hiện có. KHÔNG xoá tài
            khoản người dùng hay nhật ký audit. Hệ thống tự tạo một bản sao lưu Excel trước khi xoá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Hành động không thể hoàn tác trực tiếp — chỉ khôi phục được qua bản sao lưu bên dưới.
            </p>
            <Button
              variant="destructive"
              disabled={clearing}
              onClick={handleClear}
              className="shrink-0"
            >
              <Trash2 className={cn('mr-2 h-4 w-4', clearing && 'animate-pulse')} />
              {clearing ? 'Đang xoá...' : 'Xoá dữ liệu'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Bản sao lưu (tối đa 3 bản gần nhất)
          </CardTitle>
          <CardDescription>
            Tải file Excel về máy, hoặc khôi phục dữ liệu hệ thống về trạng thái của bản sao lưu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<BackupInfo>
            data={backups}
            columns={cols}
            rowKey={(r) => r.fileName}
            pageSize={10}
            initialSort={{ id: 'createdAt', dir: 'desc' }}
            loading={loading}
            loadingSkeleton={<TableSkeleton rows={3} cols={4} />}
            empty={
              <EmptyState
                compact
                icon={DatabaseBackup}
                title="Chưa có bản sao lưu nào"
                description="Bản sao lưu được tạo tự động mỗi khi xoá hoặc khôi phục dữ liệu"
              />
            }
            mobileCard={(r) => (
              <div className="rounded-lg border bg-card p-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-mono text-xs break-all">{r.fileName}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{formatDate(r.createdAt)}</span>
                  <span>{formatSize(r.sizeBytes)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1"
                    disabled={busyFile === r.fileName}
                    onClick={() => handleDownload(r.fileName)}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Tải xuống
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300"
                    disabled={busyFile === r.fileName}
                    onClick={() => handleRestore(r.fileName)}
                  >
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    Khôi phục
                  </Button>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {dialog}
    </div>
  );
}
