import { ComponentType } from 'react';
import { cn } from '../ui/utils';

interface Props {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  tone?: 'indigo' | 'emerald' | 'orange' | 'rose';
  className?: string;
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  orange: 'bg-orange-600 hover:bg-orange-700',
  rose: 'bg-rose-600 hover:bg-rose-700',
};

/**
 * Floating Action Button — fixed bottom-right on mobile only.
 * Sits above the bottom-nav (bottom: 80px). Hidden on lg+.
 */
export function FAB({ icon: Icon, label, onClick, tone = 'indigo', className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'lg:hidden fixed right-4 z-30 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition-all active:scale-95',
        TONE[tone],
        'bottom-[80px]', // above bottom-nav (~64px) + 16px gap
        className,
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
