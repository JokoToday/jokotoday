import { supabase } from './supabase';
import type { GalleryItem } from './aboutMediaService';
import type { Language } from '../translations';

export const SMILE_CATEGORY = 'joko-smile';
export type SmileEpisode = GalleryItem;

export function safeSmileUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^\/(?![\\/])/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export function smileVideoSource(value: string): { kind: 'file' | 'youtube' | 'external'; url: string } | null {
  const safe = safeSmileUrl(value);
  if (!safe) return null;
  if (/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(safe)) return { kind: 'file', url: safe };
  const url = new URL(safe, 'https://joko.today');
  let videoId: string | null = null;
  if (url.hostname === 'youtu.be') videoId = url.pathname.slice(1);
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
    videoId = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] || null;
  }
  if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) return { kind: 'youtube', url: 'https://www.youtube-nocookie.com/embed/' + videoId };
  return { kind: 'external', url: safe };
}

export function smileText(episode: SmileEpisode, language: Language) {
  return {
    title: episode[`title_${language}`] || episode.title_en || 'JOKO SMILE',
    caption: episode[`caption_${language}`] || episode.caption_en || '',
    alt: episode[`alt_${language}`] || episode.alt_en || episode[`title_${language}`] || episode.title_en || 'JOKO SMILE',
  };
}

export function publishedSmileEpisodes(items: SmileEpisode[]): SmileEpisode[] {
  return items.filter(item => item.site_key === 'joko-today' && item.is_published &&
    item.category === SMILE_CATEGORY && item.media_type === 'video' && smileVideoSource(item.media_url))
    .sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
}

export async function getSmileEpisodes(): Promise<SmileEpisode[]> {
  const { data, error } = await supabase.from('site_gallery_items').select('*')
    .eq('site_key', 'joko-today').eq('category', SMILE_CATEGORY)
    .eq('media_type', 'video').eq('is_published', true)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return publishedSmileEpisodes((data || []) as SmileEpisode[]);
}

export function filterSmileEpisodes(episodes: SmileEpisode[], options: {
  language: Language; search: string; month: string; sort: string; counts: Record<string, number>;
}): SmileEpisode[] {
  const query = options.search.trim().toLocaleLowerCase();
  return episodes.filter(episode => {
    const text = smileText(episode, options.language);
    return (text.title + ' ' + text.caption).toLocaleLowerCase().includes(query)
      && (!options.month || episode.created_at.slice(0, 7) === options.month);
  }).sort((a, b) => {
    if (options.sort === 'likes') {
      const difference = (options.counts[b.id] || 0) - (options.counts[a.id] || 0);
      if (difference) return difference;
    }
    const date = a.created_at.localeCompare(b.created_at);
    return options.sort === 'oldest' ? date : -date;
  });
}
