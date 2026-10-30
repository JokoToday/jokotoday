import { supabase } from './supabase';
export async function getSmileLikeCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_smile_like_counts');
  if (error) throw error;
  return Object.fromEntries((data || []).map((row: {episode_id: string; like_count: number}) => [row.episode_id, Number(row.like_count)]));
}
export async function getLikedSmileIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('smile_episode_likes').select('episode_id').eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(row => row.episode_id as string);
}
export async function setSmileLike(userId: string, episodeId: string, liked: boolean): Promise<void> {
  const query = liked ? supabase.from('smile_episode_likes').insert({user_id: userId, episode_id: episodeId})
    : supabase.from('smile_episode_likes').delete().eq('user_id', userId).eq('episode_id', episodeId);
  const { error } = await query;
  if (error && !(liked && error.code === '23505')) throw error;
}
