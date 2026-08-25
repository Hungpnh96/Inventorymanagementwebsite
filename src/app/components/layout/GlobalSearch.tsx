import { useEffect, useState, useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Package, Warehouse, ArrowDownToLine, BarChart3, Search as SearchIcon } from 'lucide-react';
import { Product } from '../../types';
import { NavId } from './Sidebar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onNavigate: (page: NavId) => void;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function GlobalSearch({ open, onOpenChange, products, onNavigate }: Props) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const productMatches = useMemo(() => {
    const q = normalize(query);
    if (!q) return products.slice(0, 8);
    return products
      .filter((p) => normalize(p.tenSanPham).includes(q) || normalize(p.maSKU).includes(q))
      .slice(0, 10);
  }, [products, query]);

  const pages = [
    { id: 'dashboard' as NavId, label: 'Dashboard', icon: BarChart3 },
    { id: 'inventory' as NavId, label: 'Quản lý tồn kho', icon: Warehouse },
    { id: 'transaction' as NavId, label: 'Xuất nhập kho', icon: ArrowDownToLine },
    { id: 'search' as NavId, label: 'Tìm kiếm', icon: SearchIcon },
    { id: 'reports' as NavId, label: 'Báo cáo', icon: BarChart3 },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tìm kiếm"
      description="Tìm sản phẩm, trang hoặc lệnh"
      shouldFilter={false}
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="Tìm sản phẩm, SKU hoặc trang..." />
      <CommandList>
        <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
        <CommandGroup heading="Trang">
          {pages.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem
                key={p.id}
                value={p.label}
                onSelect={() => {
                  onNavigate(p.id);
                  onOpenChange(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4 text-indigo-600" />
                {p.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {productMatches.length > 0 && (
          <CommandGroup heading={`Sản phẩm (${productMatches.length})`}>
            {productMatches.map((p) => (
              <CommandItem
                key={p.maSKU}
                value={`${p.tenSanPham} ${p.maSKU}`}
                onSelect={() => {
                  onNavigate('inventory');
                  onOpenChange(false);
                }}
              >
                <Package className="mr-2 h-4 w-4 text-slate-500" />
                <div className="flex flex-1 flex-col">
                  <span>{p.tenSanPham}</span>
                  <span className="text-xs text-muted-foreground">
                    SKU: {p.maSKU} • Tồn: {p.tonKho} {p.donViTinh}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
