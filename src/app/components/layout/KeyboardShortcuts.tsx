import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Keyboard } from 'lucide-react';
import type { NavId } from './Sidebar';

interface Props {
  onNavigate: (id: NavId) => void;
  onOpenSearch: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
  category: 'navigate' | 'global';
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['?'], label: 'Hiện danh sách phím tắt', category: 'global' },
  { keys: ['⌘', 'K'], label: 'Tìm kiếm toàn cục', category: 'global' },
  { keys: ['Esc'], label: 'Đóng dialog / popup', category: 'global' },
  { keys: ['G', 'D'], label: 'Đi tới Dashboard', category: 'navigate' },
  { keys: ['G', 'I'], label: 'Đi tới Tồn kho', category: 'navigate' },
  { keys: ['G', 'T'], label: 'Đi tới Xuất / Nhập kho', category: 'navigate' },
  { keys: ['G', 'S'], label: 'Đi tới Tìm kiếm', category: 'navigate' },
  { keys: ['G', 'R'], label: 'Đi tới Báo cáo', category: 'navigate' },
  { keys: ['G', 'U'], label: 'Đi tới Quản trị users (admin)', category: 'navigate' },
  { keys: ['G', 'A'], label: 'Đi tới Audit log (admin)', category: 'navigate' },
];

const NAV_MAP: Record<string, NavId> = {
  d: 'dashboard',
  i: 'inventory',
  t: 'transaction',
  s: 'search',
  r: 'reports',
  u: 'admin-users',
  a: 'admin-audit',
};

export function KeyboardShortcutsProvider({ onNavigate, onOpenSearch }: Props) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      // Global ⌘K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
        return;
      }
      if (isTyping(e)) return;

      // ? help
      if (e.key === '?') {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // g + <letter> sequence (within 800ms)
      const now = Date.now();
      const key = e.key.toLowerCase();
      if (key === 'g') {
        lastKey = 'g';
        lastKeyTime = now;
        return;
      }
      if (lastKey === 'g' && now - lastKeyTime < 800 && NAV_MAP[key]) {
        e.preventDefault();
        lastKey = '';
        onNavigate(NAV_MAP[key]);
        return;
      }
      lastKey = '';
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, onOpenSearch]);

  const navigate = SHORTCUTS.filter((s) => s.category === 'navigate');
  const global = SHORTCUTS.filter((s) => s.category === 'global');

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/15">
              <Keyboard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <DialogTitle>Phím tắt bàn phím</DialogTitle>
              <DialogDescription className="text-xs">
                Bấm <Kbd>?</Kbd> ở bất cứ đâu (ngoài ô input) để mở hộp này
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Toàn cục
            </h3>
            <ul className="space-y-1.5">
              {global.map((s) => (
                <ShortcutRow key={s.label} shortcut={s} />
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Điều hướng
            </h3>
            <ul className="space-y-1.5">
              {navigate.map((s) => (
                <ShortcutRow key={s.label} shortcut={s} />
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Cách dùng: bấm <Kbd>G</Kbd>, rồi bấm phím thứ 2 trong vòng 0.8s.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <li className="flex items-center justify-between rounded-md px-2 py-1 text-sm">
      <span>{shortcut.label}</span>
      <span className="flex items-center gap-1">
        {shortcut.keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </span>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 text-[11px] font-mono font-semibold text-foreground shadow-sm">
      {children}
    </kbd>
  );
}
