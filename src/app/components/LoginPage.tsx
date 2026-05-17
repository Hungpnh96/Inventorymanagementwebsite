import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { User } from '../types';
import { Package } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Simple authentication logic
    if (username === 'admin' && password === 'admin') {
      onLogin({ username: 'admin', role: 'admin' });
    } else if (username && password) {
      onLogin({ username, role: 'user' });
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
          <CardDescription className="text-center text-base">
            Đăng nhập để tiếp tục
          </CardDescription>
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
              />
            </div>
            <Button type="submit" className="w-full">
              Đăng nhập
            </Button>
          </form>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Tài khoản mẫu:</strong>
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Admin: admin / admin
            </p>
            <p className="text-sm text-blue-700">
              User: user / user
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
