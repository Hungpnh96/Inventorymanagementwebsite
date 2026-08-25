// EPIC-005 — Centralized icon + variant + color rules per action kind.
// Every action button across the app MUST consume an ACTION[kind] entry to enforce
// visual consistency. Adding a new action kind = add a row here (single source of truth).

import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Shield,
  KeyRound,
  LogOut,
  Upload,
  Download,
  Search,
  Save,
  X,
  Copy,
  UserPlus,
  Eye,
  Power,
  type LucideIcon,
} from 'lucide-react';

export type ActionKind =
  | 'add'
  | 'edit'
  | 'delete'
  | 'reset-pw'
  | 'permissions'
  | 'logout-all'
  | 'logout'
  | 'import'
  | 'export'
  | 'refresh'
  | 'search'
  | 'save'
  | 'cancel'
  | 'copy'
  | 'create-user'
  | 'view'
  | 'power';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';

export interface ActionStyle {
  icon: LucideIcon;
  variant: ButtonVariant;
  /** Tailwind class for icon color when needed (default = inherit from button text). */
  iconClass?: string;
  /** Vietnamese label for tooltip + aria-label. Required for a11y. */
  label: string;
}

export const ACTION: Record<ActionKind, ActionStyle> = {
  add:            { icon: Plus,       variant: 'default', label: 'Thêm' },
  edit:           { icon: Pencil,     variant: 'ghost',   label: 'Sửa',                    iconClass: 'text-blue-600' },
  delete:         { icon: Trash2,     variant: 'ghost',   label: 'Xoá',                    iconClass: 'text-red-600' },
  'reset-pw':     { icon: KeyRound,   variant: 'ghost',   label: 'Reset mật khẩu',         iconClass: 'text-amber-600' },
  permissions:    { icon: Shield,     variant: 'ghost',   label: 'Phân quyền',             iconClass: 'text-indigo-600' },
  'logout-all':   { icon: Power,      variant: 'ghost',   label: 'Đăng xuất mọi thiết bị', iconClass: 'text-orange-600' },
  logout:         { icon: LogOut,     variant: 'outline', label: 'Đăng xuất' },
  import:         { icon: Upload,     variant: 'outline', label: 'Import Excel' },
  export:         { icon: Download,   variant: 'default', label: 'Export Excel' },
  refresh:        { icon: RefreshCw,  variant: 'outline', label: 'Tải lại' },
  search:         { icon: Search,     variant: 'ghost',   label: 'Tìm kiếm' },
  save:           { icon: Save,       variant: 'default', label: 'Lưu' },
  cancel:         { icon: X,          variant: 'outline', label: 'Hủy' },
  copy:           { icon: Copy,       variant: 'outline', label: 'Copy' },
  'create-user':  { icon: UserPlus,   variant: 'default', label: 'Thêm user' },
  view:           { icon: Eye,        variant: 'ghost',   label: 'Xem' },
  power:          { icon: Power,      variant: 'ghost',   label: 'Kích hoạt / tạm dừng' },
};
