import { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { Language } from '../translations';
import { shareSmileEpisode, smileEpisodeShareUrl, smileLineShareUrl } from '../lib/smileShare';
const words = {
  en: { share: 'Share', line: 'Share on LINE', copied: 'Link copied', copy: 'Copy link', manual: 'Select and copy this episode link:' },
  th: { share: 'แชร์', line: 'แชร์ผ่าน LINE', copied: 'คัดลอกลิงก์แล้ว', copy: 'คัดลอกลิงก์', manual: 'เลือกลิงก์ตอนนี้แล้วคัดลอก:' },
  zh: { share: '分享', line: '分享到 LINE', copied: '链接已复制', copy: '复制链接', manual: '请选择并复制本集链接：' },
};
export function SmileShareButton({ id, title, language }: { id: string; title: string; language: Language }) {
  const copy = words[language];
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const share = async () => {
    setCopied(false); setManual(false);
    const result = await shareSmileEpisode(navigator, id, title);
    if (result === 'copied') setCopied(true);
    if (result === 'manual') setManual(true);
  };
  return <div className="smile-share">
    <div className="smile-share-buttons">
      <button type="button" className="smile-share-button" onClick={() => void share()} aria-label={copy.share + ': ' + title}>
        <Share2 size={16}/>{copy.share}
      </button>
      <a className="smile-line-share" href={smileLineShareUrl(id, title)} target="_blank" rel="noopener noreferrer"
        aria-label={copy.line + ': ' + title}>LINE</a>
    </div>
    <span className="sr-only" role="status">{copied ? copy.copied : ''}</span>
    {copied && <small aria-hidden="true" className="smile-share-feedback">{copy.copied}</small>}
    {manual && <label className="smile-share-manual">{copy.manual}
      <input readOnly value={smileEpisodeShareUrl(id)} aria-label={copy.copy}
        onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}/>
    </label>}
  </div>;
}
