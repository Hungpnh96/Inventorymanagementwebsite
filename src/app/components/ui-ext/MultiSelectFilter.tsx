import { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';

interface Props {
  label: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function MultiSelectFilter({ label, options, selected, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-8 border-dashed', selected.length > 0 && 'border-solid border-indigo-300 bg-indigo-50 dark:bg-indigo-500/10', className)}
        >
          {label}
          {selected.length > 0 ? (
            <>
              <span className="mx-1.5 h-3 w-px bg-border" />
              <span className="rounded-sm bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {selected.length}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={clear}
                className="ml-1 -mr-1 rounded p-0.5 hover:bg-muted"
                aria-label={`Xoá lọc ${label}`}
              >
                <X className="h-3 w-3" />
              </span>
            </>
          ) : (
            <ChevronDown className="ml-1.5 h-3 w-3 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <div className="border-b p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Lọc ${label.toLowerCase()}…`}
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Không có lựa chọn</div>
          ) : (
            filtered.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-sm border',
                      checked
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-input',
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count != null && (
                    <span className="text-[10px] text-muted-foreground">{o.count}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-1.5">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full rounded-sm px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-accent"
            >
              Xoá toàn bộ
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
