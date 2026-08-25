import { ComponentType, ReactNode } from 'react';
import { Card, CardContent } from '../ui/card';
import { Sparkles } from 'lucide-react';
import { cn } from '../ui/utils';

export interface ComingSoonProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  features: { icon: ComponentType<{ className?: string }>; label: string; hint?: string }[];
  eta?: string;
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet';
}

const TONE: Record<NonNullable<ComingSoonProps['accent']>, { bg: string; ring: string; text: string }> = {
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', ring: 'ring-indigo-500/30', text: 'text-indigo-700 dark:text-indigo-300' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', ring: 'ring-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-500/15', ring: 'ring-amber-500/30', text: 'text-amber-700 dark:text-amber-300' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-500/15', ring: 'ring-rose-500/30', text: 'text-rose-700 dark:text-rose-300' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-500/15', ring: 'ring-violet-500/30', text: 'text-violet-700 dark:text-violet-300' },
};

export function ComingSoon({ icon: Icon, title, description, features, eta, accent = 'indigo' }: ComingSoonProps) {
  const tone = TONE[accent];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone.bg, tone.text)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h2>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', tone.bg, tone.text)}>
              <Sparkles className="h-3 w-3" />
              Sắp ra
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card className={cn('border-2 border-dashed', tone.ring, 'ring-1')}>
        <CardContent className="p-6 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl', tone.bg, tone.text)}>
              <Icon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Tính năng đang phát triển</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Backend cho module này chưa được tích hợp. Giao diện đã được lên kế hoạch, bạn có thể xem
              trước các tính năng dự kiến bên dưới.
            </p>
            {eta && (
              <p className={cn('mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold', tone.bg, tone.text)}>
                Dự kiến: {eta}
              </p>
            )}
          </div>

          {features.length > 0 && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => {
                const FIcon = f.icon;
                return (
                  <div key={i} className="rounded-lg border bg-card/50 p-4">
                    <div className={cn('mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md', tone.bg, tone.text)}>
                      <FIcon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-semibold">{f.label}</div>
                    {f.hint && <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Predefined stubs
import { Truck, Users, Shield, ScrollText, Settings, ClipboardCheck, Plus, Search, FileText, Mail, Phone, MapPin, Bell, Globe, Key, Lock, Eye, Activity, Filter, Download } from 'lucide-react';

export const SuppliersStub = () => (
  <ComingSoon
    icon={Truck}
    title="Nhà cung cấp"
    description="Quản lý danh sách NCC, lịch sử đặt hàng và công nợ"
    accent="indigo"
    features={[
      { icon: Plus, label: 'Tạo NCC', hint: 'Thông tin liên hệ, mã số thuế' },
      { icon: Search, label: 'Tìm kiếm nhanh', hint: 'Theo tên / mã / loại hàng' },
      { icon: FileText, label: 'Lịch sử nhập', hint: 'Phiếu nhập theo NCC' },
      { icon: Mail, label: 'Liên hệ', hint: 'Email + số điện thoại' },
      { icon: MapPin, label: 'Địa chỉ kho/showroom', hint: 'Bản đồ tích hợp' },
      { icon: Download, label: 'Xuất Excel', hint: 'Toàn bộ danh mục NCC' },
    ]}
  />
);

export const CustomersStub = () => (
  <ComingSoon
    icon={Users}
    title="Khách hàng"
    description="Hồ sơ khách + lịch sử mua hàng + công nợ phải thu"
    accent="emerald"
    features={[
      { icon: Plus, label: 'Tạo khách hàng', hint: 'Cá nhân / Doanh nghiệp' },
      { icon: Search, label: 'Tìm nhanh', hint: 'Theo SĐT / Tên / Mã KH' },
      { icon: FileText, label: 'Lịch sử mua', hint: 'Phiếu xuất theo khách' },
      { icon: Phone, label: 'Liên hệ', hint: 'SĐT + Email' },
      { icon: Activity, label: 'Phân loại', hint: 'VIP / Thường / Mới' },
      { icon: Download, label: 'Xuất danh sách', hint: 'Excel + CSV' },
    ]}
  />
);

export const RolesStub = () => (
  <ComingSoon
    icon={Shield}
    title="Phân quyền nâng cao"
    description="Quản lý Role + Permission động thay vì chỉ 2 role admin/user"
    accent="violet"
    features={[
      { icon: Plus, label: 'Tạo role mới', hint: 'Manager, Kế toán, Thủ kho...' },
      { icon: Key, label: 'Permission per resource', hint: 'CRUD trên từng menu' },
      { icon: Lock, label: 'Khoá chức năng', hint: 'Vô hiệu hóa theo role' },
      { icon: Eye, label: 'Xem quyền hiệu lực', hint: 'Effective permissions' },
      { icon: Users, label: 'Gán role hàng loạt', hint: 'Multi-select users' },
      { icon: Activity, label: 'Lịch sử thay đổi', hint: 'Audit trail' },
    ]}
  />
);

export const AuditLogStub = () => (
  <ComingSoon
    icon={ScrollText}
    title="Audit Log"
    description="Lịch sử mọi thay đổi: ai làm, lúc nào, đổi gì"
    accent="amber"
    features={[
      { icon: Filter, label: 'Lọc đa chiều', hint: 'User / Action / Date range' },
      { icon: Search, label: 'Tìm theo SKU/User', hint: 'Full-text search' },
      { icon: FileText, label: 'Before/After JSON', hint: 'Diff chi tiết' },
      { icon: Eye, label: 'IP + User-Agent', hint: 'Truy vết phiên đăng nhập' },
      { icon: Download, label: 'Xuất báo cáo', hint: 'CSV / Excel' },
      { icon: Activity, label: 'Cảnh báo bất thường', hint: 'Mass-delete detection' },
    ]}
  />
);

export const SettingsStub = () => (
  <ComingSoon
    icon={Settings}
    title="Cài đặt"
    description="Cấu hình hệ thống — đơn vị tiền tệ, ngôn ngữ, ngưỡng cảnh báo..."
    accent="rose"
    features={[
      { icon: Globe, label: 'Ngôn ngữ', hint: 'Tiếng Việt / English' },
      { icon: Bell, label: 'Cảnh báo', hint: 'Ngưỡng tồn kho thấp' },
      { icon: FileText, label: 'Template phiếu', hint: 'In nhập/xuất tuỳ chỉnh' },
      { icon: Key, label: 'API keys', hint: 'Tích hợp bên thứ 3' },
      { icon: Lock, label: 'Bảo mật', hint: '2FA, IP whitelist' },
      { icon: Download, label: 'Backup / Restore', hint: 'Lịch backup tự động' },
    ]}
  />
);

export const InventoryCheckStub = () => (
  <ComingSoon
    icon={ClipboardCheck}
    title="Kiểm kê kho"
    description="Đếm thực tế và đối chiếu với sổ sách"
    accent="emerald"
    features={[
      { icon: Plus, label: 'Tạo phiếu kiểm kê', hint: 'Toàn bộ / Theo loại / Theo SKU' },
      { icon: ClipboardCheck, label: 'Đếm trực tiếp trên app', hint: 'Quét barcode hoặc nhập tay' },
      { icon: Activity, label: 'Đối chiếu chênh lệch', hint: 'So với tồn sổ sách' },
      { icon: FileText, label: 'Phiếu điều chỉnh', hint: 'Tự sinh khi chốt' },
      { icon: Eye, label: 'Lịch sử kiểm kê', hint: 'Theo kỳ / tháng / quý' },
      { icon: Download, label: 'Xuất biên bản', hint: 'PDF / Excel' },
    ]}
  />
);
