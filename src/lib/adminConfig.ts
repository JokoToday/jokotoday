import { supabase } from './supabase';

// Legacy compatibility shim for the preserved CMS component during the
// Stage 1 admin-auth migration. Authorization is now decided by AdminPage
// from the authenticated Supabase session + user_profiles.role === 'admin'.
let adminSessionAuthorized = false;

// The browser password path is intentionally disabled.
export const ADMIN_PASSWORD = '__ADMIN_PASSWORD_DISABLED__';

export const isAdminAuthenticated = (): boolean => adminSessionAuthorized;

export const setAdminAuthenticated = (): void => {
  adminSessionAuthorized = true;
};

export const resetAdminAuthentication = (): void => {
  adminSessionAuthorized = false;
};

export const clearAdminAuthentication = (): void => {
  adminSessionAuthorized = false;
  void supabase.auth.signOut();
};
