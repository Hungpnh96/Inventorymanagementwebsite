import type { PermissionMatrix, User } from '../types';

export type MenuName = 'dashboard' | 'inventory' | 'transactions' | 'reports' | 'users';
export type ActionName = 'view' | 'create' | 'update' | 'delete';

export const MENUS: MenuName[] = ['dashboard', 'inventory', 'transactions', 'reports', 'users'];
export const ACTIONS: ActionName[] = ['view', 'create', 'update', 'delete'];

/**
 * Check whether a user has a specific permission. Admins always pass.
 *
 * Defense in depth — server is authoritative. The FE uses this only to hide
 * UI elements the user cannot use; never to make a security decision.
 */
export function hasPermission(
  user: User | null,
  menu: MenuName,
  action: ActionName,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.permissions?.[menu]?.[action] ?? false;
}

export function canViewMenu(user: User | null, menu: MenuName): boolean {
  return hasPermission(user, menu, 'view');
}
