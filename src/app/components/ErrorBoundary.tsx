import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Console only — no external Sentry for now.
    console.error('[ErrorBoundary]', error, info);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-card p-6 shadow-lg dark:border-rose-500/30">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-500/15">
              <AlertOctagon className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Có lỗi xảy ra</h1>
              <p className="text-xs text-muted-foreground">Trang gặp lỗi không mong muốn</p>
            </div>
          </div>
          <div className="mb-4 rounded-md bg-muted/50 p-3">
            <p className="text-xs font-mono text-rose-700 dark:text-rose-300 break-all">
              {error.name}: {error.message}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={this.reset} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              <RefreshCw className="mr-2 h-4 w-4" />
              Thử lại
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex-1"
            >
              Tải lại trang
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Lỗi này đã được ghi vào console. Liên hệ admin nếu lặp lại.
          </p>
        </div>
      </div>
    );
  }
}
