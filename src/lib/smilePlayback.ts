export interface SmilePlaybackTiming { openingEnd: number; endingStart: number; fadeDuration: number; duration: number }
export const SMILE_LOCKED_TIMING: SmilePlaybackTiming = { openingEnd: 6.5, endingStart: 18.1, fadeDuration: .4, duration: 26.1 };
export const SMILE_ACTING_TIMING: SmilePlaybackTiming = { openingEnd: 6.5, endingStart: 19.7, fadeDuration: .4, duration: 27.7 };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function smileCardPhase(time: number, timing = SMILE_LOCKED_TIMING) {
  if (time >= 0 && time < timing.openingEnd) return { kind: 'opening' as const, local: time, opacity: clamp((timing.openingEnd - time) / timing.fadeDuration) };
  if (time >= timing.endingStart) return { kind: 'ending' as const, local: time - timing.endingStart, opacity: clamp((time - timing.endingStart) / timing.fadeDuration) };
  return null;
}
