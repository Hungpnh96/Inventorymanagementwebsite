import { useState, ReactNode } from 'react';
import { Sidebar, NavId } from './Sidebar';
import { Header } from './Header';
import { GlobalSearch } from './GlobalSearch';
import { KeyboardShortcutsProvider } from './KeyboardShortcuts';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { User, Product } from '../../types';
import { Package, LayoutDashboard, Warehouse, ArrowLeftRight, Search, BarChart3 } from 'lucide-react';
import { cn } from '../ui/utils';

interface AppShellProps {
  currentUser: User;
  currentPage: NavId;
  products: Product[];
  onNavigate: (id: NavId) => void;
  onChangePassword: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const COLLAPSE_KEY = 'sidebar_collapsed';

export function AppShell({
  currentUser,
  currentPage,
  products,
  onNavigate,
  onChangePassword,
  onLogout,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((v) => {
      const nv = !v;
      localStorage.setItem(COLLAPSE_KEY, nv ? '1' : '0');
      return nv;
    });
  };

  const handleNavigate = (id: NavId) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const bottomNavItems: { id: NavId; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Kho', icon: Warehouse },
    { id: 'transaction', label: 'Nhập/Xuất', icon: ArrowLeftRight },
    { id: 'search', label: 'Tìm', icon: Search },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      {/* Desktop sidebar — fixed to viewport, never scrolls with content */}
      <aside
        className={cn(
          'hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r bg-sidebar transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className={cn('flex h-14 items-center shrink-0 border-b px-3', collapsed && 'justify-center px-0')}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
              <Package className="w-4 h-4 text-white" />
            </div>
            {!collapsed && <span className="font-bold tracking-tight truncate">ERP Quản lý kho</span>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar
            collapsed={collapsed}
            currentUser={currentUser}
            currentPage={currentPage}
            onNavigate={handleNavigate}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2 text-left">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Package className="w-4 h-4 text-white" />
              </div>
              ERP Quản lý kho
            </SheetTitle>
          </SheetHeader>
          <Sidebar
            collapsed={false}
            currentUser={currentUser}
            currentPage={currentPage}
            onNavigate={handleNavigate}
          />
        </SheetContent>
      </Sheet>

      {/* Main column — offset by sidebar width on lg+ */}
      <div className={cn('flex min-h-screen min-w-0 flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <Header
          currentUser={currentUser}
          currentPage={currentPage}
          sidebarCollapsed={collapsed}
          onToggleMobile={() => setMobileOpen(true)}
          onToggleCollapse={toggleCollapse}
          onOpenSearch={() => setSearchOpen(true)}
          onChangePassword={onChangePassword}
          onLogout={onLogout}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile bottom-nav — app-like UX */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-5 gap-0.5 px-1 py-1.5">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 transition-colors',
                  active
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'text-muted-foreground hover:bg-accent',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'text-indigo-600 dark:text-indigo-400')} />
                <span className="text-[10px] leading-tight font-medium truncate max-w-full px-1">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        products={products}
        onNavigate={(p) => {
          onNavigate(p);
          setSearchOpen(false);
        }}
      />

      <KeyboardShortcutsProvider onNavigate={onNavigate} onOpenSearch={() => setSearchOpen(true)} />
    </div>
  );
}
