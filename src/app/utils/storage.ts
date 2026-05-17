import { InventoryData, User } from '../types';

const STORAGE_KEYS = {
  INVENTORY: 'inventory_data',
  USER: 'current_user',
};

export const saveInventoryData = (data: InventoryData) => {
  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(data));
};

export const loadInventoryData = (): InventoryData => {
  const data = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  if (data) {
    const parsed = JSON.parse(data);
    // Convert date strings back to Date objects
    parsed.transactions = parsed.transactions.map((t: any) => ({
      ...t,
      date: new Date(t.date),
    }));
    return parsed;
  }
  return { products: [], transactions: [] };
};

export const saveCurrentUser = (user: User | null) => {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
};

export const loadCurrentUser = (): User | null => {
  const data = localStorage.getItem(STORAGE_KEYS.USER);
  return data ? JSON.parse(data) : null;
};
