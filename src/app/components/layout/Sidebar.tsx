import { type ComponentType } from 'react';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  Truck,
  Users,
  UserCog,
  Shield,
  ScrollText,
  DatabaseBackup,
  BarChart3,
  Settings,
  Search,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { User } from '../../types';

export type NavId =
  | 'dashboard'
  | 'inventory'
  | 'transaction'
  | 'audit-stock'
  | 'suppliers'
  | 'customers'
  | 'search'
  | 'reports'
  | 'admin-users'
  | 'admin-roles'
  | 'admin-audit'
  | 'admin-data'
  | 'settings';

export interface NavItem {
  id: NavId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group?: string;
  adminOnly?: boolean;
  badge?: number;
  comingSoon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Tồn kho', icon: Warehouse },
  { id: 'transaction', label: 'Xuất nhập kho', icon: ArrowDownToLine },
  { id: 'search', label: 'Tìm kiếm', icon: Search },
  { id: 'audit-stock', label: 'Kiểm kê', icon: ClipboardCheck, comingSoon: true },
  { id: 'suppliers', label: 'Nhà cung cấp', icon: Truck, group: 'data', comingSoon: true },
  { id: 'customers', label: 'Khách hàng', icon: Users, group: 'data', comingSoon: true },
  { id: 'admin-users', label: 'Nhân sự', icon: UserCog, group: 'admin', adminOnly: true },
  { id: 'admin-roles', label: 'Phân quyền', icon: Shield, group: 'admin', adminOnly: true, comingSoon: true },
  { id: 'admin-audit', label: 'Audit log', icon: ScrollText, group: 'admin', adminOnly: true },
  { id: 'admin-data', label: 'Quản trị dữ liệu', icon: DatabaseBackup, group: 'admin', adminOnly: true },
  { id: 'reports', label: 'Báo cáo', icon: BarChart3, group: 'insight' },
  { id: 'settings', label: 'Cài đặt', icon: Settings, group: 'insight' },
];

// Make SOON items navigable (they render ComingSoon preview pages, not disabled).
// We keep the SOON badge to signal status but allow click.

interface SidebarProps {
  collapsed: boolean;
  currentUser: User;
  currentPage: NavId;
  onNavigate: (id: NavId) => void;
}

const GROUP_LABEL: Record<string, string> = {
  data: 'Dữ liệu',
  admin: 'Quản trị',
  insight: 'Báo cáo & Cài đặt',
};

export function Sidebar({ collapsed, currentUser, currentPage, onNavigate }: SidebarProps) {
  const visible = NAV_ITEMS.filter((it) => !it.adminOnly || currentUser.role === 'admin');

  // Group items in render order
  const groups: { key: string | undefined; items: NavItem[] }[] = [];
  for (const it of visible) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === it.group) lastGroup.items.push(it);
    else groups.push({ key: it.group, items: [it] });
  }

  return (
    <nav
      className={cn(
        'flex h-full flex-col overflow-y-auto bg-sidebar text-sidebar-foreground',
        collapsed ? 'px-2 py-4' : 'px-3 py-4',
      )}
      aria-label="Sidebar"
    >
      <TooltipProvider delayDuration={200}>
        {groups.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-4')}>
            {g.key && !collapsed && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {GROUP_LABEL[g.key] || g.key}
              </div>
            )}
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.id;
              const button = (
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active &&
                      'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
                    !active && 'text-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-indigo-600 dark:bg-indigo-400" />
                  )}
                  <Icon className={cn('h-4 w-4 shrink-0', active && 'text-indigo-600 dark:text-indigo-400')} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.comingSoon && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          SOON
                        </span>
                      )}
                      {item.badge != null && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
              if (collapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                      {item.comingSoon && ' (sắp ra)'}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={item.id}>{button}</div>;
            })}
          </div>
        ))}
      </TooltipProvider>
    </nav>
  );
}
