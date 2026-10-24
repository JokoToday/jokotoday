import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(url,service,{auth:{persistSession:false}});
const encoder=new TextEncoder();
async function sha(token:string){const b=await crypto.subtle.digest('SHA-256',encoder.encode(token));return Array.from(new Uint8Array(b)).map(n=>n.toString(16).padStart(2,'0')).join('');}
function makeToken(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes).map(n=>n.toString(16).padStart(2,'0')).join('');}
function isToken(token:unknown):token is string{return typeof token==='string' && /^[a-f0-9]{64}$/.test(token);}
serve(async(request)=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return respond({error:'Method not allowed'},405);
 let data:Record<string,unknown>;try {data=await request.json();}catch{return respond({error:'Invalid JSON'},400);}
 const action=data.action;
 if(action==='read'){
  if(!isToken(data.token))return respond({error:'Invalid share link'},404);
  const hash=await sha(data.token);
  const {data:link,error:linkError}=await db.from('joko_collection_share_links').select('collection_id,revoked_at,expires_at').eq('token_hash',hash).maybeSingle();
  if(linkError)return respond({error:'Sharing temporarily unavailable'},503);
  if(!link||link.revoked_at||(link.expires_at&&new Date(link.expires_at).getTime()<=Date.now()))return respond({error:'Share link expired or revoked'},404);
  const {data:collection}=await db.from('joko_collections').select('id,title,description').eq('id',link.collection_id).maybeSingle();
  if(!collection)return respond({error:'Collection unavailable'},404);
  const {data:items,error:itemsError}=await db.from('joko_collection_items').select('item_type,item_id,position').eq('collection_id',link.collection_id).order('position').limit(100);
  if(itemsError)return respond({error:'Collection unavailable'},503);
  const visible=[];
  for(const item of items||[]){
   if(item.item_type==='product'){
    const {data:p}=await db.from('cms_products').select('slug,name_en,name_th,name_zh,image').eq('id',item.item_id).eq('is_active',true).maybeSingle();
    if(p)visible.push({type:'product',name_en:p.name_en,name_th:p.name_th,name_zh:p.name_zh,image:p.image,url:`/products/${encodeURIComponent(p.slug)}`});
   }else if(item.item_type==='creator'){
    const {data:m}=await db.from('cms_makers').select('slug,name_en,name_th,name_zh,hero_image').eq('id',item.item_id).eq('is_published',true).maybeSingle();
    if(m)visible.push({type:'creator',name_en:m.name_en,name_th:m.name_th,name_zh:m.name_zh,image:m.hero_image,url:`/makers/${encodeURIComponent(m.slug)}`});
   }
  }
  return respond({title:collection.title,description:collection.description,items:visible});
 }
 if(action!=='create'&&action!=='revoke')return respond({error:'Unknown action'},400);
 if(typeof data.collectionId!=='string'||!(/^[0-9a-f-]{36}$/i).test(data.collectionId))return respond({error:'Invalid collection'},400);
 const bearer=request.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer '))return respond({error:'Sign in required'},401);
 const authClient=createClient(url,anon,{auth:{persistSession:false}});
 const {data:identity,error:authError}=await authClient.auth.getUser(bearer.slice(7));
 if(authError||!identity.user)return respond({error:'Sign in required'},401);
 const {data:owned,error:ownerError}=await db.from('joko_collections').select('id').eq('id',data.collectionId).eq('owner_user_id',identity.user.id).maybeSingle();
 if(ownerError||!owned)return respond({error:'Collection not found'},404);
 if(action==='revoke'){
  const {error}=await db.from('joko_collection_share_links').delete().eq('collection_id',data.collectionId);
  return error?respond({error:'Could not stop sharing'},503):respond({shared:false});
 }
 const token=makeToken();
 const {error}=await db.from('joko_collection_share_links').upsert({collection_id:data.collectionId,token_hash:await sha(token),created_at:new Date().toISOString(),revoked_at:null,expires_at:null},{onConflict:'collection_id'});
 if(error)return respond({error:'Could not create share link'},503);
 return respond({shared:true,token});
});
