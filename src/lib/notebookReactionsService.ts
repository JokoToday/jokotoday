import { supabase } from './supabase';

export type NotebookReactionTargetType = 'today' | 'person' | 'product' | 'question';

export interface NotebookReactionTarget {
  type: NotebookReactionTargetType;
  id: string;
}

export interface NotebookReactionState {
  count: number;
  reacted: boolean;
}

export interface NotebookMostNoticedItem extends NotebookReactionTarget {
  count: number;
  reacted: boolean;
  lastReactedAt: string;
}

const READER_TOKEN_KEY = 'jt_notebook_reader_token';

function getReaderToken(): string {
  const existing = window.localStorage.getItem(READER_TOKEN_KEY);
  if (existing) return existing;

  const token = window.crypto.randomUUID();
  window.localStorage.setItem(READER_TOKEN_KEY, token);
  return token;
}

function firstRow<T>(data: T[] | T | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function fetchNotebookReactionState(
  target: NotebookReactionTarget,
): Promise<NotebookReactionState | null> {
  const { data, error } = await supabase.rpc('notebook_reaction_state', {
    p_target_type: target.type,
    p_target_id: target.id,
    p_reader_token: getReaderToken(),
  });

  if (error) {
    console.error('Could not load Notebook reaction state:', error);
    return null;
  }

  const row = firstRow(data as Array<{ reaction_count: number | string; reacted: boolean }> | null);
  return row
    ? { count: Number(row.reaction_count) || 0, reacted: Boolean(row.reacted) }
    : { count: 0, reacted: false };
}

export async function toggleNotebookReaction(
  target: NotebookReactionTarget,
): Promise<NotebookReactionState | null> {
  const { data, error } = await supabase.rpc('notebook_toggle_reaction', {
    p_target_type: target.type,
    p_target_id: target.id,
    p_reader_token: getReaderToken(),
  });

  if (error) {
    console.error('Could not toggle Notebook reaction:', error);
    return null;
  }

  const row = firstRow(data as Array<{ reaction_count: number | string; reacted: boolean }> | null);
  return row
    ? { count: Number(row.reaction_count) || 0, reacted: Boolean(row.reacted) }
    : null;
}

export async function fetchMostNoticed(
  limit = 12,
  windowDays = 14,
): Promise<NotebookMostNoticedItem[]> {
  const { data, error } = await supabase.rpc('notebook_most_noticed', {
    p_reader_token: getReaderToken(),
    p_limit: limit,
    p_window_days: windowDays,
  });

  if (error) {
    console.error('Could not load Most noticed Notebook items:', error);
    return [];
  }

  return ((data ?? []) as Array<{
    target_type: NotebookReactionTargetType;
    target_id: string;
    reaction_count: number | string;
    reacted: boolean;
    last_reacted_at: string;
  }>).map((row) => ({
    type: row.target_type,
    id: row.target_id,
    count: Number(row.reaction_count) || 0,
    reacted: Boolean(row.reacted),
    lastReactedAt: row.last_reacted_at,
  }));
}
