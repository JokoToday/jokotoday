import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {transform} from 'esbuild';

const token='a'.repeat(64);
let nickname='Collector_One', revoked=false, profileError=false;
const selections=[];
const state={};
const createClient=()=>({from(table){
  return {
    select(columns){selections.push({table,columns});return this},
    eq(){return this}, order(){return this}, limit(){return Promise.resolve({data:[]})},
    async maybeSingle(){
      if(table==='joko_collection_share_links')return {data:{collection_id:'collection-id',revoked_at:revoked?'2026-01-01':null,expires_at:null}};
      if(table==='joko_collections')return {data:{id:'collection-id',owner_user_id:'private-owner-id',title:'Test collection',description:'A collection'}};
      if(table==='user_profiles')return {data:{public_nickname:nickname,name:'PRIVATE REAL NAME',email:'private@example.test',phone:'PRIVATE PHONE'},error:profileError?{message:'column unavailable'}:null};
      throw new Error('Unexpected table '+table);
    }
  };
}});
const source=(await readFile('supabase/functions/joko-collection-share/index.ts','utf8')).replace(/^import .*;\n/gm,'');
const js=(await transform(source,{loader:'ts',target:'es2022',format:'esm'})).code;
new Function('serve','createClient','Deno','crypto',js)(handler=>{state.handler=handler},createClient,{env:{get:()=> 'test'}},webcrypto);
const read=()=>state.handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'read',token})}));
let response=await read(), body=await response.json();
assert.equal(response.status,200);
assert.equal(body.collector_nickname,'Collector_One');
assert.deepEqual(Object.keys(body).sort(),['collector_nickname','description','items','title']);
for(const secret of ['PRIVATE REAL NAME','private@example.test','PRIVATE PHONE','private-owner-id'])assert.ok(!JSON.stringify(body).includes(secret));
assert.deepEqual(selections.filter(x=>x.table==='user_profiles').map(x=>x.columns),['public_nickname']);
nickname='Collector_Two';assert.equal((await (await read()).json()).collector_nickname,'Collector_Two');
nickname=null;assert.equal((await (await read()).json()).collector_nickname,null);
nickname='invalid name';assert.equal((await (await read()).json()).collector_nickname,null);
revoked=true;response=await read();assert.equal(response.status,404);
revoked=false;profileError=true;response=await read();assert.equal(response.status,503);
const ui=await readFile('src/pages/SharedCollectionPage.tsx','utf8');
assert.ok(ui.includes('collection.collector_nickname'));
assert.ok(!ui.includes('dangerouslySetInnerHTML'));
console.log('Public nickname sharing: response allowlist, current nickname, fallback, revoked token and failure tests passed.');
