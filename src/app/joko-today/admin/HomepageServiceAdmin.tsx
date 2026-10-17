import { useState } from 'react';
import type { HomeServiceCardConfig, HomeServicesConfig, HomeServiceKey } from '../../../platform/builder/contracts';
import { uploadGalleryImage } from '../../../lib/mediaService';

const ids: HomeServiceKey[] = ['bakery','store','makers','specials'];
const routes = ['products-bakery','products-non-bakery','makers','specials'] as const;
const style = 'mt-1 w-full rounded-lg border border-[#55766F]/25 bg-white px-2 py-2 text-xs';
export function HomepageServiceAdmin({value,locale,onChange,onUploadingChange}: {
 value?:HomeServicesConfig;locale:'en'|'th'|'zh';
 onChange:(v:HomeServicesConfig)=>void;onUploadingChange:(v:boolean)=>void;
}) {
 const [error,setError]=useState('');
 const cards:HomeServiceCardConfig[]=value?.cards?.length?[...value.cards]:ids.map(key=>({key,visible:true}));
 const patchCard=(key:HomeServiceKey,patch:Partial<HomeServiceCardConfig>)=>onChange({...value,cards:cards.map(c=>c.key===key?{...c,...patch}:c)});
 const move=(index:number,offset:number)=>{const next=[...cards],dest=index+offset;if(dest<0||dest>=cards.length)return;[next[index],next[dest]]=[next[dest],next[index]];onChange({...value,cards:next});};
 const localized=(field:'title'|'subtitle',text:string)=>onChange({...value,[field]:{...value?.[field],[locale]:text}});
 return <details className="rounded-2xl border border-[#55766F]/14 bg-white/70 p-3">
 <summary className="cursor-pointer text-sm font-semibold">What You Can Do Here — Services</summary>
 <p className="mt-2 text-xs">Edit {locale.toUpperCase()} content. Save draft and publish to update the homepage. Service identities remain fixed.</p>
 <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={value?.visible!==false} onChange={e=>onChange({...value,visible:e.target.checked})}/>Show section</label>
 {(['title','subtitle'] as const).map(field=><label key={field} className="mt-2 block text-xs">{field} ({locale})<input className={style} value={value?.[field]?.[locale]??''} placeholder={field==='title'?'What You Can Do Here':'Four ways to discover something good.'} onChange={e=>localized(field,e.target.value)}/></label>)}
 <div className="mt-3 space-y-3">{cards.map((card,index)=>{
 const localPatch=(field:'name'|'description'|'exploreLabel'|'guideLabel'|'imageAlt',text:string)=>patchCard(card.key,{[field]:{...card[field],[locale]:text}});
 const stepPatch=(idx:number,text:string)=>{const steps=[...(card.guideSteps?.[locale]??['','',''])];steps[idx]=text;patchCard(card.key,{guideSteps:{...card.guideSteps,[locale]:steps}})};
 return <div key={card.key} className="rounded-xl border border-[#55766F]/20 bg-[#FFF9EE] p-3">
 <div className="flex items-center gap-2 text-xs"><input type="checkbox" checked={card.visible} aria-label={'Show '+card.key} onChange={e=>patchCard(card.key,{visible:e.target.checked})}/><b className="flex-1">{card.key.toUpperCase()}</b><button type="button" disabled={!index} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===cards.length-1} onClick={()=>move(index,1)}>↓</button></div>
 {(['name','description','exploreLabel','guideLabel','imageAlt'] as const).map(field=><label key={field} className="mt-2 block text-xs">{field} ({locale})<input className={style} value={card[field]?.[locale]??''} onChange={e=>localPatch(field,e.target.value)}/></label>)}
 <label className="mt-2 block text-xs">Explore destination<select className={style} value={card.destination??routes[ids.indexOf(card.key)]} onChange={e=>patchCard(card.key,{destination:e.target.value as HomeServiceCardConfig['destination']})}>{routes.map(route=><option key={route} value={route}>{route}</option>)}</select></label>
 {card.imageUrl&&<img className="my-2 h-24 w-24 rounded border object-contain" src={card.imageUrl} alt={card.imageAlt?.[locale]||card.key}/>}
 <label className="mt-2 block text-xs">Image upload (WebP, PNG, JPEG)<input type="file" accept="image/png,image/jpeg,image/webp" className={style} onChange={async e=>{const file=e.currentTarget.files?.[0];if(!file)return;onUploadingChange(true);setError('');try{const uploaded=await uploadGalleryImage({file,gallerySlot:'homepage-hero'});patchCard(card.key,{imageUrl:uploaded.publicUrl});}catch(err){setError(err instanceof Error?err.message:'Upload failed');}finally{onUploadingChange(false);e.target.value='';}}}/></label>
 {card.imageUrl&&<button type="button" className="text-xs underline" onClick={()=>patchCard(card.key,{imageUrl:undefined})}>Remove image</button>}
 <label className="mt-2 block text-xs">Explainer video URL (optional)<input className={style} value={card.videoUrl??''} onChange={e=>patchCard(card.key,{videoUrl:e.target.value||undefined})}/></label>
 <p className="mt-2 text-xs font-semibold">How It Works steps ({locale})</p>
 {[0,1,2].map(idx=><label key={idx} className="mt-2 block text-xs">Step {idx+1}<textarea rows={2} className={style} value={card.guideSteps?.[locale]?.[idx]??''} onChange={e=>stepPatch(idx,e.target.value)}/></label>)}
 </div>;
 })}</div>{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
 </details>;
}
