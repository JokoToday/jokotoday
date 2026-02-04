export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

export const ADMIN_SESSION_KEY = 'admin_session_authorized';

export const isAdminAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
};

export const setAdminAuthenticated = (): void => {
  localStorage.setItem(ADMIN_SESSION_KEY, 'true');
};

export const clearAdminAuthentication = (): void => {
  localStorage.removeItem(ADMIN_SESSION_KEY);
};
