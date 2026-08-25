import { useState, useCallback, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { AlertTriangle, HelpCircle, Info, ShieldAlert } from 'lucide-react';
import { cn } from '../ui/utils';

type Variant = 'danger' | 'warning' | 'info' | 'question';

const VARIANT_STYLE: Record<Variant, { icon: typeof AlertTriangle; bg: string; iconColor: string; actionClass: string }> = {
  danger: {
    icon: ShieldAlert,
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400',
    actionClass: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    actionClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  info: {
    icon: Info,
    bg: 'bg-sky-100 dark:bg-sky-500/15',
    iconColor: 'text-sky-600 dark:text-sky-400',
    actionClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  question: {
    icon: HelpCircle,
    bg: 'bg-indigo-100 dark:bg-indigo-500/15',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    actionClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
};

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  /** When set, user must type this value to enable the confirm button (for destructive ops). */
  requireTyping?: string;
}

interface State {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((v: boolean) => void) | null;
}

export function useConfirm() {
  const [state, setState] = useState<State>({ open: false, options: null, resolve: null });
  const [typed, setTyped] = useState('');

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setTyped('');
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const close = (value: boolean) => {
    state.resolve?.(value);
    setState({ open: false, options: null, resolve: null });
    setTyped('');
  };

  const opts = state.options;
  const variant = opts?.variant ?? 'question';
  const v = VARIANT_STYLE[variant];
  const Icon = v.icon;
  const typingRequired = !!opts?.requireTyping;
  const typingOk = !typingRequired || typed === opts!.requireTyping;

  const dialog = (
    <AlertDialog open={state.open} onOpenChange={(o) => !o && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', v.bg)}>
              <Icon className={cn('h-5 w-5', v.iconColor)} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
              {opts?.description && (
                <AlertDialogDescription className="mt-1 text-sm">
                  {opts.description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
          {typingRequired && (
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-1.5">
                Gõ <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">{opts?.requireTyping}</code> để xác nhận
              </p>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                placeholder={opts?.requireTyping}
              />
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{opts?.cancelText ?? 'Huỷ'}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            disabled={!typingOk}
            className={cn(v.actionClass, 'disabled:opacity-50 disabled:pointer-events-none')}
          >
            {opts?.confirmText ?? 'Xác nhận'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
