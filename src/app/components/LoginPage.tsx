import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Package } from 'lucide-react';
import { login, LoginResult } from '../utils/api';
import { toast } from 'sonner';

interface LoginPageProps {
  onLogin: (result: LoginResult) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 p-4 rounded-full">
              <Package className="w-10 h-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl text-center">Hệ thống quản lý kho</CardTitle>
          <CardDescription className="text-center text-base">Đăng nhập để tiếp tục</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input
                id="username"
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-900">
            <strong>Lưu ý:</strong> Tài khoản admin được seed từ biến môi trường
            <code className="mx-1 rounded bg-blue-100 px-1">DEFAULT_ADMIN_PASSWORD</code>
            trên server (xem file <code className="mx-1 rounded bg-blue-100 px-1">.env</code>).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
