import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Expand, Play, RotateCcw, X } from 'lucide-react';

export interface SmileInlineHandle { play: () => void; pause: () => void }
interface Props {
  src: string; poster?: string; title: string; alt: string;
  labels: { watch: string; expand: string; close: string; replay: string; error: string };
}

// A non-modal dialog lives in the film aperture. showModal promotes that same
// DOM subtree to the top layer: the video, time, volume and play state survive.
export const SmileInlinePlayer = forwardRef<SmileInlineHandle, Props>(function SmileInlinePlayer(props, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wasExpanded = useRef(false);
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
    setStarted(true); setEnded(false);
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
        controls={started} aria-label={props.alt} onEnded={() => setEnded(true)}
        onPlay={() => { setStarted(true); setEnded(false); }} onError={() => setFailed(true)}/>
      {!started && !failed && <div className="smile-inline-start"><button type="button" className="smile-watch"
        onClick={play} aria-label={props.labels.watch + ': ' + props.title}><Play size={23} fill="currentColor"/></button></div>}
      {ended && <button type="button" className="smile-inline-replay" onClick={play}><RotateCcw size={17}/>{props.labels.replay}</button>}
      {failed && <p className="smile-inline-error" role="alert">{props.labels.error}</p>}
      <button ref={expandButton} type="button" className="smile-inline-expand" onClick={enlarge}
        aria-label={props.labels.expand} hidden={expanded}><Expand size={19}/></button>
    </div>
  </dialog>;
});
