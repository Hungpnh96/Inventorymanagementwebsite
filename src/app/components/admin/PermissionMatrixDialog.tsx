import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { adminGetPermissions, adminUpdatePermissions, type AdminUser, type PermissionMatrix } from '../../utils/api';
import { ACTIONS, MENUS, type ActionName, type MenuName } from '../../utils/permissions';

const MENU_LABEL: Record<MenuName, string> = {
  dashboard: 'Dashboard',
  inventory: 'Quản lý kho',
  transactions: 'Xuất nhập kho',
  reports: 'Báo cáo',
  users: 'Quản trị users',
};
const ACTION_LABEL: Record<ActionName, string> = {
  view: 'Xem',
  create: 'Thêm',
  update: 'Sửa',
  delete: 'Xoá',
};

interface Props {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

function blankMatrix(): PermissionMatrix {
  const m: PermissionMatrix = {};
  for (const menu of MENUS) {
    m[menu] = {};
    for (const action of ACTIONS) m[menu][action] = false;
  }
  return m;
}

function matrixEqual(a: PermissionMatrix, b: PermissionMatrix): boolean {
  for (const menu of MENUS) {
    for (const action of ACTIONS) {
      if ((a[menu]?.[action] ?? false) !== (b[menu]?.[action] ?? false)) return false;
    }
  }
  return true;
}

export function PermissionMatrixDialog({ open, user, onClose, onSuccess }: Props) {
  const [original, setOriginal] = useState<PermissionMatrix>(blankMatrix());
  const [draft, setDraft] = useState<PermissionMatrix>(blankMatrix());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    adminGetPermissions(user.id)
      .then((m) => {
        // Server returns server-shaped matrix; fill any missing entries with false.
        const filled = blankMatrix();
        for (const menu of MENUS) {
          for (const action of ACTIONS) {
            filled[menu][action] = m[menu]?.[action] ?? false;
          }
        }
        setOriginal(filled);
        setDraft(JSON.parse(JSON.stringify(filled)));
      })
      .catch((e: any) => toast.error(e.message || 'Không tải được quyền hiện tại'))
      .finally(() => setLoading(false));
  }, [open, user]);

  const toggle = (menu: MenuName, action: ActionName) => {
    setDraft((d) => ({ ...d, [menu]: { ...d[menu], [action]: !d[menu][action] } }));
  };

  const toggleRow = (menu: MenuName) => {
    setDraft((d) => {
      const allOn = ACTIONS.every((a) => d[menu][a]);
      const newRow: Record<string, boolean> = {};
      for (const a of ACTIONS) newRow[a] = !allOn;
      return { ...d, [menu]: newRow };
    });
  };

  const dirty = !matrixEqual(original, draft);

  const handleSave = async () => {
    if (!user || !dirty) return;
    setSaving(true);
    try {
      await adminUpdatePermissions(user.id, draft);
      toast.success('Đã cập nhật quyền');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Không thể lưu quyền');
    } finally {
      setSaving(false);
    }
  };

  // EPIC-004-AC20 — admin already has full permissions via server short-circuit.
  // Show read-only "all enabled" view instead of allowing edit (per Open Q #3 recommendation).
  const isAdminTarget = user?.role === 'admin';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
            </span>
            Phân quyền: <span className="font-mono text-indigo-700">{user?.username ?? ''}</span>
          </DialogTitle>
          <DialogDescription>
            {isAdminTarget
              ? 'Admin có toàn quyền mặc định. Không thể chỉnh sửa quyền cho admin.'
              : 'Chọn các thao tác mà user này được phép thực hiện trên từng menu.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Đang tải...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b">
                  <th className="p-2 text-left font-semibold text-slate-700">Menu</th>
                  {ACTIONS.map((a) => (
                    <th key={a} className="p-2 text-center font-semibold text-slate-700">
                      {ACTION_LABEL[a]}
                    </th>
                  ))}
                  <th className="p-2 text-right font-semibold text-slate-700">Tất cả</th>
                </tr>
              </thead>
              <tbody>
                {MENUS.map((menu) => (
                  <tr key={menu} className="border-b hover:bg-indigo-50/40 transition-colors">
                    <td className="p-2 font-medium">{MENU_LABEL[menu]}</td>
                    {ACTIONS.map((action) => (
                      <td key={action} className="p-2 text-center">
                        <Checkbox
                          id={`perm-${menu}-${action}`}
                          checked={isAdminTarget ? true : draft[menu][action]}
                          disabled={isAdminTarget || saving}
                          onCheckedChange={() => toggle(menu, action)}
                          aria-label={`${MENU_LABEL[menu]} - ${ACTION_LABEL[action]}`}
                        />
                      </td>
                    ))}
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRow(menu)}
                        disabled={isAdminTarget || saving}
                      >
                        Tất cả
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving || isAdminTarget}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? 'Đang lưu...' : 'Lưu phân quyền'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
