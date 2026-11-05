export function smileEpisodeShareUrl(id: string): string {
  const url = new URL('/smile', 'https://joko.today');
  url.searchParams.set('episode', id);
  return url.href;
}
interface ShareCapabilities {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}
export async function shareSmileEpisode(capabilities: ShareCapabilities, id: string, title: string): Promise<'shared' | 'cancelled' | 'copied' | 'manual'> {
  const url = smileEpisodeShareUrl(id);
  if (capabilities.share) {
    try { await capabilities.share({ title, url }); return 'shared'; }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    if (!capabilities.clipboard) return 'manual';
    await capabilities.clipboard.writeText(url); return 'copied';
  } catch { return 'manual'; }
}
