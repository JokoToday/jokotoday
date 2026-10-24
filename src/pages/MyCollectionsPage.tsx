import { useEffect, useRef, useState } from 'react';
import { Heart, Lock, Plus, ArrowLeft, Trash2, Share2 } from 'lucide-react';
import {createShareLink,revokeShareLink} from '../lib/collectionSharingService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchLikedProducts } from '../lib/likesService';
import { getSavedItems } from '../lib/accountFavoritesService';
import { addCollectionItem, createCollection, deleteCollection, listCollectionItems, listCollections, removeCollectionItem, renameCollection, reorderCollectionItems, type CollectionItemType, type JokoCollection, type JokoCollectionItem } from '../lib/collectionsService';

type Favorite = { type: CollectionItemType; id: string; label: string };
export default function MyCollectionsPage({ onNavigate }: { onNavigate: (page: string)=>void }) {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const [collections,setCollections]=useState<JokoCollection[]>([]);
  const [selected,setSelected]=useState('');
  const [items,setItems]=useState<JokoCollectionItem[]>([]);
  const [favorites,setFavorites]=useState<Favorite[]>([]);
  const [title,setTitle]=useState('');
  const [error,setError]=useState('');
  const [shareUrl,setShareUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const accountRequest=useRef(0);
  const itemsRequest=useRef(0);
  const words={
    en:{heading:'My Collections',intro:'Organize your favorite things into private collections.',private:'Private — only you can see this collection',new:'New collection',placeholder:'Collection name',create:'Create',rename:'Rename',delete:'Delete',add:'Add from My Favorites',empty:'No collections yet.',none:'No items in this collection yet.',login:'Sign in to manage your collections.',back:'My Favorites',remove:'Remove',confirm:'Delete this collection?',saved:'Already added',share:'Create sharing link',copy:'Copy link',stopShare:'Stop sharing',up:'Move up',down:'Move down'},
    th:{heading:'คอลเลกชันของฉัน',intro:'จัดสิ่งที่ชื่นชอบเป็นคอลเลกชันส่วนตัว',private:'ส่วนตัว — มีเพียงคุณที่มองเห็น',new:'สร้างคอลเลกชัน',placeholder:'ชื่อคอลเลกชัน',create:'สร้าง',rename:'เปลี่ยนชื่อ',delete:'ลบ',add:'เพิ่มจากรายการที่ถูกใจ',empty:'ยังไม่มีคอลเลกชัน',none:'ยังไม่มีรายการในคอลเลกชันนี้',login:'กรุณาเข้าสู่ระบบ',back:'รายการที่ถูกใจ',remove:'นำออก',confirm:'ลบคอลเลกชันนี้?',saved:'เพิ่มแล้ว',share:'สร้างลิงก์แชร์',copy:'คัดลอกลิงก์',stopShare:'หยุดแชร์',up:'เลื่อนขึ้น',down:'เลื่อนลง'},
    zh:{heading:'我的合集',intro:'将喜爱的内容整理到私人合集。',private:'私人 — 只有您可以查看',new:'新建合集',placeholder:'合集名称',create:'创建',rename:'重命名',delete:'删除',add:'从收藏中添加',empty:'还没有合集。',none:'此合集尚无项目。',login:'请登录以管理您的合集。',back:'我的收藏',remove:'移除',confirm:'删除此合集？',saved:'已添加',share:'生成分享链接',copy:'复制链接',stopShare:'停止分享',up:'上移',down:'下移'},
  }[language];
  useEffect(()=>{const seq=++accountRequest.current;setCollections([]);setSelected('');setItems([]);setFavorites([]);setError('');if(!user)return;
    void Promise.all([listCollections(user.id),fetchLikedProducts(user.id),getSavedItems(user.id)]).then(([cs,ps,saved])=>{
      if(seq!==accountRequest.current)return;setCollections(cs);setSelected(cs[0]?.id||'');
      setFavorites([...ps.map(p=>({type:'product' as const,id:p.id,label:p.name_en})),...saved.map(x=>({type:x.item_type,id:x.item_id,label:x.item_type==='creator'?'Creator':'Recipe'}))]);
    }).catch(e=>{if(seq===accountRequest.current)setError(String(e.message||e));});
  },[user?.id]);
  useEffect(()=>{const seq=++itemsRequest.current;if(!selected){setItems([]);return;}void listCollectionItems(selected).then(x=>{if(seq===itemsRequest.current)setItems(x);}).catch(e=>{if(seq===itemsRequest.current)setError(String(e.message||e));});},[selected]);
  const refresh=async()=>{if(!user)return;const cs=await listCollections(user.id);setCollections(cs);if(!cs.some(c=>c.id===selected))setSelected(cs[0]?.id||'');};
  const move=async(index:number,direction:-1|1)=>{if(!current)return;const other=index+direction;if(other<0||other>=items.length)return;const ordered=[...items];[ordered[index],ordered[other]]=[ordered[other],ordered[index]];await reorderCollectionItems(current.id,ordered.map(i=>i.id));setItems(await listCollectionItems(current.id));};
  const act=async (fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
  const current=collections.find(c=>c.id===selected);
  useEffect(()=>setShareUrl(''),[selected]);
  if(authLoading)return <main className="p-10">…</main>;
  return <main className="joko-mineral-field min-h-[70vh] px-4 py-10"><div className="mx-auto max-w-5xl space-y-6">
    <button className="flex items-center gap-2 text-[#3F665E]" onClick={()=>onNavigate('favorites')}><ArrowLeft size={18}/>{words.back}</button>
    <h1 className="text-4xl font-semibold text-[#292D2B]">{words.heading}</h1><p>{words.intro}</p>
    {!user?<p>{words.login}</p>:<>
      <div className="flex items-center gap-2 text-sm text-[#3F665E]"><Lock size={16}/>{words.private}</div>
      <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();if(!title.trim()||busy)return;void act(async()=>{const c=await createCollection(user.id,title);setTitle('');await refresh();setSelected(c.id);});}}>
        <input aria-label={words.placeholder} maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder={words.placeholder} className="min-w-56 rounded-xl border border-[#55766F]/30 bg-white px-4 py-2"/>
        <button disabled={busy||!title.trim()} className="flex items-center gap-2 rounded-xl bg-[#55766F] px-4 py-2 text-white disabled:opacity-50"><Plus size={18}/>{words.create}</button>
      </form>
      {error&&<p role="alert" className="text-red-700">{error}</p>}
      {collections.length===0?<p>{words.empty}</p>:<div className="grid gap-6 md:grid-cols-[minmax(220px,1fr)_2fr]">
        <nav aria-label={words.heading} className="space-y-2">{collections.map(c=><button key={c.id} aria-current={selected===c.id?'page':undefined} onClick={()=>setSelected(c.id)} className={`block w-full rounded-xl border p-3 text-left ${selected===c.id?'border-[#55766F] bg-[#ACCEC8]':'border-[#55766F]/20 bg-white'}`}>{c.title}</button>)}</nav>
        {current&&<section className="space-y-4 rounded-2xl bg-[#FFF9EE] p-5"><h2 className="text-2xl font-semibold">{current.title}</h2>
          <div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg border px-3 py-2" onClick={()=>{const next=window.prompt(words.rename,current.title);if(next?.trim()&&next.trim()!==current.title)void act(async()=>{await renameCollection(current.id,next);await refresh();});}}>{words.rename}</button>
          <button disabled={busy} className="flex items-center gap-1 rounded-lg border px-3 py-2" onClick={()=>{if(window.confirm(words.confirm))void act(async()=>{await deleteCollection(current.id);await refresh();});}}><Trash2 size={15}/>{words.delete}</button></div>
          <div className="rounded-xl border border-[#55766F]/30 p-3 space-y-2"><p className="flex items-center gap-2 text-sm"><Share2 size={16}/>{words.share} — {language==='th'?'เฉพาะผู้ที่มีลิงก์':language==='zh'?'仅知道链接的人':'Only people with the link'}</p>
          <div className="flex flex-wrap gap-2"><button disabled={busy} className="rounded-lg border px-3 py-2" onClick={()=>void act(async()=>setShareUrl(await createShareLink(current.id)))}>{words.share}</button>
          <button disabled={busy} className="rounded-lg border px-3 py-2" onClick={()=>void act(async()=>{await revokeShareLink(current.id);setShareUrl('');})}>{words.stopShare}</button></div>
          {shareUrl&&<div className="flex flex-wrap items-center gap-2"><input readOnly aria-label={words.copy} className="min-w-0 flex-1 rounded-lg border p-2" value={shareUrl}/><button className="rounded-lg border px-3 py-2" onClick={()=>void navigator.clipboard.writeText(shareUrl)}>{words.copy}</button></div>}</div>
          <h3 className="font-semibold">{words.add}</h3><div className="flex flex-wrap gap-2">{favorites.map(f=>{const present=items.some(x=>x.item_type===f.type&&x.item_id===f.id);return <button key={`${f.type}:${f.id}`} disabled={present||busy} className="rounded-lg border border-[#55766F]/30 bg-white px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void act(async()=>{await addCollectionItem(current.id,f.type,f.id);setItems(await listCollectionItems(current.id));})}>{present?words.saved:`+ ${f.label}`}</button>;})}</div>
          <h3 className="font-semibold">{words.heading}</h3>{items.length===0?<p>{words.none}</p>:<ul className="space-y-2">{items.map((i,index)=><li key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-3"><span className="flex items-center gap-2"><Heart size={15}/>{favorites.find(f=>f.type===i.item_type&&f.id===i.item_id)?.label||`${i.item_type}: ${i.item_id}`}</span><span className="flex shrink-0 gap-2"><button type="button" aria-label={words.up} disabled={busy||index===0} onClick={()=>void act(()=>move(index,-1))} className="rounded border px-2 disabled:opacity-30">↑</button><button type="button" aria-label={words.down} disabled={busy||index===items.length-1} onClick={()=>void act(()=>move(index,1))} className="rounded border px-2 disabled:opacity-30">↓</button><button disabled={busy} onClick={()=>void act(async()=>{await removeCollectionItem(i.id);setItems(await listCollectionItems(current.id));})} className="text-sm text-[#8A4A24]">{words.remove}</button></span></li>)}</ul>}</section>}
      </div>}
    </>}
  </div></main>;
}
