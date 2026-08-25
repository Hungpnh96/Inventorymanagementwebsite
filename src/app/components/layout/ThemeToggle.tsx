import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../design/ThemeProvider';
import { Button } from '../ui/button';

/**
 * Simple 1-click toggle between Light ↔ Dark.
 * (System mode is auto-detected at first load; clicking pins explicit choice.)
 */
export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={isDark ? 'Đang ở Dark — bấm để chuyển Light' : 'Đang ở Light — bấm để chuyển Dark'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
