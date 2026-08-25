import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { EmptyState } from './EmptyState';
import { requestAccess } from '../../utils/api';
import { toast } from 'sonner';
import { Send, ShieldAlert } from 'lucide-react';
import { cn } from '../ui/utils';

interface Props {
  /** Route id of the blocked page (e.g. "admin-users") — sent to the server and shown in Telegram. */
  menu: string;
}

/**
 * Empty state shown instead of a role-gated page, with a self-service escalation:
 * the user can ping an admin over Telegram rather than hunting one down manually.
 */
export function PermissionDenied({ menu }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await requestAccess(menu, reason.trim() || undefined);
      toast.success('Đã gửi yêu cầu, vui lòng chờ Admin xử lý qua Telegram.');
      setOpen(false);
      setReason('');
    } catch (e: any) {
      // A 429 carries the server's own "bạn vừa gửi rồi" message — surface it as-is.
      toast.error(e.message || 'Gửi yêu cầu thất bại');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <EmptyState
        icon={ShieldAlert}
        title="Không có quyền truy cập trang này."
        description="Nếu bạn cần dùng chức năng này, hãy gửi yêu cầu — Admin sẽ nhận được thông báo."
        action={
          <Button onClick={() => setOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            Yêu cầu cấp quyền
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-md bg-indigo-100 p-1.5 dark:bg-indigo-500/15">
                <ShieldAlert className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
              </div>
              Yêu cầu cấp quyền
            </DialogTitle>
            <DialogDescription>
              Admin sẽ nhận được thông báo qua Telegram kèm tên trang bạn cần truy cập (
              <code className="font-mono">{menu}</code>).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="access-reason">Lý do (không bắt buộc)</Label>
            <Textarea
              id="access-reason"
              rows={3}
              placeholder="Ví dụ: cần xem nhật ký để đối chiếu phiếu xuất tuần này"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={sending}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={sending}>
              Huỷ
            </Button>
            <Button type="button" onClick={submit} disabled={sending}>
              <Send className={cn('mr-2 h-4 w-4', sending && 'animate-pulse')} />
              {sending ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
