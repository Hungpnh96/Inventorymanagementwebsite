import { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { InventoryManagement } from './components/InventoryManagement';
import { TransactionForm } from './components/TransactionForm';
import { ProductSearch } from './components/ProductSearch';
import { Reports } from './components/Reports';
import { ChangePasswordDialog } from './components/ChangePasswordDialog';
import { UsersPage } from './components/admin/UsersPage';
import { User, InventoryData, Transaction, Product } from './types';
import { saveToken, loadToken } from './utils/storage';
import { fetchInventory, fetchMe, logout as apiLogout, LoginResult } from './utils/api';
import { Button } from './components/ui/button';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Search,
  BarChart3,
  LogOut,
  Menu,
  X,
  KeyRound,
  Users as UsersIcon,
} from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { notify } from './design';
import { cn } from './components/ui/utils';

type Page = 'dashboard' | 'inventory' | 'transaction' | 'search' | 'reports' | 'admin-users';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [inventoryData, setInventoryData] = useState<InventoryData>({ products: [], transactions: [] });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInventory();
      setInventoryData(data);
    } catch (e: any) {
      if (e.message === 'UNAUTHORIZED') {
        saveToken(null);
        setCurrentUser(null);
      } else {
        notify.error(`Không tải được dữ liệu: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = loadToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        if (me) {
          setCurrentUser(me.user);
          setMustChangePassword(me.mustChangePassword);
          if (me.mustChangePassword) setShowChangePassword(true);
          await refresh();
        } else {
          saveToken(null);
        }
      } catch {
        saveToken(null);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [refresh]);

  const handleLogin = (result: LoginResult) => {
    saveToken(result.token);
    setCurrentUser(result.user);
    setMustChangePassword(result.mustChangePassword);
    if (result.mustChangePassword) {
      setShowChangePassword(true);
      notify.warn('Cần đổi mật khẩu trước khi dùng');
    }
    refresh();
  };

  const handleLogout = async () => {
    // Call server first to invalidate the Redis session, then clear local state.
    // apiLogout swallows network errors so we always clear the client side.
    await apiLogout();
    saveToken(null);
    setCurrentUser(null);
    setCurrentPage('dashboard');
    setInventoryData({ products: [], transactions: [] });
    setMustChangePassword(false);
    setShowChangePassword(false);
  };

  const handleProductsUpdate = (products: Product[]) => {
    setInventoryData((prev) => ({ ...prev, products }));
  };

  const handleTransaction = (
    _transaction: Transaction,
    updatedProducts: Product[],
    serverData?: InventoryData,
  ) => {
    if (serverData) setInventoryData(serverData);
    else setInventoryData((prev) => ({ products: updatedProducts, transactions: prev.transactions }));
  };

  if (bootstrapping) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Đang khởi tạo...</div>;
  }

  if (!currentUser) {
    return (
      <>
        <Toaster position="top-right" richColors closeButton expand={false} duration={4000} />
        <LoginPage onLogin={handleLogin} />
      </>
    );
  }

  const navItems: { id: Page; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Quản lý kho', icon: Package },
    { id: 'transaction', label: 'Xuất nhập kho', icon: ArrowLeftRight },
    { id: 'search', label: 'Tìm kiếm', icon: Search },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
    { id: 'admin-users', label: 'Quản trị users', icon: UsersIcon, adminOnly: true },
  ].filter((item) => !item.adminOnly || currentUser.role === 'admin');

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" richColors closeButton expand={false} duration={4000} />
      <ChangePasswordDialog
        open={showChangePassword}
        forced={mustChangePassword}
        onSuccess={() => {
          setMustChangePassword(false);
          setShowChangePassword(false);
        }}
        onClose={() => setShowChangePassword(false)}
      />

      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-lg shrink-0">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <h1 className="text-base sm:text-xl font-bold truncate">
                <span className="sm:hidden">ERP Kho</span>
                <span className="hidden sm:inline">ERP Quản lý kho</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{currentUser.username}</p>
              <p className="text-xs text-muted-foreground">
                {currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="sm:hidden h-9 w-9" onClick={() => setShowChangePassword(true)} aria-label="Đổi mật khẩu">
              <KeyRound className="h-4 w-4 text-violet-600" />
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setShowChangePassword(true)}>
              <KeyRound className="h-4 w-4 mr-2 text-violet-600" />
              Đổi mật khẩu
            </Button>
            <Button variant="outline" size="icon" className="sm:hidden h-9 w-9" onClick={handleLogout} aria-label="Đăng xuất">
              <LogOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out',
            'lg:translate-x-0 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:flex-shrink-0 lg:self-start lg:overflow-y-auto',
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          style={{ top: '57px' }}
        >
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentPage === item.id ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => {
                    setCurrentPage(item.id);
                    setIsSidebarOpen(false);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </aside>

        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-20 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            {loading && (
              <div className="mb-4 rounded-md border bg-white px-3 py-2 text-sm text-muted-foreground">
                Đang tải dữ liệu từ server...
              </div>
            )}
            {currentPage === 'dashboard' && <Dashboard data={inventoryData} />}
            {currentPage === 'inventory' && (
              <InventoryManagement
                products={inventoryData.products}
                onProductsUpdate={handleProductsUpdate}
                onRefresh={refresh}
                currentUser={currentUser}
              />
            )}
            {currentPage === 'transaction' && (
              <TransactionForm
                products={inventoryData.products}
                onTransaction={handleTransaction}
                onRefresh={refresh}
                currentUser={currentUser}
              />
            )}
            {currentPage === 'search' && <ProductSearch products={inventoryData.products} />}
            {currentPage === 'reports' && <Reports transactions={inventoryData.transactions} />}
            {currentPage === 'admin-users' && currentUser.role === 'admin' && (
              <UsersPage currentUser={currentUser} />
            )}
            {currentPage === 'admin-users' && currentUser.role !== 'admin' && (
              <div className="text-center py-12 text-muted-foreground">
                Không có quyền truy cập trang này.
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom-nav — app-like UX on phones. Hidden on lg+. */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-5 gap-0.5 px-1 py-1.5">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 transition-colors',
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'text-indigo-600')} />
                <span className="text-[10px] leading-tight font-medium truncate max-w-full px-1">
                  {item.label.replace('Quản trị ', '').replace('Quản lý ', '')}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
