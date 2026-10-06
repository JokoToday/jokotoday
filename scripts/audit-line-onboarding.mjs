import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// Runtime contracts: bundle the exact TypeScript helper used by the app.
const output = await build({
  entryPoints: ['src/lib/lineProfile.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  define: {
    'import.meta.env.VITE_ENABLE_LINE_LOGIN': '"true"',
    'import.meta.env.VITE_ENABLE_LINE_LINKING': '"true"',
  },
});

const code = output.outputFiles[0].text;
const { lineDisplayName, hasVerifiedEmail, needsLINEEmailForCheckout } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const lineOnly = {
  identities: [{ provider: 'custom:line', identity_data: { name: 'JOKO via LINE', sub: 'private-id' } }],
  user_metadata: { name: 'Fallback Name' },
  email: undefined,
  email_confirmed_at: undefined,
};
const emailOnly = {
  identities: [{ provider: 'email', identity_data: { email: 'verified@example.test' } }],
  user_metadata: {},
  email: 'verified@example.test',
  email_confirmed_at: '2026-10-06T00:00:00Z',
};
assert.equal(lineDisplayName(lineOnly), 'JOKO via LINE');
assert.equal(lineDisplayName(emailOnly), '');
assert.equal(lineDisplayName({ ...lineOnly, identities: [{ provider: 'custom:line', identity_data: { sub: 'secret' } }] }), 'Fallback Name');
assert.equal(hasVerifiedEmail(lineOnly), false);
assert.equal(hasVerifiedEmail({ ...lineOnly, email: 'unverified@example.test' }), false);
assert.equal(hasVerifiedEmail(emailOnly), true);
assert.equal(needsLINEEmailForCheckout(lineOnly), true);
assert.equal(needsLINEEmailForCheckout(emailOnly), false);
assert.equal(needsLINEEmailForCheckout({ ...lineOnly, email: emailOnly.email, email_confirmed_at: emailOnly.email_confirmed_at }), false);

const get = (path) => readFileSync(path, 'utf8');
const router = get('src/pages/CheckoutRouterPage.tsx');
const v1 = get('src/pages/CheckoutPage.tsx');
const v2 = get('src/pages/CheckoutPageV2.tsx');
const email = get('src/components/EmailVerificationPanel.tsx');
const profile = get('src/pages/MyProfilePage.tsx');
const modal = get('src/components/ProfileCompletionModal.tsx');
const auth = get('src/context/AuthContext.tsx');
const callback = get('src/pages/AuthCallbackPage.tsx');
const migration = get('supabase/migrations/20261006223000_require_verified_email_for_line_checkout.sql');
assert.match(router, /needsLINEEmailForCheckout\(user\)/);
for (const code of [v1, v2]) {
  assert.match(code, /supabase\.auth\.getUser\(\)/);
  assert.match(code, /needsLINEEmailForCheckout\(verifiedAuth\.user\)/);
}
assert.match(email, /supabase\.auth\.updateUser\(/);
assert.doesNotMatch(email, /signInWithOtp|signUp\(/);
assert.match(email, /emailRedirectTo/);
assert.match(profile, /lineDisplayName\(user\)/);
assert.match(profile, /LINE account: Connected/);
assert.match(modal, /LINE account connected/);
assert.match(auth, /hasRequiredProfileDetails\(data, hasLinkedLINE\(user\)\)/);
assert.match(callback, /!existingProfile\.name\?\.trim\(\)/);
assert.match(migration, /auth\.identities/);
assert.match(migration, /email_confirmed_at IS NOT NULL/);
assert.match(migration, /BEFORE INSERT ON public\.orders/);
assert.doesNotMatch(migration, /NEW\.purchase_type IS DISTINCT FROM/);

console.log('LINE Onboarding v1.1 contract checks passed.');
