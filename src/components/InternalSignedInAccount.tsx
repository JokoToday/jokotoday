import { UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface InternalSignedInAccountProps {
  appearance?: 'light' | 'dark';
  className?: string;
  label?: string;
}

/**
 * Display-only identity hint for internal workspaces.
 * Authentication and permissions remain controlled by the existing auth context.
 */
export function InternalSignedInAccount({
  appearance = 'light',
  className = '',
  label = 'Signed in as',
}: InternalSignedInAccountProps) {
  const { user, userProfile } = useAuth();

  if (!user) return null;

  const email = user.email?.trim() || '';
  const displayName = userProfile?.name?.trim() || email || 'Account';
  const showEmail = Boolean(email && displayName.toLowerCase() !== email.toLowerCase());
  const dark = appearance === 'dark';

  return (
    <div
      className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 ${dark
        ? 'border-white/25 bg-white/10 text-white'
        : 'border-[#55766F]/20 bg-[#FFF9EE]/70 text-[#303532]'} ${className}`}
      aria-label={`${label}: ${displayName}${showEmail ? `, ${email}` : ''}`}
      title={showEmail ? `${displayName} — ${email}` : displayName}
    >
      <UserRound className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">{label}</p>
        <p className="max-w-[12rem] truncate text-xs font-semibold">{displayName}</p>
        {showEmail && (
          <p className="max-w-[12rem] truncate text-[11px] opacity-70">{email}</p>
        )}
      </div>
    </div>
  );
}
