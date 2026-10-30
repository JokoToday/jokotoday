import { ArrowUpRight } from 'lucide-react';
import { safeSmileUrl, smileVideoSource } from '../lib/smileCatalog';

interface SmilePlayerMediaProps {
  mediaUrl: string;
  poster: string | null;
  title: string;
  alt: string;
  externalLabel: string;
  errorLabel: string;
  failed: boolean;
  onError: () => void;
}

export function SmilePlayerMedia(props: SmilePlayerMediaProps) {
  const source = smileVideoSource(props.mediaUrl);
  if (props.failed || !source) return <p role="alert" className="smile-player-error">{props.errorLabel}</p>;
  if (source.kind === 'file') return <video src={source.url} poster={safeSmileUrl(props.poster) || undefined} controls playsInline preload="metadata" onError={props.onError} aria-label={props.alt}/>;
  if (source.kind === 'youtube') return <iframe src={source.url} title={props.title} allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>;
  return <div className="smile-player-external">
    {safeSmileUrl(props.poster) && <img src={safeSmileUrl(props.poster)!} alt={props.alt}/>}
    <a className="smile-watch" href={source.url} target="_blank" rel="noopener noreferrer">{props.externalLabel}<ArrowUpRight size={17}/></a>
  </div>;
}
