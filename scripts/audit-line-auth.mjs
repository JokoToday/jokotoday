import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = (path) => readFileSync(path, 'utf8');
const auth = source('src/context/AuthContext.tsx');
const app = source('src/App.tsx');
const helper = source('src/lib/lineAuth.ts');
const modal = source('src/components/AuthModal.tsx');

assert.ok(auth.includes('auth.signInWithOAuth({') && auth.includes('auth.linkIdentity({'));
assert.ok(auth.includes('provider: LINE_PROVIDER'));
assert.ok(helper.includes("'custom:line'"));
assert.ok(helper.includes("VITE_ENABLE_LINE_LOGIN === 'true'"));
assert.ok(helper.includes("VITE_ENABLE_LINE_LINKING === 'true'"));
assert.ok(modal.includes('LINE_LOGIN_ENABLED'));
assert.ok(helper.includes("new URL('/auth/callback', window.location.origin)"));
assert.ok(!helper.includes('searchParams.set'));
assert.ok(auth.includes('LINE_OAUTH_DESTINATION_KEY'));
assert.ok(source('src/pages/AuthCallbackPage.tsx').includes('isRecentLINELink'));
assert.ok(source('src/pages/MyProfilePage.tsx').includes('LINE_LINKING_ENABLED'));
assert.ok(!app.includes('line_user_id'));
assert.ok(!existsSync('src/components/LineCallback.tsx'));
assert.ok(!existsSync('supabase/functions/line-callback/index.ts'));
assert.ok(!auth.includes('web.line.me/web/login'));
console.log('LINE OAuth safety contract: passed');
