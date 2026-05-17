import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { InventoryManagement } from './components/InventoryManagement';
import { TransactionForm } from './components/TransactionForm';
import { ProductSearch } from './components/ProductSearch';
import { Reports } from './components/Reports';
import { User, InventoryData, Transaction, Product } from './types';
import { saveInventoryData, loadInventoryData, saveCurrentUser, loadCurrentUser } from './utils/storage';
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
} from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { cn } from './components/ui/utils';

type Page = 'dashboard' | 'inventory' | 'transaction' | 'search' | 'reports';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [inventoryData, setInventoryData] = useState<InventoryData>({ products: [], transactions: [] });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const user = loadCurrentUser();
    setCurrentUser(user);

    if (user) {
      const data = loadInventoryData();
      setInventoryData(data);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      saveInventoryData(inventoryData);
    }
  }, [inventoryData, currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    saveCurrentUser(user);
    const data = loadInventoryData();
    setInventoryData(data);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveCurrentUser(null);
    setCurrentPage('dashboard');
  };

  const handleProductsUpdate = (products: Product[]) => {
    setInventoryData(prev => ({ ...prev, products }));
  };

  const handleTransaction = (transaction: Transaction, updatedProducts: Product[]) => {
    setInventoryData(prev => ({
      products: updatedProducts,
      transactions: [...prev.transactions, transaction],
    }));
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory' as Page, label: 'Quản lý kho', icon: Package },
    { id: 'transaction' as Page, label: 'Xuất nhập kho', icon: ArrowLeftRight },
    { id: 'search' as Page, label: 'Tìm kiếm', icon: Search },
    { id: 'reports' as Page, label: 'Báo cáo', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold">ERP Quản lý kho</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{currentUser.username}</p>
              <p className="text-xs text-muted-foreground">
                {currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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

        {/* Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {currentPage === 'dashboard' && (
              <Dashboard data={inventoryData} />
            )}
            {currentPage === 'inventory' && (
              <InventoryManagement
                products={inventoryData.products}
                onProductsUpdate={handleProductsUpdate}
                currentUser={currentUser}
              />
            )}
            {currentPage === 'transaction' && (
              <TransactionForm
                products={inventoryData.products}
                onTransaction={handleTransaction}
                currentUser={currentUser}
              />
            )}
            {currentPage === 'search' && (
              <ProductSearch products={inventoryData.products} />
            )}
            {currentPage === 'reports' && (
              <Reports transactions={inventoryData.transactions} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}