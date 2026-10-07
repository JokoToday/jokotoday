import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
globalThis.window = {
  localStorage,
  sessionStorage,
  dispatchEvent() {},
};
globalThis.localStorage = localStorage;
globalThis.sessionStorage = sessionStorage;

const bundled = await build({
  entryPoints: ['src/lib/lineOfficialAccount.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const helper = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);

assert.equal(helper.LINE_OFFICIAL_ACCOUNT_ID, '@jokotoday');
assert.match(helper.LINE_OFFICIAL_ACCOUNT_URL, /^https:\\/\\/line\\.me\\/R\\/ti\\/p\\/%40jokotoday$/);

let seenAuthorization = '';
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://api.line.me/friendship/v1/status');
  seenAuthorization = options?.headers?.Authorization || '';
  return { ok: true, json: async () => ({ friendFlag: false }) };
};

const token = 'test-provider-token-never-store';
let status = await helper.refreshLINEFriendshipStatus(token, 'user-1');
assert.equal(status, 'not_friend');
assert.equal(seenAuthorization, 'Bearer ' + token);
assert.equal(helper.getCachedLINEFriendshipStatus('user-1'), 'not_friend');
assert.ok(!JSON.stringify([...localStorage.map.entries()]).includes(token));
assert.ok(!JSON.stringify([...sessionStorage.map.entries()]).includes(token));

assert.equal(helper.queueLINEFriendInvite('user-1', status), true);
assert.equal(helper.hasPendingLINEFriendInvite('user-1'), true);
helper.dismissLINEFriendInvite('user-1');
assert.equal(helper.hasPendingLINEFriendInvite('user-1'), false);
assert.equal(helper.shouldOfferLINEFriendInvite('user-1', 'not_friend'), false);

globalThis.fetch = async () => ({ ok: true, json: async () => ({ friendFlag: true }) });
status = await helper.refreshLINEFriendshipStatus('second-provider-token', 'user-2');
assert.equal(status, 'friend');
assert.equal(helper.queueLINEFriendInvite('user-2', status), false);

const source = (path) => readFileSync(path, 'utf8');
const helperSource = source('src/lib/lineOfficialAccount.ts');
const callback = source('src/pages/AuthCallbackPage.tsx');
const profile = source('src/pages/MyProfilePage.tsx');
const prompt = source('src/components/LINEFriendInvite.tsx');
const app = source('src/App.tsx');

assert.match(helperSource, /friendship\/v1\/status/);
assert.match(helperSource, /Bearer \$\{providerToken\}/);
assert.doesNotMatch(helperSource, /setItem\([^\n]*providerToken/);
assert.match(callback, /session\.provider_token/);
assert.match(callback, /queueLINEFriendInvite\(userId, friendshipStatus\)/);
assert.match(profile, /JOKO Today Official Account/);
assert.match(profile, /LINE_OFFICIAL_ACCOUNT_URL/);
assert.match(profile, /lineFriendship === 'friend'/);
assert.match(prompt, /Not now/);
assert.match(prompt, /window\.open\(LINE_OFFICIAL_ACCOUNT_URL/);
assert.match(app, /<LINEFriendInvite \/>/);

console.log('LINE Official Account friendship conversion contract: passed.');
