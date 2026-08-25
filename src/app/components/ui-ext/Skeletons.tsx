import { cn } from '../ui/utils';

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={cn('flex items-center gap-3 px-4 py-3', r % 2 === 1 && 'bg-muted/20')}>
          {Array.from({ length: cols }).map((_, c) => (
            <Sk key={c} className={cn('h-3 flex-1', c === 0 && 'max-w-[60px]', c === cols - 1 && 'max-w-[80px]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Sk className="h-3 w-20" />
              <Sk className="h-4 w-full max-w-xs" />
            </div>
            <Sk className="h-6 w-16 rounded-full" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Sk className="h-10" />
            <Sk className="h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <Sk className="h-3 w-20" />
            <Sk className="h-7 w-7 rounded-md" />
          </div>
          <Sk className="h-7 w-16 mb-1.5" />
          <Sk className="h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 p-4" style={{ height }}>
      {[0.5, 0.7, 0.4, 0.85, 0.6, 0.75, 0.5, 0.9, 0.65, 0.7].map((h, i) => (
        <Sk key={i} className="flex-1" style={{ height: `${h * 100}%` } as any} />
      ))}
    </div>
  );
}

export { Sk as Skeleton };
