import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { changePassword } from '../utils/api';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  forced: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, forced, onSuccess, onClose }: Props) {
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password mới phải có ít nhất 8 ký tự');
      return;
    }
    if (newPassword !== confirm) {
      toast.error('Xác nhận password không khớp');
      return;
    }
    setBusy(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success('Đã đổi mật khẩu');
      setOld('');
      setNew('');
      setConfirm('');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !forced && onClose()}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => forced && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-md bg-violet-100 p-1.5">
              <KeyRound className="h-4 w-4 text-violet-700" />
            </div>
            Đổi mật khẩu
          </DialogTitle>
          <DialogDescription>
            {forced
              ? 'Đây là lần đăng nhập đầu — bạn cần đổi mật khẩu mặc định trước khi dùng tiếp.'
              : 'Cập nhật mật khẩu của bạn.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="old">Mật khẩu hiện tại</Label>
            <Input id="old" type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new">Mật khẩu mới (tối thiểu 8 ký tự)</Label>
            <Input id="new" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Xác nhận mật khẩu mới</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <DialogFooter>
            {!forced && (
              <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                Huỷ
              </Button>
            )}
            <Button type="submit" disabled={busy} className="bg-violet-600 hover:bg-violet-700 text-white">
              <ShieldCheck className="mr-2 h-4 w-4" />
              {busy ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
