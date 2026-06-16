import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { adminResetPassword, type AdminUser } from '../../utils/api';
import { Copy } from 'lucide-react';

interface Props {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
}

/**
 * Two-stage flow:
 *   stage 'confirm' — admin sees warning + confirm button
 *   stage 'show'    — server returned temp pw; show ONCE with Copy button
 * Closing the dialog in 'show' stage blanks all state (EPIC-004-AC24).
 */
export function ResetPasswordDialog({ open, user, onClose }: Props) {
  const [stage, setStage] = useState<'confirm' | 'show'>('confirm');
  const [submitting, setSubmitting] = useState(false);
  const [tempPw, setTempPw] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStage('confirm');
      setSubmitting(false);
      setTempPw(null);
    } else {
      // Defensive: ensure no residue after close.
      setTempPw(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const pw = await adminResetPassword(user.id);
      setTempPw(pw);
      setStage('show');
    } catch (e: any) {
      toast.error(e.message || 'Không thể reset password');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!tempPw) return;
    try {
      await navigator.clipboard.writeText(tempPw);
      toast.success('Đã copy vào clipboard');
    } catch {
      toast.error('Không thể copy. Hãy chọn và copy thủ công.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {stage === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle>Reset mật khẩu cho '{user?.username}'?</DialogTitle>
              <DialogDescription>
                Hệ thống sẽ sinh một mật khẩu tạm 16 ký tự, hiển thị 1 lần duy nhất. Tất cả phiên đăng nhập hiện tại của user này sẽ bị thu hồi ngay.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
                {submitting ? 'Đang xử lý...' : 'Reset mật khẩu'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Mật khẩu tạm</DialogTitle>
              <DialogDescription className="text-destructive">
                Mật khẩu này chỉ hiển thị 1 LẦN. Hãy copy và chuyển cho user qua kênh an toàn trước khi đóng cửa sổ.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div
                className="rounded-md bg-muted p-3 font-mono text-base text-center select-all"
                aria-live="polite"
                aria-label="Mật khẩu tạm"
              >
                {tempPw}
              </div>
              <Button onClick={handleCopy} variant="outline" className="w-full">
                <Copy className="mr-2 h-4 w-4" />
                Copy mật khẩu
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Đóng</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
