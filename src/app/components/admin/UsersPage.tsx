import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  UserPlus,
  Pencil,
  Shield,
  KeyRound,
  LogOut,
  Trash2,
  KeyRound as KeyAlert,
  UserCheck,
  UserX,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  adminListUsers,
  adminDeleteUser,
  adminLogoutAll,
  adminApproveUser,
  adminRejectUser,
  type AdminUser,
} from '../../utils/api';
import type { User } from '../../types';
import { UserFormDialog } from './UserFormDialog';
import { PermissionMatrixDialog } from './PermissionMatrixDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

type Confirm =
  | { kind: 'delete'; user: AdminUser }
  | { kind: 'logoutAll'; user: AdminUser }
  | { kind: 'reject'; user: AdminUser }
  | null;

interface Props {
  currentUser: User;
}

export function UsersPage({ currentUser }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);

  const [formDialog, setFormDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; user?: AdminUser }>({ open: false, mode: 'create' });
  const [permsDialog, setPermsDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [resetDialog, setResetDialog] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  /** id of the pending user currently being approved — keeps its row buttons disabled. */
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminListUsers();
      setUsers(list);
    } catch (e: any) {
      toast.error(e.message || 'Không tải được danh sách user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConfirmAction = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === 'delete') {
        await adminDeleteUser(confirm.user.id);
        toast.success(`Đã xoá user '${confirm.user.username}'`);
      } else if (confirm.kind === 'logoutAll') {
        const count = await adminLogoutAll(confirm.user.id);
        toast.success(`Đã đăng xuất ${count} phiên của '${confirm.user.username}'`);
      } else if (confirm.kind === 'reject') {
        await adminRejectUser(confirm.user.id);
        toast.success(`Đã từ chối đăng ký của '${confirm.user.username}'`);
      }
      setConfirm(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Thao tác thất bại');
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleApprove = async (u: AdminUser) => {
    setApprovingId(u.id);
    try {
      await adminApproveUser(u.id);
      toast.success(`Đã duyệt '${u.username}', vào Phân quyền để cấp quyền truy cập`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Duyệt tài khoản thất bại');
    } finally {
      setApprovingId(null);
    }
  };

  // Pending self-registrations get their own section so they don't sit in the main table
  // looking broken (no permissions yet). Rejected users stay in the main list for visibility.
  const pendingUsers = users.filter((u) => u.status === 'pending');
  const listedUsers = users.filter((u) => u.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Quản trị users</h2>
          <p className="text-muted-foreground">Tạo, xoá, phân quyền và quản lý phiên đăng nhập</p>
        </div>
        <Button
          onClick={() => setFormDialog({ open: true, mode: 'create' })}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Thêm user
        </Button>
      </div>

      {pendingUsers.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Chờ duyệt
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">{pendingUsers.length}</Badge>
            </CardTitle>
            <CardDescription>
              Tài khoản do người dùng tự đăng ký. Duyệt xong hãy vào Phân quyền để cấp quyền truy cập.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold">{u.username}</div>
                  <div className="truncate text-sm text-slate-700">{u.fullName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Đăng ký lúc {new Date(u.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(u)}
                    disabled={approvingId === u.id}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <UserCheck className="mr-1.5 h-4 w-4" />
                    {approvingId === u.id ? 'Đang duyệt...' : 'Duyệt'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirm({ kind: 'reject', user: u })}
                    disabled={approvingId === u.id}
                  >
                    <UserX className="mr-1.5 h-4 w-4" />
                    Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách user ({listedUsers.length})</CardTitle>
          <CardDescription>
            Số phiên đang hoạt động cập nhật theo Redis. Hành động ghi vào audit log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="rounded-md border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                Đang tải...
              </div>
            ) : listedUsers.length === 0 ? (
              <div className="rounded-md border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                Chưa có user nào ngoài admin gốc. Click "Thêm user" để tạo.
              </div>
            ) : (
              listedUsers.map((u) => (
                <div key={u.id} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{u.username}</span>
                        {u.mustChangePassword && (
                          <KeyAlert className="h-3.5 w-3.5 text-amber-600" aria-label="Cần đổi mật khẩu" />
                        )}
                        <span
                          className={
                            u.role === 'admin'
                              ? 'inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700'
                              : 'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700'
                          }
                        >
                          {u.role === 'admin' ? '★ Admin' : 'Nhân viên'}
                        </span>
                        {u.status === 'rejected' && (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Đã từ chối
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700 truncate">{u.fullName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {u.activeSessions} phiên • {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <IconButton label="Sửa" tone="amber" onClick={() => setFormDialog({ open: true, mode: 'edit', user: u })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Phân quyền" tone="indigo" onClick={() => setPermsDialog({ open: true, user: u })}>
                      <Shield className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Reset" tone="violet" onClick={() => setResetDialog({ open: true, user: u })}>
                      <KeyRound className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Logout all" tone="slate" onClick={() => setConfirm({ kind: 'logoutAll', user: u })}>
                      <LogOut className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Xoá" tone="rose" onClick={() => setConfirm({ kind: 'delete', user: u })}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Username</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tên đầy đủ</TableHead>
                  <TableHead className="font-semibold text-slate-700">Vai trò</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Phiên</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tạo lúc</TableHead>
                  <TableHead className="text-right w-[220px] font-semibold text-slate-700">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : listedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Chưa có user nào ngoài admin gốc. Click "Thêm user" để tạo.
                    </TableCell>
                  </TableRow>
                ) : (
                  listedUsers.map((u) => (
                    <TableRow key={u.id} className="hover:bg-indigo-50/40 transition-colors">
                      <TableCell className="font-mono">
                        <span className="inline-flex items-center gap-2">
                          {u.username}
                          {u.mustChangePassword && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <KeyAlert className="h-3.5 w-3.5 text-amber-600" aria-label="Cần đổi mật khẩu" />
                                </TooltipTrigger>
                                <TooltipContent>Cần đổi mật khẩu lần đăng nhập tới</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{u.fullName}</TableCell>
                      <TableCell>
                        <span
                          className={
                            u.role === 'admin'
                              ? 'inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700'
                              : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700'
                          }
                        >
                          {u.role === 'admin' ? '★ Admin' : 'Nhân viên'}
                        </span>
                        {u.status === 'rejected' && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                            Đã từ chối
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{u.activeSessions}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Sửa" tone="amber" onClick={() => setFormDialog({ open: true, mode: 'edit', user: u })}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Phân quyền" tone="indigo" onClick={() => setPermsDialog({ open: true, user: u })}>
                            <Shield className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Reset mật khẩu" tone="violet" onClick={() => setResetDialog({ open: true, user: u })}>
                            <KeyRound className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Đăng xuất khỏi mọi thiết bị" tone="slate" onClick={() => setConfirm({ kind: 'logoutAll', user: u })}>
                            <LogOut className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="Xoá user"
                            tone="rose"
                            onClick={() => setConfirm({ kind: 'delete', user: u })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserFormDialog
        open={formDialog.open}
        mode={formDialog.mode}
        user={formDialog.user}
        onClose={() => setFormDialog({ ...formDialog, open: false })}
        onSuccess={() => {
          setFormDialog({ ...formDialog, open: false });
          refresh();
        }}
      />
      <PermissionMatrixDialog
        open={permsDialog.open}
        user={permsDialog.user}
        onClose={() => setPermsDialog({ open: false, user: null })}
        onSuccess={() => {
          setPermsDialog({ open: false, user: null });
          refresh();
        }}
      />
      <ResetPasswordDialog
        open={resetDialog.open}
        user={resetDialog.user}
        onClose={() => setResetDialog({ open: false, user: null })}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && !confirmBusy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'delete'
                ? `Xoá user '${confirm.user.username}'?`
                : confirm?.kind === 'logoutAll'
                ? `Đăng xuất '${confirm.user.username}' khỏi mọi thiết bị?`
                : confirm?.kind === 'reject'
                ? `Từ chối đăng ký của '${confirm.user.username}'?`
                : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete' &&
                'Tài khoản sẽ bị soft-delete (giữ lại audit log). User sẽ không thể đăng nhập. Hành động có thể khôi phục qua SQL trong v1.'}
              {confirm?.kind === 'logoutAll' &&
                'Tất cả phiên Redis hiện tại của user sẽ bị thu hồi. User cần đăng nhập lại để tiếp tục.'}
              {confirm?.kind === 'reject' &&
                'Tài khoản sẽ chuyển sang trạng thái "Đã từ chối" và không thể đăng nhập. Người dùng phải đăng ký lại nếu muốn tiếp tục.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={confirmBusy}
              className={
                confirm?.kind === 'delete' || confirm?.kind === 'reject'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : undefined
              }
            >
              {confirmBusy ? 'Đang xử lý...' : 'Xác nhận'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Tone = 'amber' | 'indigo' | 'violet' | 'slate' | 'rose' | 'emerald' | 'blue';
const TONE_CLASS: Record<Tone, string> = {
  amber: 'text-amber-600 hover:bg-amber-50 hover:text-amber-700',
  indigo: 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700',
  violet: 'text-violet-600 hover:bg-violet-50 hover:text-violet-700',
  slate: 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
  rose: 'text-rose-600 hover:bg-rose-50 hover:text-rose-700',
  emerald: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
  blue: 'text-blue-600 hover:bg-blue-50 hover:text-blue-700',
};

function IconButton({
  children,
  onClick,
  label,
  tone = 'slate',
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  tone?: Tone;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            aria-label={label}
            className={TONE_CLASS[tone]}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
