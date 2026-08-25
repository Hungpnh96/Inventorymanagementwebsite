const STORAGE_KEYS = {
  TOKEN: 'auth_token',
};

export const saveToken = (token: string | null) => {
  if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  else localStorage.removeItem(STORAGE_KEYS.TOKEN);
};

export const loadToken = (): string | null =>
  localStorage.getItem(STORAGE_KEYS.TOKEN);
