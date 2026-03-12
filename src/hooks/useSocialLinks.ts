import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SocialLink {
  id: string;
  name: string;
  label: string;
  url: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export function useSocialLinks() {
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadSocialLinks();
  }, []);

  const loadSocialLinks = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('site_social_links')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setSocialLinks(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load social links'));
    } finally {
      setLoading(false);
    }
  };

  return { socialLinks, loading, error, reload: loadSocialLinks };
}

export async function getAllSocialLinks(): Promise<SocialLink[]> {
  const { data, error } = await supabase
    .from('site_social_links')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createSocialLink(link: Omit<SocialLink, 'id' | 'created_at'>): Promise<SocialLink> {
  const { data, error } = await supabase
    .from('site_social_links')
    .insert([link])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSocialLink(id: string, updates: Partial<SocialLink>): Promise<SocialLink> {
  const { data, error } = await supabase
    .from('site_social_links')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSocialLink(id: string): Promise<void> {
  const { error } = await supabase
    .from('site_social_links')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
