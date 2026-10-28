import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output=await build({entryPoints:['src/lib/lineProfile.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.VITE_ENABLE_LINE_LOGIN':'"true"','import.meta.env.VITE_ENABLE_LINE_LINKING':'"true"'}});
const {fillMissingLINEProfileName}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
let stored, writes, filters;
const client={from(table){
 assert.equal(table,'user_profiles');filters=[];
 return {
  update(values){writes++;this.values=values;return this},
  eq(k,v){filters.push([k,v]);return this},
  is(k,v){filters.push([k,v]);return this},
  select(columns){assert.equal(columns,'name');return this},
  async maybeSingle(){
   if(!filters.every(([k,v])=>stored[k]===v))return {data:null,error:null};
   Object.assign(stored,this.values);return {data:{name:stored.name},error:null};
  }
 };
}};
async function run(snapshot,current){
 stored={id:'member',public_nickname:'Chosen_Nick',...current};writes=0;
 const result=await fillMissingLINEProfileName(client,'member',snapshot,'Different LINE Name');
 assert.equal(stored.public_nickname,'Chosen_Nick','Nickname must never change');
 return result;
}
assert.equal(await run({name:'Email Chosen Name',profile_completed:false},{name:'Email Chosen Name',profile_completed:false}),null);assert.equal(writes,0);
assert.equal(await run({name:null,profile_completed:true},{name:null,profile_completed:true}),null);assert.equal(writes,0);
assert.equal(await run({name:null,profile_completed:false},{name:null,profile_completed:false}),'Different LINE Name');
assert.equal(await run({name:'',profile_completed:false},{name:'',profile_completed:false}),'Different LINE Name');
assert.equal(await run({name:null,profile_completed:false},{name:'Saved In Another Tab',profile_completed:false}),null);assert.equal(stored.name,'Saved In Another Tab');
assert.equal(await run({name:'',profile_completed:false},{name:'',profile_completed:true}),null);assert.equal(stored.name,'');
assert.equal(await run({name:null,profile_completed:false},{id:'another-member',name:null,profile_completed:false}),null);assert.equal(stored.name,null);
console.log('LINE name preservation: saved email name, nickname, completed profile, blank prefill, concurrent edit and owner filters passed.');
