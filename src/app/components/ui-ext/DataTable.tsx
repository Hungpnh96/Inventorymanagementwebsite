import { useState, useMemo, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../ui/utils';
import { Button } from '../ui/button';

export interface ColumnDef<T> {
  id: string;
  header: string;
  /** Cell renderer for desktop table */
  cell: (row: T) => ReactNode;
  /** Optional sort accessor; if omitted the column is not sortable */
  sortValue?: (row: T) => string | number;
  /** Right-align (numbers / actions) */
  align?: 'left' | 'right' | 'center';
  /** Width hint (Tailwind class e.g. `w-[120px]`) */
  width?: string;
  /** Pin column to left for horizontal scroll */
  sticky?: boolean;
  /** Hide on smaller screens via Tailwind className (e.g. `hidden lg:table-cell`) */
  hideClassName?: string;
}

interface Props<T> {
  data: T[];
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  /** Card renderer for mobile */
  mobileCard?: (row: T) => ReactNode;
  /** Filter/toolbar slot above table */
  toolbar?: ReactNode;
  /** Right-side actions in toolbar */
  toolbarRight?: ReactNode;
  /** Render when no rows */
  empty?: ReactNode;
  /** Loading state */
  loading?: boolean;
  loadingSkeleton?: ReactNode;
  /** Optional row click */
  onRowClick?: (row: T) => void;
  /** Max height before vertical scroll with sticky header */
  maxHeight?: string;
  className?: string;
  /** Pagination (omit to disable) */
  pageSize?: number;
  /** Optional initial sort */
  initialSort?: { id: string; dir: 'asc' | 'desc' };
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T>({
  data,
  columns,
  rowKey,
  mobileCard,
  toolbar,
  toolbarRight,
  empty,
  loading,
  loadingSkeleton,
  onRowClick,
  maxHeight = 'max-h-[68vh]',
  className,
  pageSize,
  initialSort,
}: Props<T>) {
  const [sortBy, setSortBy] = useState<{ id: string; dir: SortDir }>(
    initialSort ?? { id: '', dir: null },
  );
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortBy.id || !sortBy.dir) return data;
    const col = columns.find((c) => c.id === sortBy.id);
    if (!col?.sortValue) return data;
    const accessor = col.sortValue;
    const arr = [...data];
    arr.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (va === vb) return 0;
      const cmp = va > vb ? 1 : -1;
      return sortBy.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [data, columns, sortBy]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const paged = pageSize ? sorted.slice(safePage * pageSize, (safePage + 1) * pageSize) : sorted;

  const cycleSort = (id: string) => {
    setSortBy((prev) => {
      if (prev.id !== id) return { id, dir: 'asc' };
      if (prev.dir === 'asc') return { id, dir: 'desc' };
      return { id: '', dir: null };
    });
    setPage(0);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {(toolbar || toolbarRight) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">{toolbar}</div>
          {toolbarRight && <div className="flex items-center gap-2 shrink-0">{toolbarRight}</div>}
        </div>
      )}

      {loading ? (
        loadingSkeleton ?? null
      ) : data.length === 0 ? (
        empty ?? null
      ) : (
        <>
          {/* Mobile card list */}
          {mobileCard && (
            <div className="space-y-3 md:hidden">
              {paged.map((row) => (
                <div key={rowKey(row)}>{mobileCard(row)}</div>
              ))}
            </div>
          )}

          {/* Desktop table */}
          <div className={cn('hidden md:block rounded-md border bg-card overflow-auto', maxHeight)}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/80">
                <tr>
                  {columns.map((col) => {
                    const isSorted = sortBy.id === col.id && !!sortBy.dir;
                    const Icon =
                      !col.sortValue
                        ? null
                        : !isSorted
                          ? ChevronsUpDown
                          : sortBy.dir === 'asc'
                            ? ChevronUp
                            : ChevronDown;
                    return (
                      <th
                        key={col.id}
                        className={cn(
                          'whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 border-b',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.width,
                          col.hideClassName,
                          col.sticky && 'sticky left-0 z-20 bg-slate-50/95 dark:bg-slate-900/80',
                        )}
                      >
                        {col.sortValue ? (
                          <button
                            type="button"
                            onClick={() => cycleSort(col.id)}
                            className={cn(
                              'inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors',
                              col.align === 'right' && 'flex-row-reverse',
                              isSorted && 'text-indigo-600 dark:text-indigo-400',
                            )}
                          >
                            {col.header}
                            {Icon && <Icon className="h-3 w-3" />}
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((row, i) => (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5',
                      !onRowClick && 'hover:bg-muted/40',
                      i % 2 === 1 && 'bg-muted/20',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          'px-3 py-2.5',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.hideClassName,
                          col.sticky && 'sticky left-0 bg-card',
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageSize && sorted.length > pageSize && (
            <div className="flex items-center justify-between gap-2 px-1 text-sm">
              <span className="text-muted-foreground">
                Trang <strong className="text-foreground">{safePage + 1}</strong> / {totalPages} •{' '}
                {sorted.length} dòng
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  aria-label="Trang sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
