import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build,transform} from 'esbuild';
const result=await build({entryPoints:['src/lib/authCallbackErrors.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const helpers=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const empty=new URLSearchParams();
const conflict=new URLSearchParams('error=server_error&error_code=identity_already_exists');
assert.equal(helpers.oauthCallbackFailure(conflict,empty,true),'lineAlreadyLinked');
assert.equal(helpers.oauthCallbackFailure(empty,conflict,true),'lineAlreadyLinked');
assert.equal(helpers.oauthCallbackFailure(conflict,empty,false),'failed');
assert.equal(helpers.oauthCallbackFailure(new URLSearchParams('error_code=identity_already_exists'),empty,true),'lineAlreadyLinked');
assert.equal(helpers.oauthCallbackFailure(new URLSearchParams('error=access_denied&error_description=identity_already_exists'),empty,true),'failed');
assert.equal(helpers.oauthCallbackFailure(new URLSearchParams('error_code=unknown'),empty,true),'failed');
assert.equal(helpers.oauthCallbackFailure(new URLSearchParams('code=valid'),empty,true),null);
for(const lang of ['en','th','zh'])assert.ok(helpers.lineIdentityConflictMessage(lang).length>50);

// Execute the real callback component's failure path. No auth, profile write,
// session exchange, auto-redirect or account merge may run for a conflict.
const source=(await readFile('src/pages/AuthCallbackPage.tsx','utf8')).replace(/^import .*;\n/gm,'');
const js=(await transform(source,{loader:'tsx',format:'cjs',jsxFactory:'ui',jsxFragment:'Fragment'})).code;
let errorKind=null,refIndex=0;const refs=[],effects=[],navigation=[],timers=[],removed=[];
const noAuth=new Proxy({}, {get(){throw new Error('Auth must not be used after callback failure')}});
const bindings={
 useState:()=>[errorKind,value=>{errorKind=value}],
 useEffect:effect=>effects.push(effect),
 useRef:value=>refs[refIndex++]??(refs[refIndex-1]={current:value}),
 useLanguage:()=>({language:'en',setLanguage(){}}),
 useAuth:()=>({refreshProfile(){throw new Error('Profile must not be updated')}}),
 supabase:noAuth,
 window:{location:{search:'?'+conflict,hash:''},history:{replaceState(){}},setTimeout(){timers.push(true)}},
 document:{title:'Test'},
 sessionStorage:{getItem:()=>JSON.stringify({destination:'profile',startedAt:Date.now()}),removeItem:key=>removed.push(key)},
 LINE_OAUTH_DESTINATION_KEY:'jt_line_oauth_destination',
 ...helpers,
 ui:(type,props,...children)=>({type,props:props??{},children}),
 Fragment:'fragment',
};
const module={exports:{}};
new Function('module','exports',...Object.keys(bindings),js)(module,module.exports,...Object.values(bindings));
module.exports.AuthCallbackPage({onNavigate:page=>navigation.push(page)});
for(const effect of effects)effect();
assert.equal(errorKind,'lineAlreadyLinked');assert.equal(timers.length,0);assert.equal(navigation.length,0);
assert.ok(removed.includes('jt_line_oauth_destination'));
refIndex=0;
const rendered=module.exports.AuthCallbackPage({onNavigate:page=>navigation.push(page)});
function findButton(node){if(!node||typeof node!=='object')return null;if(node.type==='button')return node;for(const child of node.children??[]){const found=findButton(child);if(found)return found}return null;}
const button=findButton(rendered);assert.ok(button,'Explicit return action required');button.props.onClick();
assert.deepEqual(navigation,['profile']);
console.log('LINE linking error tests passed: query/hash codes, unknown/cancelled failures, localized copy and real callback failure path without auth side effects.');
