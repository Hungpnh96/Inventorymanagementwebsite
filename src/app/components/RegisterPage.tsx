import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Package, Eye, EyeOff, UserPlus, ArrowLeft, Check, Info } from 'lucide-react';
import { register } from '../utils/api';
import { toast } from 'sonner';

interface RegisterPageProps {
  onBackToLogin: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage({ onBackToLogin }: RegisterPageProps) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Set only after a 200 — swaps the form for the "chờ Admin duyệt" state inside the same Card.
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side mirror of the server rules for fast feedback. The server stays authoritative:
    // a 400 still surfaces below via the same toast path.
    if (!username.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (!fullName.trim()) {
      toast.error('Vui lòng nhập họ tên');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setSubmitting(true);
    try {
      const result = await register(username.trim(), password, fullName.trim());
      setSentMessage(result.message);
      toast.success('Đăng ký thành công');
    } catch (err: any) {
      toast.error(err.message || 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center mb-2">
            <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/25">
              <Package className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Đăng ký tài khoản</CardTitle>
          <CardDescription className="text-sm">
            {sentMessage ? 'Yêu cầu đã được gửi đến quản trị viên' : 'Tài khoản cần được Admin duyệt trước khi sử dụng'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sentMessage ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Đăng ký thành công
                    </div>
                    <p className="mt-1 text-emerald-800 dark:text-emerald-300">{sentMessage}</p>
                  </div>
                </div>
              </div>
              <Button onClick={onBackToLogin} className="h-11 w-full bg-indigo-600 hover:bg-indigo-700 text-base font-semibold">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại đăng nhập
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-username" className="text-xs">
                  Tên đăng nhập <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="reg-username"
                  type="text"
                  autoComplete="username"
                  placeholder="nhanvien01"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  maxLength={64}
                  disabled={submitting}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-fullname" className="text-xs">
                  Họ tên <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="reg-fullname"
                  type="text"
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={128}
                  disabled={submitting}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-xs">
                  Mật khẩu <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
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
                <p className="text-[10px] text-muted-foreground">Tối thiểu {MIN_PASSWORD_LENGTH} ký tự.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-confirm" className="text-xs">
                  Xác nhận mật khẩu <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                  aria-invalid={passwordsMismatch}
                  className="h-11"
                />
                {passwordsMismatch && (
                  <p className="text-[10px] text-rose-600">Mật khẩu xác nhận không khớp.</p>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-300">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                Sau khi đăng ký, tài khoản ở trạng thái chờ duyệt. Quản trị viên sẽ duyệt và cấp quyền truy cập.
              </div>

              <Button
                type="submit"
                className="h-11 w-full bg-indigo-600 hover:bg-indigo-700 text-base font-semibold"
                disabled={submitting}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {submitting ? 'Đang gửi...' : 'Đăng ký'}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                >
                  Đăng nhập
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
