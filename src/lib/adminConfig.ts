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

  void (async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error('Admin logout failed:', error);
    }

    // Re-evaluate the authoritative Supabase session + database role gate.
    // Success returns to admin sign-in; a failed sign-out restores the still-
    // valid admin session instead of leaving the preserved CMS on a spinner.
    window.location.reload();
  })();
};
