import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/lib/lineAccountManagement.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.VITE_ENABLE_LINE_LOGIN':'"true"','import.meta.env.VITE_ENABLE_LINE_LINKING':'"true"'}});
const {disconnectLINELogin,stopLINENotifications,hasEmailLogin}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const line={provider:'custom:line',identity_id:'own-line-identity'};
const email={provider:'email',identity_id:'own-email-identity'};
const user={id:'member',email:'member@example.test',email_confirmed_at:'2026-10-28',identities:[email,line]};
let current,preferences,unlinked,writes,filters,readError,unlinkError,missing;
const client={
 auth:{
  getUser:async()=>({data:{user:current},error:null}),
  unlinkIdentity:async identity=>{assert.equal(identity,line);unlinked++;return {error:unlinkError}},
 },
 from(table){assert.equal(table,'user_profiles');filters=[];let patch=null;
  return {
   select(columns){assert.equal(columns,'notification_email_enabled,notification_line_enabled');return this},
   update(values){patch=values;return this},
   eq(key,value){filters.push([key,value]);return this},
   async maybeSingle(){
    assert.deepEqual(filters,[['id','member']]);
    if(readError)return {data:null,error:readError};
    if(missing)return {data:null,error:null};
    if(patch){writes.push(patch);Object.assign(preferences,patch)}
    return {data:{...preferences},error:null};
   }
  };
 }
};
function reset(){current={...user,identities:[email,line]};preferences={notification_email_enabled:true,notification_line_enabled:false};unlinked=0;writes=[];readError=null;unlinkError=null;missing=false;}
const rejects=code=>error=>error.code===code;
reset();assert.equal(hasEmailLogin(current),true);await disconnectLINELogin(client,'member');assert.equal(unlinked,1);assert.deepEqual(writes,[]);
reset();current.identities=[line];await assert.rejects(()=>disconnectLINELogin(client,'member'),rejects('emailRequired'));assert.equal(unlinked,0);
reset();current.email_confirmed_at=null;await assert.rejects(()=>disconnectLINELogin(client,'member'),rejects('emailRequired'));assert.equal(unlinked,0);
reset();current.id='other-member';await assert.rejects(()=>disconnectLINELogin(client,'member'),rejects('sessionChanged'));assert.equal(unlinked,0);
reset();preferences.notification_line_enabled=true;await assert.rejects(()=>disconnectLINELogin(client,'member'),rejects('stopNotificationsFirst'));assert.equal(unlinked,0);assert.deepEqual(writes,[]);
reset();preferences.notification_email_enabled=false;await assert.rejects(()=>disconnectLINELogin(client,'member'),rejects('stopNotificationsFirst'));assert.equal(unlinked,0);
reset();missing=true;await assert.rejects(()=>disconnectLINELogin(client,'member'),rejects('profileUnavailable'));assert.equal(unlinked,0);
reset();readError=new Error('offline');await assert.rejects(()=>disconnectLINELogin(client,'member'),/offline/);assert.equal(unlinked,0);
reset();unlinkError=new Error('server rejected');await assert.rejects(()=>disconnectLINELogin(client,'member'),/server rejected/);
reset();current.identities=[email];await disconnectLINELogin(client,'member');assert.equal(unlinked,0);
reset();preferences={notification_email_enabled:false,notification_line_enabled:true};await stopLINENotifications(client,'member');assert.deepEqual(writes,[{notification_email_enabled:true,notification_line_enabled:false}]);assert.equal(unlinked,0);await disconnectLINELogin(client,'member');assert.equal(unlinked,1);
reset();current.email_confirmed_at=null;await assert.rejects(()=>stopLINENotifications(client,'member'),rejects('emailRequired'));assert.deepEqual(writes,[]);
reset();missing=true;await assert.rejects(()=>stopLINENotifications(client,'member'),rejects('profileUnavailable'));
console.log('LINE account management passed: verified alternate login, fresh user/owner checks, persisted preferences, explicit stop-before-unlink, minimal writes, missing-profile and API failures.');

const {transform}=await import('esbuild');
const {readFile}=await import('node:fs/promises');
const source=(await readFile('src/components/LINEAccountManagement.tsx','utf8')).replace(/^import .*;\n/gm,'');
const js=(await transform(source,{loader:'tsx',format:'cjs',jsxFactory:'ui',jsxFragment:'Fragment'})).code;
let hookIndex=0,state=[],disconnected=0,stopped=0;const busyChanges=[];
const helpers=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const officialSource=(await readFile('src/lib/lineOfficialAccount.ts','utf8')).replace(/^import .*;\n/gm,'');
const officialJS=(await transform(officialSource,{loader:'ts',format:'cjs'})).code;
const officialModule={exports:{}};
new Function('module','exports',officialJS)(officialModule,officialModule.exports);
const accountURL=officialModule.exports.LINE_OFFICIAL_ACCOUNT_URL;
assert.equal(accountURL,'https://line.me/R/ti/p/%40jokotoday','Use the account-specific desktop QR/mobile profile route, not oaMessage');
const bindings={
 useState(initial){const i=hookIndex++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=value}]},
 supabase:client,hasVerifiedEmail:u=>Boolean(u?.email&&u?.email_confirmed_at),
 LINE_OFFICIAL_ACCOUNT_URL:accountURL,
 ...helpers,
 ui:(type,props,...children)=>({type,props:props??{},children}),Fragment:'fragment',
};
const module={exports:{}};
new Function('module','exports',...Object.keys(bindings),js)(module,module.exports,...Object.values(bindings));
const props={user,linked:true,language:'en',disabled:false,onBusyChange:v=>busyChanges.push(v),onDisconnected:async()=>{disconnected++},onNotificationsStopped:()=>{stopped++}};
function render(p=props){hookIndex=0;return module.exports.LINEAccountManagement(p)}
function nodes(node,predicate){if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...(node.children??[]).flatMap(child=>nodes(child,predicate))]}
const button=(tree,label)=>nodes(tree,node=>node.type==='button'&&node.children.includes(label))[0];
reset();let tree=render();button(tree,'Disconnect LINE login').props.onClick();assert.equal(unlinked,0,'Opening confirmation cannot unlink');
tree=render();button(tree,'Cancel').props.onClick();assert.equal(unlinked,0,'Cancel cannot unlink');
tree=render();button(tree,'Disconnect LINE login').props.onClick();tree=render();button(tree,'Disconnect LINE login').props.onClick();await new Promise(setImmediate);
assert.equal(unlinked,1);assert.equal(disconnected,1);assert.deepEqual(busyChanges,[true,false]);
assert.ok(nodes(render(),n=>n.props.role==='status').length);
state=[];tree=render({...props,user:{...user,identities:[line]}});
assert.equal(button(tree,'Disconnect LINE login').props.disabled,true,'LINE-only account has no disconnect action');
const link=nodes(tree,n=>n.type==='a')[0];assert.equal(link.props.href,bindings.LINE_OFFICIAL_ACCOUNT_URL);assert.equal(link.props.target,'_blank');
reset();state=[];tree=render();button(tree,'Stop LINE notifications').props.onClick();await new Promise(setImmediate);assert.equal(stopped,1);assert.equal(unlinked,0);
const stopConfirmation=nodes(render(),n=>n.props.role==='status')[0];assert.ok(stopConfirmation,'Show a visible saved confirmation after stopping notifications');assert.equal(stopConfirmation.props['aria-live'],'polite');
console.log('Real component interaction tests passed: confirmation, cancel, disconnect, LINE-only gate, separate notifications and external friendship link.');
