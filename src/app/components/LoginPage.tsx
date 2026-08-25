import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Package, Eye, EyeOff, LogIn, KeyRound, MailQuestion, Check } from 'lucide-react';
import { login, requestPasswordReset, LoginResult } from '../utils/api';
import { toast } from 'sonner';

interface LoginPageProps {
  onLogin: (result: LoginResult) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset request dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    try {
      const result = await login(username, password);
      onLogin(result);
    } catch (err: any) {
      toast.error(err.message || 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const openResetDialog = () => {
    setResetUser(username);
    setResetReason('');
    setResetSent(false);
    setResetOpen(true);
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập');
      return;
    }
    setResetSubmitting(true);
    try {
      await requestPasswordReset(resetUser.trim(), resetReason.trim());
      setResetSent(true);
      toast.success('Đã gửi yêu cầu đến quản trị viên');
    } catch (err: any) {
      toast.error(err.message || 'Không gửi được yêu cầu');
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/25">
              <Package className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Hệ thống quản lý kho</CardTitle>
          <CardDescription className="text-sm">Đăng nhập để tiếp tục</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs">Tên đăng nhập</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={submitting}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">Mật khẩu</Label>
                <button
                  type="button"
                  onClick={openResetDialog}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                  tabIndex={-1}
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-indigo-600 hover:bg-indigo-700 text-base font-semibold"
              disabled={submitting}
            >
              <LogIn className="mr-2 h-4 w-4" />
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password reset request dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/15">
                <KeyRound className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <DialogTitle>Yêu cầu đặt lại mật khẩu</DialogTitle>
                <DialogDescription className="text-xs">
                  Quản trị viên sẽ liên hệ và đặt lại mật khẩu cho bạn
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {resetSent ? (
            <div className="py-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-emerald-900 dark:text-emerald-200">Đã gửi yêu cầu thành công</div>
                    <p className="mt-1 text-emerald-800 dark:text-emerald-300">
                      Quản trị viên sẽ xem xét và liên hệ với bạn trong thời gian sớm nhất. Vui lòng kiểm tra
                      với người quản trị hệ thống.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={() => setResetOpen(false)} className="w-full">
                  Đã hiểu
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={submitReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-user" className="text-xs">
                  Tên đăng nhập <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="reset-user"
                  type="text"
                  value={resetUser}
                  onChange={(e) => setResetUser(e.target.value)}
                  placeholder="Nhập username của bạn"
                  required
                  autoFocus
                  maxLength={64}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-reason" className="text-xs">
                  Lý do <span className="text-muted-foreground">(tuỳ chọn)</span>
                </Label>
                <Textarea
                  id="reset-reason"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="VD: Quên mật khẩu, mất thiết bị 2FA, mật khẩu bị khoá..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-[10px] text-muted-foreground text-right">{resetReason.length}/500</p>
              </div>
              <div className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-300">
                <MailQuestion className="h-4 w-4 shrink-0 mt-0.5" />
                Yêu cầu sẽ được ghi vào nhật ký hệ thống và quản trị viên sẽ xem xét.
              </div>
              <DialogFooter className="gap-2 flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetOpen(false)}
                  disabled={resetSubmitting}
                  className="flex-1"
                >
                  Huỷ
                </Button>
                <Button
                  type="submit"
                  disabled={resetSubmitting || !resetUser.trim()}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <MailQuestion className="mr-2 h-4 w-4" />
                  {resetSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
