import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SmileLocalizedCards } from './SmileLocalizedCards';
import type { Language } from '../translations';
import type { SmilePlaybackTiming } from '../lib/smilePlayback';
import { Expand, Play, RotateCcw, X } from 'lucide-react';

export interface SmileInlineHandle { play: () => void; pause: () => void }
interface Props {
  src: string; poster?: string; title: string; alt: string;
  localization?: { language: Language; setLanguage: (language: Language) => void; timing: SmilePlaybackTiming };
  labels: { watch: string; expand: string; close: string; replay: string; error: string };
}

// A non-modal dialog lives in the film aperture. showModal promotes that same
// DOM subtree to the top layer: the video, time, volume and play state survive.
export const SmileInlinePlayer = forwardRef<SmileInlineHandle, Props>(function SmileInlinePlayer(props, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wasExpanded = useRef(false);
  const hasLocalization = !!props.localization;
  useEffect(() => {
    if (!hasLocalization) return;
    for (const language of ['en', 'th', 'zh']) for (const kind of ['opening', 'ending', 'poster']) {
      const image = new Image(); image.src = `/assets/smile/ep001-i18n/${kind}-${language}.png`;
    }
  }, [hasLocalization]);
  useEffect(() => {
    const media = video.current;
    if (!media || !hasLocalization || !started) return;
    let frame = 0;
    const update = () => { setTime(media.currentTime); frame = requestAnimationFrame(update); };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [hasLocalization, started]);
  useEffect(() => {
    if (wasExpanded.current && !expanded) expandButton.current?.focus();
    wasExpanded.current = expanded;
  }, [expanded]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);
  const play = () => {
    const media = video.current;
    if (!media) return;
    if (media.ended) media.currentTime = 0;
    setStarted(true); setEnded(false); setTime(media.currentTime);
    // Invoke during the click, not after an asynchronous state change, so sound
    // has user activation. Native controls remain available if playback fails.
    void media.play().catch(() => { setStarted(false); });
  };
  useImperativeHandle(ref, () => ({ play, pause: () => video.current?.pause() }));
  const enlarge = () => {
    const dialog = panel.current;
    if (!dialog) return;
    dialog.close(); dialog.showModal(); setExpanded(true);
  };
  const shrink = () => {
    panel.current?.close(); panel.current?.show(); setExpanded(false);
  };
  return <dialog ref={panel} open className="smile-inline-player" aria-label={props.title}
    role={expanded ? 'dialog' : 'region'} aria-modal={expanded || undefined}
    onCancel={event => { event.preventDefault(); shrink(); }}>
    <div className="smile-inline-heading"><span>{props.title}</span>
      <button type="button" onClick={shrink} aria-label={props.labels.close}><X size={22}/></button>
    </div>
    <div className="smile-inline-stage">
      <video ref={video} src={props.src} poster={props.poster} playsInline preload="none"
        controls={started} controlsList={hasLocalization ? "nofullscreen nodownload" : undefined}
        disablePictureInPicture={hasLocalization} aria-label={props.alt} onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
        onSeeked={event => { setTime(event.currentTarget.currentTime); setEnded(event.currentTarget.ended); }} onEnded={() => { setEnded(true); setTime(video.current?.duration || props.localization?.timing.duration || 0); }}
        onPlay={() => { setStarted(true); setEnded(false); }} onError={() => setFailed(true)}/>
      {props.localization && started && <SmileLocalizedCards language={props.localization.language} time={time} timing={props.localization.timing}/>}
      {props.localization && <div className="smile-player-languages" role="group" aria-label="Language / ภาษา / 语言">
        {(['en', 'th', 'zh'] as const).map(lang => <button key={lang} type="button" lang={lang}
          aria-pressed={props.localization!.language === lang} onClick={() => props.localization!.setLanguage(lang)}>
          {{ en: 'EN', th: 'TH', zh: '中文' }[lang]}</button>)}
      </div>}
      {!started && !failed && <div className="smile-inline-start"><button type="button" className="smile-watch"
        onClick={play} aria-label={props.labels.watch + ': ' + props.title}><Play size={23} fill="currentColor"/></button></div>}
      {ended && <button type="button" className="smile-inline-replay" onClick={play}><RotateCcw size={17}/><span>{props.labels.replay}</span></button>}
      {failed && <p className="smile-inline-error" role="alert">{props.labels.error}</p>}
      <button ref={expandButton} type="button" className="smile-inline-expand" onClick={enlarge}
        aria-label={props.labels.expand} hidden={expanded}><Expand size={19}/></button>
    </div>
  </dialog>;
});
