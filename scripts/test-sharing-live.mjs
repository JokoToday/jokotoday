// Disposable test-project fixtures only. No real account data or secrets printed.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const ref='szijiljpasxddzgzckra', url='https://'+ref+'.supabase.co';
const token=(await readFile('/home/nerd/.supabase/access-token','utf8')).trim();
const response=await fetch('https://api.supabase.com/v1/projects/'+ref+'/api-keys',{headers:{Authorization:'Bearer '+token}});
assert.equal(response.status,200,'Test API-key lookup failed');
const keys=await response.json();
const key=name=>keys.find(k=>k.name===name)?.api_key;
assert.ok(key('service_role')&&key('anon'),'Test keys missing');
const admin=createClient(url,key('service_role'),{auth:{persistSession:false}});
const member=createClient(url,key('anon'),{auth:{persistSession:false}});
const check=({data,error})=>{assert.equal(error,null,'Test operation failed: '+error?.code);return data;};
const suffix=randomUUID().replaceAll('-','').slice(0,16);
const email='nickname-test-'+suffix+'@example.test', password=randomUUID()+randomUUID();
let uid;
try {
 const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 uid=user.id;
 check(await admin.from('user_profiles').update({name:'PRIVATE TEST NAME',public_nickname:'test_'+suffix}).eq('id',uid));
 check(await member.auth.signInWithPassword({email,password}));
 const collection=check(await member.from('joko_collections').insert({owner_user_id:uid,title:'Nickname disposable test'}).select('id').single());
 const session=(await member.auth.getSession()).data.session;
 async function invoke(body,owner=false){
  const r=await fetch(url+'/functions/v1/joko-collection-share',{method:'POST',headers:{'Content-Type':'application/json',apikey:key('anon'),...(owner?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body)});
  return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};
 }
 const share=await invoke({action:'create',collectionId:collection.id},true);
 assert.equal(share.status,200);
 const read=()=>invoke({action:'read',token:share.body.token});
 let result=await read();
 assert.equal(result.status,200);assert.equal(result.cache,'no-store');
 assert.equal(result.body.collector_nickname,'test_'+suffix);
 assert.deepEqual(Object.keys(result.body).sort(),['collector_nickname','description','items','title']);
 for(const privateValue of [uid,email,'PRIVATE TEST NAME'])assert.ok(!JSON.stringify(result.body).includes(privateValue),'Private field exposed');
 check(await member.from('user_profiles').update({public_nickname:'next_'+suffix}).eq('id',uid));
 assert.equal((await read()).body.collector_nickname,'next_'+suffix);
 check(await admin.from('user_profiles').update({public_nickname:null}).eq('id',uid));
 assert.equal((await read()).body.collector_nickname,null);
 assert.equal((await invoke({action:'revoke',collectionId:collection.id},true)).status,200);
 assert.equal((await read()).status,404);
 console.log('Live test passed: owner creates link; anonymous nickname-only read; nickname change; null fallback; revoked link rejected.');
} finally {
 if(uid){check(await admin.auth.admin.deleteUser(uid));console.log('Disposable test user and cascading collection fixtures removed.');}
 await member.auth.signOut();
}
