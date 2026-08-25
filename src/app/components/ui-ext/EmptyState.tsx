import { ComponentType, ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../ui/utils';

interface Props {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      <div className="relative mb-4">
        {/* Decorative gradient ring */}
        <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-br from-indigo-400/15 to-emerald-400/15 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
