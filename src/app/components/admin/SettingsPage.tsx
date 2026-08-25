import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  getTelegramSettings,
  testTelegramSettings,
  updateTelegramSettings,
  type TelegramSettings,
} from '../../utils/api';
import { toast } from 'sonner';
import { Bell, Eye, EyeOff, Hash, KeyRound, RefreshCw, Save, Send } from 'lucide-react';
import { cn } from '../ui/utils';

const EMPTY: TelegramSettings = {
  botToken: '',
  chatId: '',
  notifyUserCreate: false,
  notifyPasswordReset: false,
  notifyPermissionRequest: false,
};

type NotifyKey = 'notifyUserCreate' | 'notifyPasswordReset' | 'notifyPermissionRequest';

const TOGGLES: { key: NotifyKey; label: string; hint: string }[] = [
  {
    key: 'notifyUserCreate',
    label: 'Thông báo khi có nhân sự mới',
    hint: 'Gửi tin nhắn mỗi khi admin tạo tài khoản mới',
  },
  {
    key: 'notifyPasswordReset',
    label: 'Thông báo khi có yêu cầu đổi mật khẩu',
    hint: 'Gửi tin nhắn khi người dùng quên hoặc yêu cầu reset mật khẩu',
  },
  {
    key: 'notifyPermissionRequest',
    label: 'Thông báo khi có yêu cầu cấp quyền',
    hint: 'Gửi tin nhắn khi người dùng bấm "Yêu cầu cấp quyền" ở trang bị khoá',
  },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<TelegramSettings>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSettings(await getTelegramSettings());
    } catch (e: any) {
      toast.error(e.message || 'Không tải được cấu hình Telegram');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = <K extends keyof TelegramSettings>(key: K, value: TelegramSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // botToken is sent back verbatim. If it is still the masked placeholder from the
      // GET, the server recognises the mask and keeps the stored token untouched.
      const saved = await updateTelegramSettings(settings);
      setSettings(saved);
      setShowToken(false);
      toast.success('Đã lưu cấu hình Telegram');
    } catch (e: any) {
      toast.error(e.message || 'Lưu cấu hình thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testTelegramSettings();
      if (res.ok) toast.success('Đã gửi tin nhắn thử — kiểm tra Telegram của bạn');
      else toast.error(res.error || 'Gửi thử thất bại');
    } catch (e: any) {
      toast.error(e.message || 'Gửi thử thất bại');
    } finally {
      setTesting(false);
    }
  };

  const busy = saving || testing;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Cài đặt</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Chỉ admin
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Cấu hình kênh thông báo của hệ thống
          </p>
        </div>
        <Button onClick={load} variant="outline" disabled={loading || busy}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Tải lại
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            Cấu hình Bot Telegram
          </CardTitle>
          <CardDescription>
            Nhận thông báo tự động khi có nhân sự mới, yêu cầu đổi mật khẩu, hoặc yêu cầu cấp quyền.
            Bot sẽ gửi tin nhắn vào nhóm hoặc tài khoản Telegram được cấu hình bên dưới.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Đang tải...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="botToken" className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    Bot Token
                  </Label>
                  <div className="relative">
                    <Input
                      id="botToken"
                      type={showToken ? 'text' : 'password'}
                      autoComplete="off"
                      placeholder="123456789:AA..."
                      value={settings.botToken}
                      onChange={(e) => setField('botToken', e.target.value)}
                      disabled={busy}
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      aria-label={showToken ? 'Ẩn Bot Token' : 'Hiện Bot Token'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      tabIndex={-1}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lấy từ <span className="font-mono">@BotFather</span> trên Telegram. Để trống ô đã
                    che dấu nếu không muốn đổi token đang dùng.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chatId" className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    Chat ID
                  </Label>
                  <Input
                    id="chatId"
                    placeholder="-1001234567890"
                    value={settings.chatId}
                    onChange={(e) => setField('chatId', e.target.value)}
                    disabled={busy}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    ID nhóm hoặc người nhận thông báo. Nhóm thường bắt đầu bằng dấu trừ.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  Loại thông báo
                </div>
                <div className="divide-y rounded-lg border">
                  {TOGGLES.map((t) => (
                    <div key={t.key} className="flex items-center justify-between gap-4 px-3 py-3">
                      <div className="min-w-0">
                        <Label htmlFor={t.key} className="cursor-pointer text-sm">
                          {t.label}
                        </Label>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.hint}</p>
                      </div>
                      <Switch
                        id={t.key}
                        checked={settings[t.key]}
                        onCheckedChange={(v) => setField(t.key, v)}
                        disabled={busy}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={handleTest} disabled={busy}>
                  <Send className={cn('mr-2 h-4 w-4', testing && 'animate-pulse')} />
                  {testing ? 'Đang gửi...' : 'Gửi thử'}
                </Button>
                <Button onClick={handleSave} disabled={busy}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
