import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=(await readFile('supabase/functions/_shared/order-notifications.ts','utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function load(url){ return new Function('Deno',js+'\nreturn {isAllowedOrigin,handlePreflight};')({env:{get:name=>name==='SUPABASE_URL'?url:undefined}}); }
const test=load('https://szijiljpasxddzgzckra.supabase.co');
const prod=load('https://different-production-project.supabase.co');
const branch='https://feat-joko-specials-v1.jokotoday-preview.pages.dev';
const pinned='https://d049d517.jokotoday-preview.pages.dev';
let count=0;const eq=(a,b)=>{assert.equal(a,b);count++;};
eq(test.isAllowedOrigin(branch),true);eq(test.isAllowedOrigin(pinned),true);
eq(prod.isAllowedOrigin(branch),false);eq(prod.isAllowedOrigin(pinned),false);
for(const guard of [test,prod]){eq(guard.isAllowedOrigin('https://joko.today'),true);eq(guard.isAllowedOrigin('https://attacker.pages.dev'),false);eq(guard.isAllowedOrigin(branch+'.attacker.example'),false);}
const req=new Request('https://example.invalid',{method:'OPTIONS',headers:{Origin:branch}});
eq(test.handlePreflight(req).status,204);eq(test.handlePreflight(req).headers.get('Access-Control-Allow-Origin'),branch);eq(prod.handlePreflight(req).status,403);
console.log(`${count} preview-origin assertions passed; production excludes sandbox origins.`);
