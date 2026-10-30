import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Play, Search, Smile, X, Heart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { Container } from '../platform/design-system';
import { filterSmileEpisodes, getSmileEpisodes, safeSmileUrl, smileText, smileVideoSource, type SmileEpisode } from '../lib/smileCatalog';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from '../components/AuthModal';
import { getSmileLikeCounts, getLikedSmileIds, setSmileLike } from '../lib/smileLikesService';
import { smileSamples, sampleLikeCounts } from '../lib/smileSamples';
import './smile.css';
import './smile-extra.css';

const extraWords = {
  en: { demoHint: 'Try the hearts below. Demo likes reset when you refresh.', likes: 'Most liked', like: 'Like', liked: 'Liked', allDates: 'All dates', month: 'Episode month', sample: 'Sample catalog — illustrative titles, dates and likes. No finished videos are published here. Demo likes are not saved to your account.', preview: 'Sample artwork', likeError: 'Likes are temporarily unavailable. Please try again.', likeHint: 'Like an episode to save it to My Favorites.', samples: 'View sample catalog', live: 'View published catalog', sampleTag: 'Sample', date: 'Date', saved: 'Saved to My Favorites', removed: 'Removed from My Favorites', demoLiked: 'Demo like added', demoRemoved: 'Demo like removed' },
  th: { demoHint: 'ลองกดหัวใจด้านล่าง การถูกใจตัวอย่างจะรีเซ็ตเมื่อรีเฟรช', likes: 'ถูกใจมากที่สุด', like: 'ถูกใจ', liked: 'ถูกใจแล้ว', allDates: 'ทุกวันที่', month: 'เดือนของตอน', sample: 'แคตตาล็อกตัวอย่าง — ชื่อ วันที่ และยอดถูกใจเป็นเพียงตัวอย่าง ยังไม่มีวิดีโอที่เสร็จสมบูรณ์ การกดถูกใจตัวอย่างจะไม่บันทึกในบัญชี', preview: 'ภาพตัวอย่าง', likeError: 'ใช้การกดถูกใจไม่ได้ชั่วคราว กรุณาลองอีกครั้ง', likeHint: 'กดถูกใจเพื่อบันทึกตอนนี้ในรายการโปรด', samples: 'ดูแคตตาล็อกตัวอย่าง', live: 'ดูตอนที่เผยแพร่แล้ว', sampleTag: 'ตัวอย่าง', date: 'วันที่', saved: 'บันทึกในรายการโปรดแล้ว', removed: 'นำออกจากรายการโปรดแล้ว', demoLiked: 'เพิ่มการถูกใจตัวอย่างแล้ว', demoRemoved: 'นำการถูกใจตัวอย่างออกแล้ว' },
  zh: { demoHint: '试试下方的爱心。刷新后示例点赞将重置。', likes: '最多点赞', like: '点赞', liked: '已点赞', allDates: '所有日期', month: '短片月份', sample: '示例目录：标题、日期和点赞数均为展示示例，尚无成片。示例点赞不会保存到您的账户。', preview: '示例插画', likeError: '暂时无法点赞，请重试。', likeHint: '点赞即可将短片保存到我的收藏。', samples: '查看示例目录', live: '查看已发布短片', sampleTag: '示例', date: '日期', saved: '已保存到我的收藏', removed: '已从我的收藏中移除', demoLiked: '已添加示例点赞', demoRemoved: '已取消示例点赞' },
};
const words = {
  en: {
    eyebrow: 'A little joy, from JOKO', title: 'A little moment of happy.',
    intro: 'Small adventures. Unexpected turns. A smile worth taking a break for.',
    latest: 'Your next little smile', watch: 'Watch episode', browse: 'Explore the episodes',
    archive: 'The smile collection', archiveIntro: 'A few seconds away from the everyday. Pick a little story and press play.',
    search: 'Find an episode', newest: 'Newest first', oldest: 'Oldest first', episodes: 'episodes',
    emptyTitle: 'Our first smile is on its way.', empty: 'Pip is getting ready for his first little adventure. Come back for a small story with a happy twist.',
    archiveEmpty: 'A little collection is in the making.', archiveEmptyBody: 'Every new episode will have a home here. The first one is coming soon.',
    noResults: 'No smiles found just yet.', clear: 'Clear search', loadError: 'The episodes could not load. Please try again.', retry: 'Try again',
    short: 'A short animated story', noSound: 'Made to enjoy, even with the sound off.', replay: 'Good for a first watch. Even better for another.',
    close: 'Close episode', external: 'Watch on the original video site', videoError: 'This video could not play. Please try again later.',
    titleLabel: 'JOKO SMILE — short animated stories', footer: 'Little films. Lovely little pauses.', loading: 'Finding a little smile…',
  },
  th: {
    eyebrow: 'ความสุขเล็ก ๆ จาก JOKO', title: 'ช่วงเวลาเล็ก ๆ ที่ทำให้ยิ้ม',
    intro: 'การผจญภัยเล็ก ๆ เรื่องพลิกผันน่ารัก ๆ และรอยยิ้มที่คุ้มค่ากับการพักสักครู่',
    latest: 'รอยยิ้มเล็ก ๆ ถัดไปของคุณ', watch: 'ดูตอนนี้', browse: 'ดูทุกตอน',
    archive: 'คอลเลกชันรอยยิ้ม', archiveIntro: 'พักจากวันธรรมดาสักไม่กี่วินาที เลือกเรื่องเล็ก ๆ แล้วกดเล่น',
    search: 'ค้นหาตอน', newest: 'ใหม่ที่สุดก่อน', oldest: 'เก่าที่สุดก่อน', episodes: 'ตอน',
    emptyTitle: 'รอยยิ้มแรกกำลังจะมา', empty: 'Pip กำลังเตรียมตัวออกผจญภัยครั้งแรก แล้วกลับมาพบกับเรื่องเล็ก ๆ ที่มีตอนจบน่ารักนะ',
    archiveEmpty: 'เรากำลังสร้างคอลเลกชันเล็ก ๆ นี้', archiveEmptyBody: 'ทุกตอนใหม่จะอยู่ที่นี่ ตอนแรกกำลังจะมาเร็ว ๆ นี้',
    noResults: 'ยังไม่พบตอนที่ค้นหา', clear: 'ล้างการค้นหา', loadError: 'โหลดตอนไม่สำเร็จ กรุณาลองอีกครั้ง', retry: 'ลองอีกครั้ง',
    short: 'เรื่องสั้นแอนิเมชัน', noSound: 'เพลิดเพลินได้ แม้ปิดเสียง', replay: 'ดูครั้งแรกก็เพลิน ดูอีกครั้งก็ยิ้มได้',
    close: 'ปิดวิดีโอ', external: 'ดูบนเว็บไซต์วิดีโอต้นทาง', videoError: 'เล่นวิดีโอไม่ได้ กรุณาลองอีกครั้งภายหลัง',
    titleLabel: 'JOKO SMILE — เรื่องสั้นแอนิเมชัน', footer: 'หนังสั้น ๆ กับช่วงพักน่ารัก ๆ', loading: 'กำลังหารอยยิ้มเล็ก ๆ…',
  },
  zh: {
    eyebrow: '来自 JOKO 的一点小快乐', title: '留一点时间给微笑。',
    intro: '小小的冒险，意想不到的转折，值得停下来享受的一个微笑。',
    latest: '下一个小小微笑', watch: '观看本集', browse: '浏览全部短片',
    archive: '微笑收藏夹', archiveIntro: '暂别日常几秒钟，选一个小故事，按下播放。',
    search: '查找短片', newest: '最新在前', oldest: '最早在前', episodes: '集',
    emptyTitle: '第一个微笑正在路上。', empty: 'Pip 正准备开启第一次小冒险。欢迎回来，看看这个带着惊喜的小故事。',
    archiveEmpty: '一个小小的收藏夹正在诞生。', archiveEmptyBody: '每一集新短片都会在这里找到自己的位置。首集即将到来。',
    noResults: '暂时没有找到相关短片。', clear: '清除搜索', loadError: '无法加载短片，请重试。', retry: '重试',
    short: '动画小故事', noSound: '即使关闭声音，也能享受其中。', replay: '看一次很开心，再看一次也值得。',
    close: '关闭短片', external: '在原视频网站观看', videoError: '无法播放此视频，请稍后重试。',
    titleLabel: 'JOKO SMILE — 动画小故事', footer: '小小短片，美好的小憩。', loading: '正在寻找一个小微笑…',
  },
};

function CookieSketch() {
  return <svg viewBox="0 0 240 200" className="smile-cookie" aria-hidden="true">
    <path d="M50 120c-4-45 23-79 68-82 40-3 75 24 78 66 3 39-22 74-63 78-43 4-79-20-83-62Z" fill="#F3BE69" stroke="#34372F" strokeWidth="3" />
    <path d="M69 104c4-27 24-46 50-48M178 114c-3 26-19 44-42 48" fill="none" stroke="#D08D39" strokeWidth="3" strokeLinecap="round" />
    <g fill="#6B4230"><path d="m100 80 10-4 7 10-9 7-10-4Z"/><path d="m147 87 10-2 5 11-10 5-8-5Z"/><path d="m91 122 9-5 9 9-6 9-12-3Z"/><path d="m134 133 12-5 6 10-8 10-11-4Z"/></g>
    <path d="m26 50-10-14m32-3-2-17m153 35 13-11M27 160l-14 5m185-3 14 8" stroke="#DF6A2C" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>;
}

export default function SmilePage() {
  const { language } = useLanguage();
  const copy = words[language];
  const extra = extraWords[language];
  const { user } = useAuth();
  const userId = user?.id;
  const sampleMode = new URLSearchParams(window.location.search).get('sample') === '1';
  const [showAuth, setShowAuth] = useState(false);
  const [month, setMonth] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>(sampleMode ? sampleLikeCounts : {});
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [likesReady, setLikesReady] = useState(sampleMode);
  const [likeError, setLikeError] = useState(false);
  const [likeNotice, setLikeNotice] = useState('');
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const accountVersion = useRef(0);
  const pendingLikes = useRef(new Set<string>());
  const [episodes, setEpisodes] = useState<SmileEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<SmileEpisode | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true; setLoading(true); setFailed(false);
    (sampleMode ? Promise.resolve(smileSamples) : getSmileEpisodes()).then(items => { if (active) setEpisodes(items); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, sampleMode]);
  useEffect(() => {
    const version = ++accountVersion.current;
    if (sampleMode) return;
    setLikedIds([]); setLikesReady(false); setLikeError(false); setLikeNotice('');
    Promise.all([getSmileLikeCounts(), userId ? getLikedSmileIds(userId) : Promise.resolve([])])
      .then(([totals, ids]) => { if (version === accountVersion.current) { setCounts(totals); setLikedIds(ids); setLikesReady(true); } })
      .catch(() => { if (version === accountVersion.current) setLikeError(true); });
    return () => { accountVersion.current = version + 1; };
  }, [userId, sampleMode, attempt]);
  const toggleLike = async (episode: SmileEpisode) => {
    if (!sampleMode && !user) { setShowAuth(true); return; }
    if (pendingLikes.current.has(episode.id)) return;
    const version = accountVersion.current;
    const next = !likedIds.includes(episode.id);
    pendingLikes.current.add(episode.id); setPendingIds([...pendingLikes.current]); setLikeError(false);
    try {
      if (!sampleMode) await setSmileLike(user!.id, episode.id, next);
      if (version !== accountVersion.current) return;
      setLikedIds(ids => next ? [...ids, episode.id] : ids.filter(id => id !== episode.id));
      setCounts(previous => ({...previous, [episode.id]: Math.max(0, (previous[episode.id] || 0) + (next ? 1 : -1))}));
      setLikeNotice(sampleMode ? (next ? extra.demoLiked : extra.demoRemoved) : (next ? extra.saved : extra.removed));
    } catch { if (version === accountVersion.current) setLikeError(true); }
    finally { pendingLikes.current.delete(episode.id); setPendingIds([...pendingLikes.current]); }
  };
  const likeButton = (episode: SmileEpisode) => <button type="button" className="smile-like"
    aria-pressed={likedIds.includes(episode.id)} disabled={pendingIds.includes(episode.id) || (!sampleMode && !!user && !likesReady)}
    aria-label={(likedIds.includes(episode.id) ? extra.liked : extra.like) + ': ' + smileText(episode, language).title}
    onClick={() => void toggleLike(episode)}>
    <Heart size={17} fill={likedIds.includes(episode.id) ? 'currentColor' : 'none'}/>
    {likedIds.includes(episode.id) ? extra.liked : extra.like}
    <span>{likesReady ? (counts[episode.id] || 0).toLocaleString() : '—'}</span>
  </button>;
  const dateLabel = (date: string) => new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB', {year:'numeric', month:'short', day:'numeric', timeZone:'UTC'}).format(new Date(date));

  useEffect(() => {
    if (selected) { setVideoFailed(false); dialog.current?.showModal(); }
  }, [selected]);
  useEffect(() => {
    const before = document.title; document.title = copy.titleLabel + ' | JOKO TODAY';
    return () => { document.title = before; };
  }, [copy.titleLabel]);

  const visible = useMemo(() => filterSmileEpisodes(episodes, {language, search, month, sort, counts}), [episodes, search, month, sort, language, counts]);
  const months = [...new Set(episodes.map(episode => episode.created_at.slice(0, 7)))].sort().reverse();
  useEffect(() => {
    if (sampleMode) return;
    const id = new URLSearchParams(window.location.search).get('episode');
    const episode = episodes.find(item => item.id === id);
    if (episode) setSelected(episode);
  }, [episodes, sampleMode]);
  const latest = episodes[0];
  const watch = (episode: SmileEpisode, element: HTMLElement) => { trigger.current = element; setSelected(episode); };
  const close = () => { dialog.current?.close(); setSelected(null); trigger.current?.focus(); };
  const source = selected ? smileVideoSource(selected.media_url) : null;
  const selectedText = selected ? smileText(selected, language) : null;

  const watchLink = (episode: SmileEpisode, hero = false) => {
    if (sampleMode) return <span className="smile-card-link">{extra.preview}</span>;
    const video = smileVideoSource(episode.media_url);
    const text = smileText(episode, language);
    return video?.kind === 'external'
      ? <a className={hero ? 'smile-watch' : 'smile-card-link'} href={video.url} target="_blank" rel="noreferrer">{copy.watch}<ArrowUpRight size={17}/></a>
      : <button type="button" className={hero ? 'smile-watch' : 'smile-card-link'} onClick={event => watch(episode, event.currentTarget)} aria-label={copy.watch + ': ' + text.title}>{hero ? <Play size={16} fill="currentColor"/> : null}{copy.watch}{hero ? null : <ArrowUpRight size={17}/>}</button>;
  };

  return <div className="smile-page">
    {sampleMode && <div className="smile-sample-banner" role="note">{extra.sample} <a href="/smile">{extra.live} →</a></div>}
    <section className="smile-hero" aria-labelledby="smile-heading">
      <Container width="wide">
        <div className="smile-hero-grid">
          <div className="smile-intro">
            <p className="smile-eyebrow"><span aria-hidden="true"/> {copy.eyebrow}</p>
            <h1 id="smile-heading"><img className="smile-logo" src="/assets/smile/joko-smile-logo.webp" width="900" height="592" alt="JOKO SMILE"/></h1>
            <h2>{copy.title}</h2>
            <p className="smile-description">{copy.intro}</p>
            <a href="#smile-episodes" className="smile-browse">{copy.browse}<ArrowDown size={17}/></a>
          </div>
          <div className="smile-feature">
            <span className="smile-feature-note">{copy.latest}</span>
            <div className="smile-screen">
              {loading ? <p role="status" className="smile-screen-message">{copy.loading}</p>
                : failed ? <div className="smile-screen-message" role="alert"><p>{copy.loadError}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="smile-retry">{copy.retry}</button></div>
                : latest ? <>
                  {safeSmileUrl(latest.thumbnail_url) ? <img className="smile-poster" src={safeSmileUrl(latest.thumbnail_url)!} alt={smileText(latest, language).alt}/> : <CookieSketch/>}
                  <div className="smile-screen-overlay">{watchLink(latest, true)}</div>
                </> : <div className="smile-screen-empty"><CookieSketch/><span className="smile-tiny-stars" aria-hidden="true">✦</span><p>{copy.emptyTitle}</p></div>}
            </div>
            <div className="smile-feature-caption">
              <span className="smile-reel-dot" aria-hidden="true"/><div><p>{latest ? smileText(latest, language).title : copy.short}</p><span>{latest ? smileText(latest, language).caption : copy.empty}</span>{latest && likeButton(latest)}</div>
            </div>
          </div>
        </div>
        <div className="smile-footnote"><span><Smile size={17}/>{copy.noSound}</span><span>{copy.replay}</span></div>
      </Container>
    </section>

    <section id="smile-episodes" className="smile-archive" aria-labelledby="smile-archive-heading">
      <Container width="wide">
        <div className="smile-archive-top"><div><p className="smile-eyebrow">JOKO SMILE</p><h2 id="smile-archive-heading">{copy.archive}</h2><p>{copy.archiveIntro}</p></div>
          {!loading && !failed && <span className="smile-count">{visible.length !== episodes.length ? visible.length + " / " : ""}{episodes.length} {copy.episodes}</span>}
        </div>
        <p className="smile-like-hint">{sampleMode ? extra.demoHint : extra.likeHint}</p>
        {likeError && <p className="smile-like-error" role="alert">{extra.likeError} <button className="smile-retry" onClick={() => setAttempt(value => value + 1)}>{copy.retry}</button></p>}
        <p className="sr-only" role="status">{likeNotice}</p>
        {episodes.length > 0 && <div className="smile-toolbar">
          <label className="smile-search"><Search size={18}/><span className="sr-only">{copy.search}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search}/></label>
          <label><span className="sr-only">{extra.month}</span><select aria-label={extra.month} value={month} onChange={event => setMonth(event.target.value)}><option value="">{extra.allDates}</option>{months.map(value => <option key={value} value={value}>{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB', {year:'numeric', month:'long',timeZone:'UTC'}).format(new Date(value + '-01T12:00:00Z'))}</option>)}</select></label>
          <label><span className="sr-only">{copy.newest} / {copy.oldest}</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">{copy.newest}</option><option value="oldest">{copy.oldest}</option><option value="likes" disabled={!likesReady}>{extra.likes}</option></select></label>
        </div>}
        {!loading && !failed && (episodes.length === 0
          ? <div className="smile-archive-empty"><span className="smile-empty-mark" aria-hidden="true">:)</span><h3>{copy.archiveEmpty}</h3><p>{copy.archiveEmptyBody}</p><a className="smile-retry" href="/smile?sample=1">{extra.samples} →</a></div>
          : visible.length === 0 ? <div className="smile-archive-empty"><h3>{copy.noResults}</h3><button type="button" className="smile-retry" onClick={() => { setSearch(''); setMonth(''); }}>{copy.clear}</button></div>
          : <div className="smile-grid">{visible.map(episode => {
            const text = smileText(episode, language); const poster = safeSmileUrl(episode.thumbnail_url);
            return <article key={episode.id} className="smile-card">
              <div className="smile-card-image">{poster ? <img src={poster} alt={text.alt} loading="lazy"/> : <CookieSketch/>}<span className="smile-card-badge"><Play size={12} fill="currentColor"/>JOKO SMILE</span></div>
              <div className="smile-card-body"><div className="smile-card-meta"><time dateTime={episode.created_at}>{dateLabel(episode.created_at)}</time>{sampleMode && <span>{extra.sampleTag}</span>}</div><h3>{text.title}</h3>{text.caption && <p>{text.caption}</p>}<div className="smile-card-actions">{watchLink(episode)}{likeButton(episode)}</div></div>
            </article>;
          })}</div>)}
        <p className="smile-signoff">{copy.footer} <span aria-hidden="true">⌣</span></p>
      </Container>
    </section>

    <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)}/>
    <dialog ref={dialog} className="smile-dialog" onClose={() => { setSelected(null); trigger.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      {selected && <div className="smile-player">
        <div className="smile-player-heading"><h2>{selectedText?.title}</h2><button type="button" onClick={close} aria-label={copy.close} autoFocus><X size={22}/></button></div>
        {videoFailed ? <p role="alert" className="smile-player-error">{copy.videoError}</p>
          : source?.kind === 'file' ? <video key={selected.id} src={source.url} poster={safeSmileUrl(selected.thumbnail_url) || undefined} controls playsInline preload="metadata" onError={() => setVideoFailed(true)} aria-label={selectedText?.alt}/>
          : source?.kind === 'youtube' ? <iframe key={selected.id} src={source.url} title={selectedText?.title} allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
          : null}
        {selectedText?.caption && <p className="smile-player-description">{selectedText.caption}</p>}
      </div>}
    </dialog>
  </div>;
}
