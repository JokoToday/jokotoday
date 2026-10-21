import { useState } from 'react';
import type { HomeServiceCardConfig, HomeServicesConfig, HomeServiceKey, LocalizedText } from '../../../platform/builder/contracts';
import { uploadGalleryImage } from '../../../lib/mediaService';
import { services, heading, introduction, howLabel, type Language } from '../home/homepageServiceDefaults';

const style = 'mt-1 w-full rounded-lg border border-[#55766F]/25 bg-white px-2 py-2 text-sm';
const routes = ['products-bakery','products-non-bakery','makers','specials'] as const;
const defaults = (): HomeServiceCardConfig[] => services.map(service => ({
  key: service.key, visible: true, name: {...service.name},
  description: {...service.description}, exploreLabel: {...service.explore},
  guideLabel: {...howLabel}, guideSteps: {
    en: [...service.steps.en], th: [...service.steps.th], zh: [...service.steps.zh],
  }, destination: service.page as HomeServiceCardConfig['destination'],
}));
export function HomepageServiceAdmin({value,locale,onChange,onUploadingChange}:{
  value?:HomeServicesConfig; locale:Language;
  onChange:(next:HomeServicesConfig)=>void; onUploadingChange:(busy:boolean)=>void;
}) {
  const [error,setError]=useState('');
  const base=defaults();
  const cards: HomeServiceCardConfig[] = value?.cards?.length
    ? value.cards.map(card=>({...base.find(item=>item.key===card.key)!, ...card}))
    : base;
  const patchCard=(key:HomeServiceKey,patch:Partial<HomeServiceCardConfig>)=>
    onChange({...value,cards:cards.map(card=>card.key===key?{...card,...patch}:card)});
  const move=(index:number,delta:number)=>{
    const target=index+delta;if(target<0||target>=cards.length)return;
    const next=[...cards];[next[index],next[target]]=[next[target],next[index]];
    onChange({...value,cards:next});
  };
  const changeSection=(field:'title'|'subtitle',text:string)=>
    onChange({...value,[field]:{...(field==='title'?heading:introduction),...value?.[field],[locale]:text}});
  return <details className="rounded-2xl border border-[#55766F]/14 bg-white/70 p-3">
    <summary className="cursor-pointer text-sm font-semibold text-[#303532]">What You Can Do Here — Services</summary>
    <p className="mt-2 text-xs leading-5 text-[#303532]/65">All four cards are pre-filled in English, Thai and Chinese. Change only what you need; existing saved edits take priority. Save Draft and Publish when ready.</p>
    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={value?.visible===true} onChange={e=>onChange({...value,visible:e.target.checked})}/>Show this section on the homepage after publishing</label>
    <div className="mt-3 grid gap-2">
      {(['title','subtitle'] as const).map(field=><label key={field} className="text-xs font-medium text-[#303532]">{field==='title'?'Section heading':'Introductory sentence'} ({locale.toUpperCase()})
        <input className={style} value={value?.[field]?.[locale]??(field==='title'?heading:introduction)[locale]} onChange={e=>changeSection(field,e.target.value)}/>
      </label>)}
    </div>
    <div className="mt-4 space-y-3">{cards.map((card,index)=>{
      const service=services.find(item=>item.key===card.key)!;
      const updateText=(field:'name'|'description'|'exploreLabel'|'guideLabel'|'imageAlt',text:string)=>{
        const defaultText: LocalizedText = field==='name'?service.name:field==='description'?service.description:field==='exploreLabel'?service.explore:field==='guideLabel'?howLabel:{en:'',th:'',zh:''};
        patchCard(card.key,{[field]:{...defaultText,...card[field],[locale]:text}});
      };
      const updateStep=(step:number,text:string)=>{
        const localized=card.guideSteps?.[locale]??service.steps[locale];
        const next=[...localized];next[step]=text;
        patchCard(card.key,{guideSteps:{en:[...service.steps.en],th:[...service.steps.th],zh:[...service.steps.zh],...card.guideSteps,[locale]:next}});
      };
      return <details key={card.key} className="rounded-xl border border-[#55766F]/20 bg-[#FFF9EE] p-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#303532]">{card.name?.[locale]||service.name[locale]}</summary>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <label className="flex flex-1 items-center gap-2"><input type="checkbox" checked={card.visible} onChange={e=>patchCard(card.key,{visible:e.target.checked})}/> Show card</label>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-30" disabled={index===0} onClick={()=>move(index,-1)} aria-label={'Move '+card.key+' up'}>↑</button>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-30" disabled={index===cards.length-1} onClick={()=>move(index,1)} aria-label={'Move '+card.key+' down'}>↓</button>
        </div>
        <div className="mt-3 space-y-2">
          <details open className="rounded-lg border bg-white/70 p-3"><summary className="cursor-pointer text-sm font-semibold">Basic information</summary>
            <label className="mt-2 block text-xs">Card name<input className={style} value={card.name?.[locale]??service.name[locale]} onChange={e=>updateText('name',e.target.value)}/></label>
            <label className="mt-2 block text-xs">Short description<textarea rows={3} className={style} value={card.description?.[locale]??service.description[locale]} onChange={e=>updateText('description',e.target.value)}/></label>
          </details>
          <details className="rounded-lg border bg-white/70 p-3"><summary className="cursor-pointer text-sm font-semibold">Illustration</summary>
            {card.imageUrl?<img src={card.imageUrl} alt={card.imageAlt?.[locale]||service.name[locale]} className="mt-2 h-28 w-28 rounded-lg border object-contain"/>:<p className="mt-2 text-xs text-[#303532]/60">A temporary icon is shown until an approved JOKO sketch is uploaded.</p>}
            <label className="mt-2 block text-xs">Upload or replace sketch<input type="file" accept="image/png,image/jpeg,image/webp" className={style} onChange={async e=>{
              const file=e.currentTarget.files?.[0];if(!file)return;onUploadingChange(true);setError('');
              try {const uploaded=await uploadGalleryImage({file,gallerySlot:'homepage-hero'});patchCard(card.key,{imageUrl:uploaded.publicUrl});}
              catch(err){setError(err instanceof Error?err.message:'Upload failed');}
              finally{onUploadingChange(false);e.target.value='';}
            }}/></label>
            {card.imageUrl&&<button type="button" className="mt-2 text-xs underline" onClick={()=>patchCard(card.key,{imageUrl:undefined})}>Remove illustration</button>}
            <label className="mt-2 block text-xs">Image description (accessibility)<input className={style} value={card.imageAlt?.[locale]??''} onChange={e=>updateText('imageAlt',e.target.value)}/></label>
          </details>
          <details className="rounded-lg border bg-white/70 p-3"><summary className="cursor-pointer text-sm font-semibold">Explore button & catalog link</summary>
            <label className="mt-2 block text-xs">Button text<input className={style} value={card.exploreLabel?.[locale]??service.explore[locale]} onChange={e=>updateText('exploreLabel',e.target.value)}/></label>
            <label className="mt-2 block text-xs">Catalog destination<select className={style} value={card.destination??service.page} onChange={e=>patchCard(card.key,{destination:e.target.value as HomeServiceCardConfig['destination']})}>{routes.map(route=><option key={route} value={route}>{route}</option>)}</select></label>
          </details>
          <details className="rounded-lg border bg-white/70 p-3"><summary className="cursor-pointer text-sm font-semibold">How It Works guide</summary>
            <label className="mt-2 block text-xs">Button text<input className={style} value={card.guideLabel?.[locale]??howLabel[locale]} onChange={e=>updateText('guideLabel',e.target.value)}/></label>
            {[0,1,2].map(step=><label key={step} className="mt-2 block text-xs">Step {step+1}<textarea rows={2} className={style} value={card.guideSteps?.[locale]?.[step]??service.steps[locale][step]} onChange={e=>updateStep(step,e.target.value)}/></label>)}
            <label className="mt-2 block text-xs">Optional explainer video URL<input className={style} value={card.videoUrl??''} onChange={e=>patchCard(card.key,{videoUrl:e.target.value||undefined})}/></label>
          </details>
        </div>
      </details>;
    })}</div>
    {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </details>;
}
