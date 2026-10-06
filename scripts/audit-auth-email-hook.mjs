import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: ['supabase/functions/_shared/auth-email-routing.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { recipientsForAuthEmail } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);

const evt = (user, emailData) => ({ user, email_data: emailData });
const action = (type, extra = {}) => ({
  email_action_type: type,
  token: 'old-otp',
  token_hash: 'new-hash',
  token_new: 'new-otp',
  token_hash_new: 'old-hash',
  redirect_to: 'https://private.example/auth/callback',
  site_url: 'https://example.test',
  ...extra,
});

// Email-less LINE-only user: single email to the NEW address. Never
// send to a nonexistent old user.email or route to the opaque LINE ID.
const line = evt(
  { id: 'line-only', email: null, new_email: 'new@example.test' },
  action('email_change', { token: '', token_hash_new: '', token_new: '' }),
);
assert.deepEqual(recipientsForAuthEmail(line), [{
  address: 'new@example.test',
  token: '',
  tokenHash: 'new-hash',
  audience: 'email_change_new',
}]);

// Secure email-change setting: BOTH addresses, with INVERTED hash mapping.
const secure = evt(
  { id: 'existing', email: 'old@example.test', new_email: 'new@example.test' },
  action('email_change'),
);
assert.deepEqual(recipientsForAuthEmail(secure), [
  { address: 'old@example.test', token: 'old-otp', tokenHash: 'old-hash', audience: 'email_change_current' },
  { address: 'new@example.test', token: 'new-otp', tokenHash: 'new-hash', audience: 'email_change_new' },
]);

// With secure change OFF: only the new address.
const insecure = evt(
  { id: 'existing', email: 'old@example.test', new_email: 'new@example.test' },
  action('email_change', { token_new: '', token_hash_new: '' }),
);
assert.deepEqual(recipientsForAuthEmail(insecure), [{
  address: 'new@example.test', token: 'old-otp', tokenHash: 'new-hash', audience: 'email_change_new',
}]);

for (const type of ['signup', 'magiclink']) {
  const user = evt({ id: 'email-user', email: 'existing@example.test' }, action(type));
  assert.deepEqual(recipientsForAuthEmail(user), [{
    address: 'existing@example.test', token: 'old-otp',
    tokenHash: 'new-hash', audience: 'standard',
  }]);
  assert.throws(() => recipientsForAuthEmail(evt(user.user, action(type, { token: '' }))));
}

for (const invalid of [
  evt({ id: 'line-only', email: null, new_email: '' }, action('email_change')),
  evt({ id: 'line-only', email: null, new_email: 'new@example.test' }, action('email_change', { token_hash: '' })),
  evt({ id: 'email-user', email: null }, action('magiclink')),
  evt({ id: 'email-user', email: 'old@example.test' }, action('magiclink', { token_hash: '' })),
]) {
  assert.throws(() => recipientsForAuthEmail(invalid));
}

const hook = readFileSync('supabase/functions/send-auth-email/index.ts', 'utf8');
assert.match(hook, /wh\.verify\(rawBody, headers\)/);
assert.match(hook, /recipientsForAuthEmail\(payload\)/);
assert.match(hook, /recipient\.tokenHash/);
assert.match(hook, /recipient\.address/);
assert.match(hook, /recipient\.audience/);
assert.match(hook, /email_action_type === "recovery"/);
assert.match(hook, /emailError/);
assert.doesNotMatch(hook, /!user\?\.email/);
assert.doesNotMatch(hook, /to: user\.email/);
assert.doesNotMatch(hook, /console\.(?:log|error)\([^\n]+(?:recipient\.address|newEmail)/);
console.log('Auth Send Email Hook: routing and safety contracts passed.');
