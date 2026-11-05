import { useId } from 'react';
import type { Language } from '../translations';
import cardData from '../lib/smileCardData';
import { SMILE_CARD_ASSETS } from '../lib/smileLocalization';
import { smileCardPhase, type SmilePlaybackTiming } from '../lib/smilePlayback';

export interface CardPath { d: string; length: number; start: number; duration: number }
export interface CardAnimation {
  paths: CardPath[]; tips: (number[] | null)[]; image: string; paintStart: number; paintDuration: number;
}
export interface CardLanguage { opening: CardAnimation; ending: CardAnimation }
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function SmileLocalizedCards({ language, time, timing }: { language: Language; time: number; timing?: SmilePlaybackTiming }) {
  const clipId = useId();
  const phase = smileCardPhase(time, timing);
  if (!phase) return null;
  const data: CardLanguage = cardData[language];
  const animation = data[phase.kind];
  const paint = clamp((phase.local - animation.paintStart) / animation.paintDuration);
  const tip = animation.tips[Math.min(animation.tips.length - 1, Math.max(0, Math.round(phase.local * 30)))];
  return <svg className="smile-localized-canvas" data-card-kind={phase.kind} data-card-local-time={phase.local.toFixed(3)} viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ opacity: phase.opacity }}>
    <defs><clipPath id={clipId}><rect x="0" y={phase.kind === 'opening' ? 65 : 410} width="1200" height={(phase.kind === 'opening' ? 326 : 120) * paint}/></clipPath></defs>
    <g fill="none" stroke="#141515" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" opacity={paint >= 1 ? 0 : 1}>
      {animation.paths.map((p, i) => {
        const u = clamp((phase.local - p.start) / p.duration);
        return <path key={i} d={p.d} opacity={u > 0 ? 1 : 0} strokeDasharray={`${p.length + 1} ${p.length + 1}`} strokeDashoffset={(p.length + 1) * (1 - u)}/>;
      })}
    </g>
    <image href={SMILE_CARD_ASSETS + animation.image} width="1200" height="760" clipPath={`url(#${clipId})`}/>
    {tip && <g transform={`matrix(.64,-.768,.768,.64,${tip[0]},${tip[1]})`} opacity={tip[2]} stroke="#232320" strokeWidth="1" strokeLinejoin="round">
      <path d="M0 0 18 -6 18 6Z" fill="#d2b07e"/><path d="M0 0 6 -2 6 2Z" fill="#232320"/>
      <path d="M18 -6H88V6H18Z" fill="#C76624"/><path d="M20 -2H86" fill="none" stroke="#f2ae59" strokeWidth="1.5"/>
      <path d="M88 -6H96V6H88Z" fill="#9fa59f"/><path d="M96 -6H107L109 0 107 6H96Z" fill="#deaa97"/>
    </g>}
  </svg>;
}
