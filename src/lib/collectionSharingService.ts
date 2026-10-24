import { supabase } from './supabase';
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const endpoint = `${import.meta.env.VITE_SUPABASE_URL || 'https://xvhualoeboobulwgmkla.supabase.co'}/functions/v1/joko-collection-share`;
async function call(action:'create'|'revoke'|'read',details:Record<string,string>){
 const {data}=await supabase.auth.getSession();
 const headers:Record<string,string>={'Content-Type':'application/json',apikey:publicKey};
 if(action!=='read'){
  if(!data.session)throw new Error('Sign in required');
  headers.Authorization=`Bearer ${data.session.access_token}`;
 }
 const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({action,...details}),cache:'no-store'});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Sharing unavailable');return result;
}
export async function createShareLink(collectionId:string):Promise<string>{const result=await call('create',{collectionId});return `${window.location.origin}/c/${result.token}`;}
export async function revokeShareLink(collectionId:string):Promise<void>{await call('revoke',{collectionId});}
export interface SharedCollection {title:string;description:string;items:{type:'product'|'creator';name_en:string;name_th:string;name_zh:string|null;image:string|null;url:string}[]}
export async function readShareLink(token:string):Promise<SharedCollection>{return call('read',{token});}
