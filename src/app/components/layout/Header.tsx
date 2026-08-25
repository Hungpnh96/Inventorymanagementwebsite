import { Menu, Search, Bell, ChevronRight, PanelLeftClose, PanelLeftOpen, KeyRound, LogOut, UserCircle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ThemeToggle } from './ThemeToggle';
import { User } from '../../types';
import { NavId, NAV_ITEMS } from './Sidebar';

interface HeaderProps {
  currentUser: User;
  currentPage: NavId;
  sidebarCollapsed: boolean;
  onToggleMobile: () => void;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function Header({
  currentUser,
  currentPage,
  sidebarCollapsed,
  onToggleMobile,
  onToggleCollapse,
  onOpenSearch,
  onChangePassword,
  onLogout,
}: HeaderProps) {
  const navItem = NAV_ITEMS.find((n) => n.id === currentPage);
  const initials = currentUser.username.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:gap-3 sm:px-4">
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={onToggleMobile} aria-label="Mở menu">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden h-9 w-9 lg:inline-flex"
        onClick={onToggleCollapse}
        aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
        <span className="text-muted-foreground hidden sm:inline">ERP</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground hidden sm:inline" />
        <span className="font-semibold truncate">{navItem?.label ?? 'Trang'}</span>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search trigger */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden md:inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground w-56 lg:w-72"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Tìm sản phẩm, SKU…</span>
        <kbd className="hidden sm:inline rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
      </button>
      <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={onOpenSearch} aria-label="Tìm kiếm">
        <Search className="h-4 w-4" />
      </Button>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Thông báo">
            <Bell className="h-4 w-4" />
            {/* placeholder dot */}
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            Chưa có thông báo nào.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <ThemeToggle />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border bg-background px-1 py-1 pr-2 sm:pr-3 hover:bg-accent transition-colors"
            aria-label="Tài khoản"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-xs font-medium">{currentUser.username}</span>
              <span className="text-[10px] text-muted-foreground">
                {currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{currentUser.username}</span>
              <span className="text-xs text-muted-foreground">
                {currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onChangePassword}>
            <KeyRound className="mr-2 h-4 w-4 text-violet-600" />
            Đổi mật khẩu
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <UserCircle className="mr-2 h-4 w-4" />
            Hồ sơ (sắp ra)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-rose-600 focus:text-rose-600">
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
