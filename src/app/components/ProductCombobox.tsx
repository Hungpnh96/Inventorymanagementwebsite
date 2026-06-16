import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { Check, ChevronsUpDown, PackageSearch, PlusCircle, X } from 'lucide-react';
import { cn } from './ui/utils';
import { Product } from '../types';

interface ProductComboboxProps {
  products: Product[];
  value: Product | null;
  onChange: (product: Product) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  onCreateNew?: (query: string) => void;
  createLabel?: string;
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function ProductCombobox({
  products,
  value,
  onChange,
  placeholder = 'Gõ tên sản phẩm hoặc mã SKU để tìm...',
  emptyText = 'Không tìm thấy sản phẩm.',
  disabled,
  onCreateNew,
  createLabel = 'Thêm sản phẩm mới',
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return products;
    return products.filter((p) => {
      const name = normalize(p.tenSanPham || '');
      const sku = normalize(p.maSKU || '');
      const loai = normalize(p.loaiHang || '');
      return name.includes(q) || sku.includes(q) || loai.includes(q);
    });
  }, [products, query]);

  const handleSelect = (product: Product) => {
    onChange(product);
    setOpen(false);
    setQuery('');
  };

  const displayValue = value ? `${value.tenSanPham} (${value.maSKU})` : '';

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        className={cn(
          'flex w-full items-center rounded-md border bg-background',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        <Input
          type="text"
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          placeholder={value ? '' : placeholder}
          disabled={disabled}
          className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(null as any);
              setQuery('');
            }}
            className="mr-1 rounded-sm p-1 hover:bg-muted"
            aria-label="Xoá lựa chọn"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mr-2 rounded-sm p-1 hover:bg-muted"
          aria-label="Mở danh sách"
        >
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          <div className="sticky top-0 border-b bg-popover px-3 py-1.5 text-xs text-muted-foreground">
            {products.length === 0
              ? 'Kho hiện chưa có sản phẩm nào'
              : `${filtered.length}/${products.length} sản phẩm`}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
              <PackageSearch className="h-6 w-6" />
              <span>{emptyText}</span>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew(query);
                    setOpen(false);
                  }}
                  className="mt-2 flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <PlusCircle className="h-4 w-4" />
                  {query ? `${createLabel}: "${query}"` : createLabel}
                </button>
              )}
            </div>
          ) : (
            <ul className="p-1">
              {filtered.map((product) => {
                const selected = value?.maSKU === product.maSKU;
                return (
                  <li key={product.maSKU}>
                    <button
                      type="button"
                      onClick={() => handleSelect(product)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                        selected && 'bg-accent/50',
                      )}
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="font-medium">{product.tenSanPham}</span>
                        <span className="text-xs text-muted-foreground">
                          SKU: {product.maSKU}
                          {product.loaiHang ? ` • ${product.loaiHang}` : ''}
                          {' • '}Tồn: {product.tonKho} {product.donViTinh}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
