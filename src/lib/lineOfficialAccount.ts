export type LINEFriendshipStatus = 'friend' | 'not_friend' | 'unknown';

export const LINE_OFFICIAL_ACCOUNT_ID = '@jokotoday';
export const LINE_OFFICIAL_ACCOUNT_URL =
  `https://line.me/R/ti/p/${encodeURIComponent(LINE_OFFICIAL_ACCOUNT_ID)}`;

const FRIENDSHIP_ENDPOINT = 'https://api.line.me/friendship/v1/status';
const STATUS_PREFIX = 'jt_line_oa_friendship_';
const DISMISSED_PREFIX = 'jt_line_oa_friend_prompt_dismissed_';
export const LINE_FRIEND_INVITE_PENDING_KEY = 'jt_line_oa_friend_prompt_pending';
export const LINE_FRIEND_INVITE_EVENT = 'joko-line-friend-invite';
const PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

type CachedFriendship = {
  status: Exclude<LINEFriendshipStatus, 'unknown'>;
  checkedAt: number;
};

function browserStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getCachedLINEFriendshipStatus(userId: string | null | undefined): LINEFriendshipStatus {
  if (!userId) return 'unknown';
  const raw = browserStorage('local')?.getItem(`${STATUS_PREFIX}${userId}`);
  if (!raw) return 'unknown';
  try {
    const cached = JSON.parse(raw) as CachedFriendship;
    return cached.status === 'friend' || cached.status === 'not_friend' ? cached.status : 'unknown';
  } catch {
    return 'unknown';
  }
}

function cacheLINEFriendshipStatus(userId: string, status: Exclude<LINEFriendshipStatus, 'unknown'>) {
  browserStorage('local')?.setItem(
    `${STATUS_PREFIX}${userId}`,
    JSON.stringify({ status, checkedAt: Date.now() } satisfies CachedFriendship),
  );
}

export async function refreshLINEFriendshipStatus(
  providerToken: string | null | undefined,
  userId: string,
  signal?: AbortSignal,
): Promise<LINEFriendshipStatus> {
  if (!providerToken) return getCachedLINEFriendshipStatus(userId);

  try {
    // The LINE provider token is used only for this direct LINE API request.
    // Never persist it in localStorage/sessionStorage or JOKO tables.
    const response = await fetch(FRIENDSHIP_ENDPOINT, {
      method: 'GET',
      headers: { Authorization: `Bearer ${providerToken}` },
      signal,
    });
    if (!response.ok) return getCachedLINEFriendshipStatus(userId);
    const payload = await response.json() as { friendFlag?: unknown };
    if (typeof payload.friendFlag !== 'boolean') return getCachedLINEFriendshipStatus(userId);

    const status = payload.friendFlag ? 'friend' : 'not_friend';
    cacheLINEFriendshipStatus(userId, status);
    return status;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return getCachedLINEFriendshipStatus(userId);
  }
}

export function shouldOfferLINEFriendInvite(userId: string, status: LINEFriendshipStatus): boolean {
  if (status === 'friend') return false;
  const raw = browserStorage('local')?.getItem(`${DISMISSED_PREFIX}${userId}`);
  const dismissedAt = raw ? Number(raw) : 0;
  return !Number.isFinite(dismissedAt) || dismissedAt <= 0 || Date.now() - dismissedAt >= PROMPT_COOLDOWN_MS;
}

export function queueLINEFriendInvite(userId: string, status: LINEFriendshipStatus): boolean {
  if (!shouldOfferLINEFriendInvite(userId, status)) return false;
  browserStorage('session')?.setItem(LINE_FRIEND_INVITE_PENDING_KEY, userId);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LINE_FRIEND_INVITE_EVENT));
  return true;
}

export function hasPendingLINEFriendInvite(userId: string): boolean {
  return browserStorage('session')?.getItem(LINE_FRIEND_INVITE_PENDING_KEY) === userId;
}

export function clearPendingLINEFriendInvite() {
  browserStorage('session')?.removeItem(LINE_FRIEND_INVITE_PENDING_KEY);
}

export function dismissLINEFriendInvite(userId: string) {
  browserStorage('local')?.setItem(`${DISMISSED_PREFIX}${userId}`, String(Date.now()));
  clearPendingLINEFriendInvite();
}
