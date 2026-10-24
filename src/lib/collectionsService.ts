import { supabase } from './supabase';
export type CollectionItemType = 'product' | 'creator' | 'recipe';
export interface JokoCollection { id: string; owner_user_id: string; title: string; description: string; created_at: string; updated_at: string }
export interface JokoCollectionItem { id: string; collection_id: string; item_type: CollectionItemType; item_id: string; position: number; added_at: string }
export async function listCollections(userId: string): Promise<JokoCollection[]> {
  const {data,error}=await supabase.from('joko_collections').select('*').eq('owner_user_id',userId).order('created_at',{ascending:false});
  if(error)throw error;return data||[];
}
export async function createCollection(userId:string,title:string):Promise<JokoCollection>{
  const {data,error}=await supabase.from('joko_collections').insert({owner_user_id:userId,title:title.trim()}).select('*').single();
  if(error)throw error;return data;
}
export async function renameCollection(id:string,title:string):Promise<void>{
  const {error}=await supabase.from('joko_collections').update({title:title.trim(),updated_at:new Date().toISOString()}).eq('id',id);if(error)throw error;
}
export async function deleteCollection(id:string):Promise<void>{
  const {error}=await supabase.from('joko_collections').delete().eq('id',id);if(error)throw error;
}
export async function listCollectionItems(id:string):Promise<JokoCollectionItem[]>{
  const {data,error}=await supabase.from('joko_collection_items').select('*').eq('collection_id',id).order('position').order('added_at');if(error)throw error;return data||[];
}
export async function addCollectionItem(id:string,type:CollectionItemType,itemId:string):Promise<void>{
  const {error}=await supabase.from('joko_collection_items').upsert({collection_id:id,item_type:type,item_id:itemId},{onConflict:'collection_id,item_type,item_id',ignoreDuplicates:true});if(error)throw error;
}
export async function removeCollectionItem(id:string):Promise<void>{
  const {error}=await supabase.from('joko_collection_items').delete().eq('id',id);if(error)throw error;
}
