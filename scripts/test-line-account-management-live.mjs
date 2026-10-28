// Runs only against the isolated test project, using a disposable email account.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {build} from 'esbuild';
const ref='szijiljpasxddzgzckra',url='https://'+ref+'.supabase.co';
const token=(await readFile('/home/nerd/.supabase/access-token','utf8')).trim();
const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/api-keys',{headers:{Authorization:'Bearer '+token}});
assert.equal(response.status,200);
const keys=await response.json(),key=name=>keys.find(item=>item.name===name)?.api_key;
assert.ok(key('service_role')&&key('anon'));
const options={auth:{persistSession:false}};
const admin=createClient(url,key('service_role'),options),member=createClient(url,key('anon'),options);
const check=({data,error})=>{assert.equal(error,null,'Test operation failed: '+error?.code);return data};
const output=await build({entryPoints:['src/lib/lineAccountManagement.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.VITE_ENABLE_LINE_LOGIN':'"true"','import.meta.env.VITE_ENABLE_LINE_LINKING':'"true"'}});
const {stopLINENotifications,disconnectLINELogin}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const suffix=randomUUID().replaceAll('-','').slice(0,16),password=randomUUID()+randomUUID();
const email='line-actions-'+suffix+'@example.test';let uid;
try {
 uid=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;
 check(await admin.from('user_profiles').update({name:'Private fixture',public_nickname:'test_'+suffix,line_id:'contact_'+suffix,notification_email_enabled:true,notification_line_enabled:true}).eq('id',uid));
 check(await member.auth.signInWithPassword({email,password}));
 await stopLINENotifications(member,uid);
 const profile=check(await member.from('user_profiles').select('name,public_nickname,line_id,notification_email_enabled,notification_line_enabled').eq('id',uid).single());
 assert.equal(profile.notification_email_enabled,true);assert.equal(profile.notification_line_enabled,false);
 assert.equal(profile.name,'Private fixture');assert.equal(profile.public_nickname,'test_'+suffix);assert.equal(profile.line_id,'contact_'+suffix);
 await assert.rejects(()=>stopLINENotifications(member,randomUUID()),error=>error.code==='sessionChanged');
 await disconnectLINELogin(member,uid); // Already disconnected is a safe no-op.
 const identities=check(await member.auth.getUserIdentities()).identities;
 assert.equal(identities.length,1);
 const blocked=await member.auth.unlinkIdentity(identities[0]);
 assert.ok(blocked.error,'Supabase must refuse removal of the last login identity');
 assert.equal(blocked.error.code,'single_identity_not_deletable');
 assert.equal(check(await member.auth.getUserIdentities()).identities.length,1);
 console.log('Live API checks passed: persisted email fallback, unchanged names/contact ID, changed-session rejection, idempotent disconnected state and server last-identity protection.');
} finally {
 if(uid){check(await admin.auth.admin.deleteUser(uid));console.log('Disposable test account removed.');}
 await member.auth.signOut();
}
