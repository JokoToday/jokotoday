// Live test: isolated JOKO Specials Test only. Credentials remain in memory.
// Creates disposable auth/gallery fixtures and removes only those fixture IDs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { build } from 'esbuild';
const ref = 'szijiljpasxddzgzckra', url = 'https://' + ref + '.supabase.co';
const management = (await readFile('/home/nerd/.supabase/access-token', 'utf8')).trim();
const response = await fetch('https://api.supabase.com/v1/projects/' + ref + '/api-keys', {headers:{Authorization:'Bearer '+management}});
assert.equal(response.status, 200, 'Test key lookup failed');
const keys = await response.json();
const key = name => keys.find(item => item.name === name)?.api_key;
assert.ok(key('anon') && key('service_role'));
const client = role => createClient(url, key(role), {auth:{persistSession:false, autoRefreshToken:false}});
const admin = client('service_role'), anon = client('anon'), memberA = client('anon'), memberB = client('anon');
const checked = result => { assert.equal(result.error, null, 'Test operation failed: ' + result.error?.code); return result.data; };
const suffix = randomUUID().replaceAll('-', '').slice(0,18);
const password = randomUUID()+randomUUID();
const users = [], clients = [memberA, memberB]; let episodeId;
const inject = {name:'test-client', setup(b) {
  b.onResolve({filter:/^\.\/supabase$/}, () => ({path:'supabase', namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'}, () => ({loader:'js',contents:'export const supabase = {from:(...a)=>globalThis.__SMILE_TEST_CLIENT__.from(...a),rpc:(...a)=>globalThis.__SMILE_TEST_CLIENT__.rpc(...a)}'}));
}};
async function bundle(path) {
  const result = await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node',plugins:[inject]});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const likes = await bundle('src/lib/smileLikesService.ts');
const catalog = await bundle('src/lib/smileCatalog.ts');
try {
  for (let i=0;i<2;i++) {
    const email='smile-test-'+suffix+'-'+i+'@example.test';
    const user = checked(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:'SMILE test fixture',public_nickname:'smile_'+suffix+'_'+i}})).user;
    users.push({id:user.id,email});
    checked(await clients[i].auth.signInWithPassword({email,password}));
  }
  const episode = checked(await admin.from('site_gallery_items').insert({
    site_key:'joko-today', category:'joko-smile',media_type:'video', media_url:'/smile-test-fixture.webm',
    title_en:'Disposable SMILE API test '+suffix, caption_en:'Automated test fixture; not a released episode.',
    is_published:true, show_on_homepage:false, sort_order:99999
  }).select('id').single());
  episodeId = episode.id;
  globalThis.__SMILE_TEST_CLIENT__ = memberA;
  await likes.setSmileLike(users[0].id, episodeId, true);
  await likes.setSmileLike(users[0].id, episodeId, true);
  assert.ok((await likes.getLikedSmileIds(users[0].id)).includes(episodeId));
  assert.equal((await likes.getSmileLikeCounts())[episodeId], 1);
  globalThis.__SMILE_TEST_CLIENT__ = memberB;
  assert.deepEqual(checked(await memberB.from('smile_episode_likes').select('user_id').eq('episode_id',episodeId)), []);
  const spoof = await memberB.from('smile_episode_likes').insert({user_id:users[0].id,episode_id:episodeId});
  assert.ok(spoof.error, 'Cross-account write must fail');
  await likes.setSmileLike(users[1].id,episodeId,true);
  globalThis.__SMILE_TEST_CLIENT__ = anon;
  assert.equal((await likes.getSmileLikeCounts())[episodeId],2);
  assert.ok((await anon.from('smile_episode_likes').select('user_id')).error, 'Anonymous raw likes must fail');

  // New authenticated client simulates a reload/new login; favorite comes from saved server state.
  const reloaded = client('anon'); clients.push(reloaded);
  checked(await reloaded.auth.signInWithPassword({email:users[0].email,password}));
  globalThis.__SMILE_TEST_CLIENT__ = reloaded;
  const saved = await likes.getLikedSmileIds(users[0].id);
  const favoriteEpisodes = (await catalog.getSmileEpisodes()).filter(item => saved.includes(item.id));
  assert.ok(favoriteEpisodes.some(item => item.id === episodeId), 'Published saved episode missing from Favorites data');
  await likes.setSmileLike(users[0].id,episodeId,false);
  assert.ok(!(await likes.getLikedSmileIds(users[0].id)).includes(episodeId), 'Unlike failed');
  assert.equal((await likes.getSmileLikeCounts())[episodeId],1);
  globalThis.__SMILE_TEST_CLIENT__ = memberB;
  assert.ok((await likes.getLikedSmileIds(users[1].id)).includes(episodeId), 'Other account favorite was removed');
  checked(await admin.from('site_gallery_items').update({is_published:false}).eq('id',episodeId));
  assert.ok(!(episodeId in await likes.getSmileLikeCounts()), 'Draft count exposed');
  assert.ok(!(await catalog.getSmileEpisodes()).some(item => item.id === episodeId), 'Draft episode exposed');
  globalThis.__SMILE_TEST_CLIENT__ = memberA;
  await assert.rejects(() => likes.setSmileLike(users[0].id,episodeId,true), 'Draft like must fail');
  globalThis.__SMILE_TEST_CLIENT__ = memberB;
  await likes.setSmileLike(users[1].id,episodeId,false);
  assert.ok(!(await likes.getLikedSmileIds(users[1].id)).includes(episodeId));
  console.log('PASS: live authenticated like, duplicate no-op, public count, account isolation, new-session persistence, Favorites data resolution, unlike and unpublished episode protection.');
} finally {
  delete globalThis.__SMILE_TEST_CLIENT__;
  for (const member of clients) await member.auth.signOut();
  if (episodeId) checked(await admin.from('site_gallery_items').delete().eq('id',episodeId));
  for (const user of users) checked(await admin.auth.admin.deleteUser(user.id));
  console.log('Disposable SMILE episode/accounts removed; production unchanged.');
}
