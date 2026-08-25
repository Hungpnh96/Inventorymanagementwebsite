// EPIC-005 — Wrapper around Sonner that adds icon + colored class per semantic type.
// Existing `toast.success(...)` / `toast.error(...)` keep working (we don't break Sonner).
// New code should prefer `notify.*` for consistency.

import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

type Opts = {
  description?: string;
  duration?: number;
};

function buildPayload(icon: ReactNode, opts: Opts | undefined, variant: string) {
  return {
    icon,
    description: opts?.description,
    duration: opts?.duration,
    className: `toast-${variant}`,
  };
}

export const notify = {
  success: (msg: string, opts?: Opts) =>
    toast.success(msg, buildPayload(<CheckCircle2 className="h-4 w-4" />, opts, 'success')),
  error: (msg: string, opts?: Opts) =>
    toast.error(msg, buildPayload(<XCircle className="h-4 w-4" />, opts, 'error')),
  warn: (msg: string, opts?: Opts) =>
    toast.warning(msg, buildPayload(<AlertTriangle className="h-4 w-4" />, opts, 'warn')),
  info: (msg: string, opts?: Opts) =>
    toast.message(msg, buildPayload(<Info className="h-4 w-4" />, opts, 'info')),
};
