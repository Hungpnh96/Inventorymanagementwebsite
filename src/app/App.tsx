import { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { InventoryManagement } from './components/InventoryManagement';
import { TransactionForm } from './components/TransactionForm';
import { ProductSearch } from './components/ProductSearch';
import { Reports } from './components/Reports';
import { ChangePasswordDialog } from './components/ChangePasswordDialog';
import { UsersPage } from './components/admin/UsersPage';
import { AppShell } from './components/layout/AppShell';
import { NavId } from './components/layout/Sidebar';
import {
  SuppliersStub,
  CustomersStub,
  RolesStub,
  InventoryCheckStub,
} from './components/stubs/ComingSoon';
import { AuditLogPage } from './components/admin/AuditLogPage';
import { DataAdminPage } from './components/admin/DataAdminPage';
import { SettingsPage } from './components/admin/SettingsPage';
import { PermissionDenied } from './components/ui-ext/PermissionDenied';
import { FAB } from './components/ui-ext/FAB';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Plus } from 'lucide-react';
import { ThemeProvider } from './design/ThemeProvider';
import { STOCK_LOW_THRESHOLD } from './design/status-colors';
import { User, InventoryData, Transaction, Product } from './types';
import { saveToken, loadToken } from './utils/storage';
import {
  fetchInventory,
  fetchMe,
  getGeneralSettings,
  logout as apiLogout,
  LoginResult,
  type GeneralSettings,
} from './utils/api';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AppInner() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<NavId>('dashboard');
  const [inventoryData, setInventoryData] = useState<InventoryData>({ products: [], transactions: [] });
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  // Seeded with the static default so every screen has a sane threshold before the
  // server value arrives — the fetch below never blocks the inventory load.
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    language: 'vi',
    lowStockThreshold: STOCK_LOW_THRESHOLD,
  });

  /** Fire-and-forget: readable by any logged-in user, and a failure just keeps the default. */
  const refreshGeneralSettings = useCallback(() => {
    getGeneralSettings()
      .then(setGeneralSettings)
      .catch(() => {
        /* keep the fallback threshold — this setting is not worth a toast */
      });
  }, []);

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
        toast.error(`Không tải được dữ liệu: ${e.message}`);
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
          refreshGeneralSettings(); // in parallel with the inventory load, not before it
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
  }, [refresh, refreshGeneralSettings]);

  const handleLogin = (result: LoginResult) => {
    saveToken(result.token);
    setCurrentUser(result.user);
    setMustChangePassword(result.mustChangePassword);
    if (result.mustChangePassword) {
      setShowChangePassword(true);
      toast.message('Cần đổi mật khẩu trước khi dùng');
    }
    refreshGeneralSettings();
    refresh();
  };

  const handleLogout = async () => {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Đang khởi tạo...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <Toaster position="top-right" richColors closeButton expand={false} duration={4000} />
        <LoginPage onLogin={handleLogin} />
      </>
    );
  }

  return (
    <AppShell
      currentUser={currentUser}
      currentPage={currentPage}
      products={inventoryData.products}
      onNavigate={setCurrentPage}
      onChangePassword={() => setShowChangePassword(true)}
      onLogout={handleLogout}
    >
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

      {loading && (
        <div className="mb-4 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
          Đang tải dữ liệu từ server...
        </div>
      )}

      {currentPage === 'dashboard' && (
        <Dashboard data={inventoryData} lowStockThreshold={generalSettings.lowStockThreshold} />
      )}
      {currentPage === 'inventory' && (
        <InventoryManagement
          products={inventoryData.products}
          onProductsUpdate={handleProductsUpdate}
          onRefresh={refresh}
          currentUser={currentUser}
          lowStockThreshold={generalSettings.lowStockThreshold}
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
        <PermissionDenied menu="admin-users" />
      )}
      {currentPage === 'suppliers' && <SuppliersStub />}
      {currentPage === 'customers' && <CustomersStub />}
      {currentPage === 'audit-stock' && <InventoryCheckStub />}
      {currentPage === 'admin-roles' && currentUser.role === 'admin' && <RolesStub />}
      {currentPage === 'admin-roles' && currentUser.role !== 'admin' && (
        <PermissionDenied menu="admin-roles" />
      )}
      {currentPage === 'admin-audit' && currentUser.role === 'admin' && <AuditLogPage />}
      {currentPage === 'admin-audit' && currentUser.role !== 'admin' && (
        <PermissionDenied menu="admin-audit" />
      )}
      {currentPage === 'admin-data' && currentUser.role === 'admin' && (
        <DataAdminPage onRefresh={refresh} />
      )}
      {currentPage === 'admin-data' && currentUser.role !== 'admin' && (
        <PermissionDenied menu="admin-data" />
      )}
      {currentPage === 'settings' && currentUser.role === 'admin' && (
        <SettingsPage onGeneralSettingsSaved={setGeneralSettings} />
      )}
      {currentPage === 'settings' && currentUser.role !== 'admin' && (
        <PermissionDenied menu="settings" />
      )}

      {/* Mobile FAB — quick jump to transaction screen from any other page */}
      {currentPage !== 'transaction' && currentPage !== 'admin-users' && (
        <FAB
          icon={Plus}
          label="Nhập / Xuất"
          tone="emerald"
          onClick={() => setCurrentPage('transaction')}
        />
      )}
    </AppShell>
  );
}
