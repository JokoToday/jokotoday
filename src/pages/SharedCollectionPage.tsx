import {useEffect,useState} from 'react';
import {readShareLink,type SharedCollection} from '../lib/collectionSharingService';
import {useLanguage} from '../context/LanguageContext';
export default function SharedCollectionPage({token}:{token:string}){
 const {language}=useLanguage();const [collection,setCollection]=useState<SharedCollection|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let active=true;void readShareLink(token).then(x=>{if(active)setCollection(x)}).catch(()=>{if(active)setError('This share link is unavailable or has been revoked.')});return()=>{active=false}},[token]);
 return <main className="mx-auto max-w-4xl px-4 py-10 space-y-5"><p className="text-sm text-[#55766F]">JOKO TODAY · {language==='th'?'คอลเลกชันที่แชร์':language==='zh'?'分享合集':'Shared collection'}</p>{error?<p role="alert">{error}</p>:!collection?<p>Loading…</p>:<><h1 className="text-3xl font-semibold">{collection.title}</h1><p>{collection.description}</p><div className="grid gap-4 sm:grid-cols-2">{collection.items.map((i,index)=><a key={`${i.url}:${index}`} href={i.url} className="rounded-xl border p-4 hover:bg-[#FFF9EE]"><p className="text-xs uppercase text-[#55766F]">{i.type}</p><h2 className="font-semibold">{(language==='th'?i.name_th:language==='zh'?i.name_zh:i.name_en)||i.name_en}</h2></a>)}</div></>}</main>;
}
