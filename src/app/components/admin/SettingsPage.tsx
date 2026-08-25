import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  getGeneralSettings,
  getTelegramSettings,
  testTelegramSettings,
  updateGeneralSettings,
  updateTelegramSettings,
  type GeneralSettings,
  type TelegramSettings,
} from '../../utils/api';
import { toast } from 'sonner';
import {
  Bell,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Languages,
  PackageMinus,
  RefreshCw,
  Save,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { STOCK_LOW_THRESHOLD } from '../../design/status-colors';

const EMPTY: TelegramSettings = {
  botToken: '',
  chatId: '',
  notifyUserCreate: false,
  notifyPasswordReset: false,
  notifyPermissionRequest: false,
  notifyLowStock: false,
};

const EMPTY_GENERAL: GeneralSettings = {
  language: 'vi',
  lowStockThreshold: STOCK_LOW_THRESHOLD,
};

type NotifyKey =
  | 'notifyUserCreate'
  | 'notifyPasswordReset'
  | 'notifyPermissionRequest'
  | 'notifyLowStock';

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
  {
    key: 'notifyLowStock',
    label: 'Thông báo khi tồn kho xuống dưới ngưỡng',
    hint: 'Gửi tin nhắn khi một sản phẩm rơi xuống dưới ngưỡng cảnh báo ở "Cài đặt chung"',
  },
];

interface Props {
  /** Lets the app refresh its cached threshold right after an admin saves, without a page reload. */
  onGeneralSettingsSaved?: (s: GeneralSettings) => void;
}

export function SettingsPage({ onGeneralSettingsSaved }: Props) {
  const [settings, setSettings] = useState<TelegramSettings>(EMPTY);
  const [general, setGeneral] = useState<GeneralSettings>(EMPTY_GENERAL);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const load = async () => {
    setLoading(true);
    // Both cards load in one pass — settled independently so a failure on one
    // does not blank out the other.
    const [tg, gen] = await Promise.allSettled([getTelegramSettings(), getGeneralSettings()]);
    if (tg.status === 'fulfilled') setSettings(tg.value);
    else toast.error((tg.reason as any)?.message || 'Không tải được cấu hình Telegram');
    if (gen.status === 'fulfilled') setGeneral(gen.value);
    else toast.error((gen.reason as any)?.message || 'Không tải được cài đặt chung');
    setLoading(false);
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

  const handleSaveGeneral = async () => {
    // Mirror the server's 400 rule locally so the user gets an inline message
    // instead of a round-trip error.
    if (general.lowStockThreshold < 0) {
      toast.error('Ngưỡng cảnh báo tồn kho thấp không được nhỏ hơn 0');
      return;
    }
    setSavingGeneral(true);
    try {
      const saved = await updateGeneralSettings(general);
      setGeneral(saved);
      onGeneralSettingsSaved?.(saved);
      toast.success('Đã lưu cài đặt chung');
    } catch (e: any) {
      toast.error(e.message || 'Lưu cài đặt chung thất bại');
    } finally {
      setSavingGeneral(false);
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
            Cấu hình chung và kênh thông báo của hệ thống
          </p>
        </div>
        <Button onClick={load} variant="outline" disabled={loading || busy || savingGeneral}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Tải lại
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Cài đặt chung
          </CardTitle>
          <CardDescription>
            Các tuỳ chọn áp dụng cho toàn hệ thống, ảnh hưởng tới cách hiển thị và cảnh báo tồn kho.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Đang tải...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="language" className="flex items-center gap-1.5">
                    <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                    Ngôn ngữ
                  </Label>
                  <Select
                    value={general.language}
                    onValueChange={(v) => setGeneral((prev) => ({ ...prev, language: v }))}
                    disabled={savingGeneral}
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vi">Tiếng Việt</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Giao diện hiện tại chỉ hỗ trợ Tiếng Việt — lựa chọn này sẽ được dùng khi tính năng
                    đa ngôn ngữ hoàn thiện.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold" className="flex items-center gap-1.5">
                    <PackageMinus className="h-3.5 w-3.5 text-muted-foreground" />
                    Ngưỡng cảnh báo tồn kho thấp
                  </Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min={0}
                    step={1}
                    value={general.lowStockThreshold}
                    onChange={(e) => {
                      // A number input hands back '' for empty/invalid text; Number()
                      // maps that to 0, and the guard covers any remaining NaN so the
                      // field stays controlled and the server never receives NaN.
                      const n = Number(e.target.value);
                      setGeneral((prev) => ({
                        ...prev,
                        lowStockThreshold: Number.isFinite(n) ? n : 0,
                      }));
                    }}
                    disabled={savingGeneral}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sản phẩm có tồn kho dưới mức này sẽ được đánh dấu “Tồn kho thấp” trên Dashboard và
                    Tồn kho, đồng thời gửi thông báo Telegram nếu bật ở dưới.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button onClick={handleSaveGeneral} disabled={savingGeneral}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingGeneral ? 'Đang lưu...' : 'Lưu cài đặt chung'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            Cấu hình Bot Telegram
          </CardTitle>
          <CardDescription>
            Nhận thông báo tự động khi có nhân sự mới, yêu cầu đổi mật khẩu, yêu cầu cấp quyền, hoặc
            tồn kho xuống dưới ngưỡng.
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
