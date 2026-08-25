import { InventoryData, Product, Transaction, User } from '../types';
import { loadToken } from './storage';

const BASE = '/api';

function authHeaders(): HeadersInit {
  const t = loadToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function reviveDates(data: InventoryData): InventoryData {
  return {
    ...data,
    transactions: data.transactions.map((t) => ({ ...t, date: new Date(t.date) })),
  };
}

function normalize<T = any>(input: any): T {
  if (Array.isArray(input)) return input.map(normalize) as any;
  if (input && typeof input === 'object') {
    const out: any = {};
    for (const k of Object.keys(input)) {
      const nk = k.charAt(0).toLowerCase() + k.slice(1);
      out[nk] = normalize(input[k]);
    }
    return out;
  }
  return input;
}

async function readError(res: Response): Promise<string> {
  // Prefer server-supplied human message; fall back to status-coded heuristic so a 500/403
  // with empty body still surfaces something actionable.
  try {
    const body = await res.json();
    if (body && typeof body === 'object' && (body.error || body.title)) {
      return body.error || body.title;
    }
  } catch {
    // ignore — body not JSON or empty
  }
  switch (res.status) {
    case 400: return 'Yêu cầu không hợp lệ';
    case 401: return 'Phiên đăng nhập đã kết thúc';
    case 403: return 'Không có quyền thực hiện hành động này';
    case 404: return 'Không tìm thấy';
    case 409: return 'Dữ liệu xung đột (có thể đã tồn tại)';
    case 423: return 'Tài khoản đang bị khoá';
    case 429: return 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
    case 503: return 'Dịch vụ tạm thời không khả dụng';
    default: return res.status >= 500 ? `Lỗi máy chủ (HTTP ${res.status})` : `HTTP ${res.status}`;
  }
}

// ---------- Auth ----------
export interface LoginResult {
  token: string;
  user: User;  // now carries permissions matrix
  mustChangePassword: boolean;
  expiresInSeconds: number;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error('Sai username hoặc password');
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<any>(await res.json());
  return {
    token: body.token,
    user: {
      username: body.username,
      role: body.role as 'admin' | 'user',
      permissions: body.permissions,
    },
    mustChangePassword: !!body.mustChangePassword,
    expiresInSeconds: body.expiresInSeconds ?? 0,
  };
}

export async function fetchMe(): Promise<{ user: User; mustChangePassword: boolean } | null> {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<any>(await res.json());
  return {
    user: {
      username: body.username,
      role: body.role as 'admin' | 'user',
      permissions: body.permissions,
    },
    mustChangePassword: !!body.mustChangePassword,
  };
}

export async function logout(): Promise<void> {
  // Best-effort: server invalidates the Redis session. Client clears local token regardless.
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch {
    // Network failure should not block local logout.
  }
}

// ---------- Admin (EPIC-003 S3 + S4) ----------

export interface AdminUser {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'user';
  mustChangePassword: boolean;
  lockedUntil: string | null;
  createdAt: string;
  activeSessions: number;
}

export type PermissionMatrix = Record<string, Record<string, boolean>>;

export interface AuditRow {
  id: number;
  at: string;
  actorUserId: number | null;
  actorUsername: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export async function adminListUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${BASE}/admin/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<AdminUser[]>(await res.json());
}

export async function adminCreateUser(input: { username: string; fullName: string; role: 'admin' | 'user'; tempPassword: string }): Promise<AdminUser> {
  const res = await fetch(`${BASE}/admin/users`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: input.username, fullName: input.fullName, role: input.role, tempPassword: input.tempPassword }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<AdminUser>(await res.json());
}

export async function adminUpdateUser(id: number, input: { fullName: string }): Promise<AdminUser> {
  const res = await fetch(`${BASE}/admin/users/${id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: input.fullName }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<AdminUser>(await res.json());
}

export async function adminDeleteUser(id: number): Promise<void> {
  const res = await fetch(`${BASE}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
}

export async function adminGetPermissions(id: number): Promise<PermissionMatrix> {
  const res = await fetch(`${BASE}/admin/users/${id}/permissions`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<{ permissions: PermissionMatrix }>(await res.json());
  return body.permissions;
}

export async function adminUpdatePermissions(id: number, permissions: PermissionMatrix): Promise<PermissionMatrix> {
  const res = await fetch(`${BASE}/admin/users/${id}/permissions`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<{ permissions: PermissionMatrix }>(await res.json());
  return body.permissions;
}

export async function adminResetPassword(id: number): Promise<string> {
  const res = await fetch(`${BASE}/admin/users/${id}/reset-password`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<{ tempPassword: string }>(await res.json());
  return body.tempPassword;
}

export async function adminLogoutAll(id: number): Promise<number> {
  const res = await fetch(`${BASE}/admin/users/${id}/logout-all`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<{ sessionsRevoked: number }>(await res.json());
  return body.sessionsRevoked;
}

export async function adminQueryAudit(params: Partial<{ from: string; to: string; actor: string; action: string; resourceType: string; resourceId: string; limit: number; cursor: string }>): Promise<{ rows: AuditRow[]; nextCursor: string | null; truncated: boolean }> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  }
  const res = await fetch(`${BASE}/admin/audit?${q.toString()}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  return normalize(await res.json());
}

export async function requestPasswordReset(username: string, reason: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/password-reset-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, reason }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/change-password`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

// ---------- Inventory ----------
export async function fetchInventory(): Promise<InventoryData> {
  const res = await fetch(`${BASE}/inventory`, { headers: authHeaders() });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(await readError(res));
  return reviveDates(normalize(await res.json()));
}

export async function importInventoryXlsx(_user: User, file: File): Promise<InventoryData> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/inventory/import`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  if (res.status === 403) throw new Error('Chỉ admin mới được phép import');
  if (!res.ok) throw new Error(await readError(res));
  const body = await res.json();
  return reviveDates(normalize(body.data));
}

export async function deleteProduct(_user: User, sku: string): Promise<InventoryData> {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(sku)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 403) throw new Error('Chỉ admin mới được phép xoá sản phẩm');
  if (!res.ok) throw new Error(await readError(res));
  return reviveDates(normalize(await res.json()));
}

export async function replaceProducts(_user: User, products: Product[]): Promise<InventoryData> {
  const res = await fetch(`${BASE}/products`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(products),
  });
  if (res.status === 403) throw new Error('Chỉ admin mới có quyền chỉnh sửa danh mục');
  if (!res.ok) throw new Error(await readError(res));
  return reviveDates(normalize(await res.json()));
}

/**
 * Update a single product. When ton_kho changes, the server records an adjustment
 * transaction so the change is visible in Báo cáo/Lịch sử.
 */
export async function updateProduct(
  _user: User,
  sku: string,
  product: Product,
): Promise<{ data: InventoryData; adjustment: Transaction | null }> {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (res.status === 403) throw new Error('Chỉ admin mới được phép sửa sản phẩm');
  if (!res.ok) throw new Error(await readError(res));
  const body = await res.json();
  const norm = normalize<any>(body);
  return {
    data: reviveDates(norm.data),
    adjustment: norm.adjustment
      ? { ...norm.adjustment, date: new Date(norm.adjustment.date) }
      : null,
  };
}

export async function fetchPriceHistory(sku: string): Promise<import('../types').PriceHistoryRow[]> {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(sku)}/price-history`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const raw = normalize<any[]>(await res.json());
  return raw.map((r) => ({ ...r, date: new Date(r.date) }));
}

export async function postTransaction(
  _user: User,
  payload: {
    maSKU: string;
    tenSanPham: string;
    type: 'import' | 'export';
    quantity: number;
    note?: string;
    newProduct?: Product;
    unitPrice?: number;
  },
): Promise<{ transaction: Transaction; data: InventoryData }> {
  const res = await fetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  return {
    transaction: { ...normalize(json.transaction), date: new Date(json.transaction.date ?? json.transaction.Date) },
    data: reviveDates(normalize(json.data)),
  };
}

// ---------- Admin data management (clear + backups) ----------

export interface BackupInfo {
  fileName: string;
  createdAt: string; // ISO
  sizeBytes: number;
}

export async function adminListBackups(): Promise<BackupInfo[]> {
  const res = await fetch(`${BASE}/admin/data/backups`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<BackupInfo[]>(await res.json());
}

export async function adminClearData(confirmText: string): Promise<{ backupFile: string; data: InventoryData }> {
  const res = await fetch(`${BASE}/admin/data/clear`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmText }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<any>(await res.json());
  return { backupFile: body.backupFile, data: reviveDates(body.data) };
}

export async function adminRestoreBackup(
  fileName: string,
): Promise<{ restoredFrom: string; safetyBackup: string; data: InventoryData }> {
  const res = await fetch(`${BASE}/admin/data/backups/${encodeURIComponent(fileName)}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = normalize<any>(await res.json());
  return {
    restoredFrom: body.restoredFrom,
    safetyBackup: body.safetyBackup,
    data: reviveDates(body.data),
  };
}

export function adminBackupDownloadUrl(fileName: string): string {
  return `${BASE}/admin/data/backups/${encodeURIComponent(fileName)}/download`;
}

/**
 * Download a backup .xlsx. Auth here is a Bearer token (not a cookie), so a plain
 * anchor href would hit the endpoint unauthenticated — fetch it with headers and
 * hand the browser a blob URL instead.
 */
export async function adminDownloadBackup(fileName: string): Promise<void> {
  const res = await fetch(adminBackupDownloadUrl(fileName), { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Admin settings (Telegram) + access requests ----------

export interface TelegramSettings {
  /** Masked on read (e.g. "••••••1234") — send it back as-is to keep the stored token. */
  botToken: string;
  chatId: string;
  notifyUserCreate: boolean;
  notifyPasswordReset: boolean;
  notifyPermissionRequest: boolean;
  notifyLowStock: boolean;
}

export async function getTelegramSettings(): Promise<TelegramSettings> {
  const res = await fetch(`${BASE}/admin/settings/telegram`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<TelegramSettings>(await res.json());
}

export async function updateTelegramSettings(settings: TelegramSettings): Promise<TelegramSettings> {
  const res = await fetch(`${BASE}/admin/settings/telegram`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<TelegramSettings>(await res.json());
}

/**
 * Sends a probe message through the configured bot. Always resolves on HTTP 200 —
 * a misconfiguration comes back as `{ ok: false, error }`, not as an HTTP error.
 */
export async function testTelegramSettings(): Promise<{ ok: boolean; error: string | null }> {
  const res = await fetch(`${BASE}/admin/settings/telegram/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<{ ok: boolean; error: string | null }>(await res.json());
}

export interface GeneralSettings {
  /** Saved UI language preference. The app is Vietnamese-only today — this is a stored preference. */
  language: string;
  lowStockThreshold: number;
}

/** Readable by ANY authenticated user (not admin-gated) — the threshold drives Dashboard/Tồn kho badges. */
export async function getGeneralSettings(): Promise<GeneralSettings> {
  const res = await fetch(`${BASE}/settings/general`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<GeneralSettings>(await res.json());
}

/** Admin-only. Echoes back the saved values, so the caller can trust the response over its local draft. */
export async function updateGeneralSettings(settings: GeneralSettings): Promise<GeneralSettings> {
  const res = await fetch(`${BASE}/admin/settings/general`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(await readError(res));
  return normalize<GeneralSettings>(await res.json());
}

/**
 * Ask an admin for access to a gated menu. A 429 (same menu requested within the
 * cooldown window) surfaces the server's Vietnamese message via `readError`, so the
 * caller can toast `e.message` directly instead of a generic error.
 */
export async function requestAccess(menu: string, reason?: string): Promise<void> {
  const res = await fetch(`${BASE}/access-requests`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ menu, reason }),
  });
  if (!res.ok) throw new Error(await readError(res));
}
