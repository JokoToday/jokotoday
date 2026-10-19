import { useState } from 'react';
import type { HomepageSectionKey, HomepageSectionLayoutItem } from '../../../platform/builder/contracts';
export const DEFAULT_HOMEPAGE_SECTION_LAYOUT: HomepageSectionLayoutItem[] = [
 {key:'services',visible:true},{key:'makers',visible:true},{key:'baking',visible:true},
 {key:'how',visible:true},{key:'pickup',visible:true},{key:'new',visible:true},
 {key:'beyond',visible:true},{key:'about',visible:true},
 {key:'gallery',visible:true},{key:'reviews',visible:true},
];
export const SECTION_LABELS: Record<HomepageSectionKey,string> = {
 services:'What You Can Do Here',makers:'JOKO Makers',baking:"What's Baking This Week",
 how:'How It Works',pickup:'Pickup Information',new:"New from the Baker's Table",
 beyond:'Not Bread. Still Good.',about:'About JOKO',gallery:'Around JOKO',reviews:'What Others Say',
};
export function HomepageSectionManager({layout,onChange,onClose,servicesEnabled,onServicesToggle}:{
 layout: readonly HomepageSectionLayoutItem[];onChange:(next:HomepageSectionLayoutItem[])=>void;
 onClose:()=>void;servicesEnabled:boolean;onServicesToggle:(visible:boolean)=>void;
}) {
 const [draggedIndex,setDraggedIndex]=useState<number|null>(null);
 const drop=(target:number)=>{
  if(draggedIndex===null || draggedIndex===target) {setDraggedIndex(null);return;}
  const next=[...layout];const [moved]=next.splice(draggedIndex,1);next.splice(target,0,moved);
  setDraggedIndex(null);onChange(next);
 };
 const move=(i:number,delta:number)=>{
  const target=i+delta;if(target<0||target>=layout.length)return;
  const next=[...layout];[next[i],next[target]]=[next[target],next[i]];onChange(next);
 };
 return <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-[#55766F]/20 bg-[#FFFDF7] shadow-lg" aria-label="Homepage section order">
  <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-[#55766F]/15 bg-[#FFFDF7] p-4 sm:p-6">
   <div><h2 className="text-xl font-semibold text-[#303532]">Homepage Sections</h2>
   <p className="mt-1 text-sm text-[#303532]/70">Drag a row or use the arrows to rearrange. Show or hide sections. The Hero remains first. Changes are draft-only until published. 10 movable sections + 1 fixed Hero.</p></div>
   <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs font-semibold">Close</button>
  </div>
  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4 sm:p-6">
   <div className="flex items-center gap-3 rounded-xl bg-[#E8E8E8] px-4 py-3 text-sm"><span aria-hidden="true">🔒</span><b className="flex-1">Hero — Selected Goods</b><span className="text-xs text-[#303532]/60">Fixed first</span></div>
   {layout.map((item,index)=>{
    const visible=item.key==='services'?servicesEnabled:item.visible;
    return <div key={item.key} draggable onDragStart={e=>{e.dataTransfer.effectAllowed='move';setDraggedIndex(index);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';}} onDrop={e=>{e.preventDefault();drop(index);}} onDragEnd={()=>setDraggedIndex(null)} className={`flex items-center gap-2 rounded-xl border border-[#55766F]/10 bg-[#ECECEC] px-3 py-2.5 ${draggedIndex===index?'opacity-55 ring-2 ring-[#C76624]/40':''}`}>
      <span className="cursor-grab text-[#303532]/45" aria-hidden="true">⠿</span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-[#303532]">{SECTION_LABELS[item.key]}</span>
      <button type="button" aria-label={(visible?'Hide ':'Show ')+SECTION_LABELS[item.key]} title={visible?'Hide section':'Show section'}
       className="rounded-lg p-2 hover:bg-white" onClick={()=>item.key==='services'?onServicesToggle(!visible):onChange(layout.map((entry,i)=>i===index?{...entry,visible:!entry.visible}:entry))}>{visible?'◉':'◌'}</button>
      <button type="button" aria-label={'Move '+SECTION_LABELS[item.key]+' up'} disabled={index===0} onClick={()=>move(index,-1)} className="rounded-full border border-[#303532]/20 px-2 py-1 disabled:opacity-30">↑</button>
      <button type="button" aria-label={'Move '+SECTION_LABELS[item.key]+' down'} disabled={index===layout.length-1} onClick={()=>move(index,1)} className="rounded-full border border-[#303532]/20 px-2 py-1 disabled:opacity-30">↓</button>
    </div>;
   })}
  </div>
  <p className="shrink-0 border-t border-[#55766F]/15 p-3 text-xs text-[#303532]/60">All ten main sections are individually movable. Save Draft, refresh, and verify before publishing.</p>
 </section>;
}
