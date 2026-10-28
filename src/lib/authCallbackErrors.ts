import type { Language } from '../translations';

export type OAuthCallbackFailure = 'failed' | 'lineAlreadyLinked';

export function oauthCallbackFailure(
  search: URLSearchParams, hash: URLSearchParams, isRecentLINELink: boolean,
): OAuthCallbackFailure | null {
  const failed = ['error', 'error_code'].some(key => search.has(key) || hash.has(key));
  if (!failed) return null;
  const code = search.get('error_code') || hash.get('error_code');
  return isRecentLINELink && code === 'identity_already_exists' ? 'lineAlreadyLinked' : 'failed';
}

export function lineIdentityConflictMessage(language: Language): string {
  return language === 'th'
    ? 'บัญชี LINE นี้เชื่อมต่อกับบัญชี JOKO อื่นอยู่แล้ว จึงเชื่อมต่อกับบัญชีนี้ไม่ได้ คุณยังเข้าสู่ระบบบัญชีนี้ด้วยอีเมลได้ บัญชีจะไม่ถูกรวมเข้าด้วยกัน'
    : language === 'zh'
      ? '此 LINE 账号已关联到另一个 JOKO 账号，无法再关联到当前账号。您仍可使用邮箱登录当前账号。两个账号不会合并。'
      : 'This LINE account is already connected to another JOKO account and cannot be connected to this one. You can still sign in to this account with email. The accounts have not been merged.';
}
