import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { adminCreateUser, adminUpdateUser, type AdminUser } from '../../utils/api';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  user?: AdminUser; // required when mode === 'edit'
  onClose: () => void;
  onSuccess: () => void;
}

const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

export function UserFormDialog({ open, mode, user, onClose, onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [tempPassword, setTempPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && user) {
        setUsername(user.username);
        setFullName(user.fullName);
        setRole(user.role);
        setTempPassword('');
      } else {
        setUsername('');
        setFullName('');
        setRole('user');
        setTempPassword('');
      }
    }
  }, [open, mode, user]);

  const usernameError =
    mode === 'create' && username.length > 0 && !USERNAME_RE.test(username)
      ? 'Username 3-32 ký tự, chỉ gồm a-z, 0-9, _, -'
      : null;
  const passwordError =
    mode === 'create' && tempPassword.length > 0 && tempPassword.length < 8
      ? 'Mật khẩu phải có ít nhất 8 ký tự'
      : null;

  const canSubmit =
    mode === 'create'
      ? USERNAME_RE.test(username) && tempPassword.length >= 8 && !submitting
      : !!user && fullName !== user.fullName && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await adminCreateUser({ username: username.trim().toLowerCase(), fullName, role, tempPassword });
        toast.success(`Đã tạo user '${username}'`);
      } else if (user) {
        await adminUpdateUser(user.id, { fullName });
        toast.success('Đã cập nhật thông tin user');
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Không thể lưu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Thêm user mới' : 'Sửa thông tin user'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Tạo tài khoản mới. User sẽ bắt buộc đổi mật khẩu khi đăng nhập lần đầu.'
              : 'Chỉ có thể sửa Tên đầy đủ. Username và Vai trò không thể đổi sau khi tạo.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="user-username">Username</Label>
            <Input
              id="user-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={mode === 'edit' || submitting}
              placeholder="vd: nguyen-van-a"
              autoComplete="off"
            />
            {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="user-fullname">Tên đầy đủ</Label>
            <Input
              id="user-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="user-role">Vai trò</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as 'admin' | 'user')}
              disabled={mode === 'edit' || submitting}
            >
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'create' && (
            <div className="space-y-1">
              <Label htmlFor="user-temppass">Mật khẩu tạm (≥ 8 ký tự)</Label>
              <Input
                id="user-temppass"
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                disabled={submitting}
                placeholder="Sẽ buộc đổi khi user đăng nhập lần đầu"
                autoComplete="new-password"
              />
              {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
