import { supabase } from './supabase';

export interface CMSCategory {
  id: string;
  slug: string;
  title_en: string;
  title_th: string;
  description_en: string | null;
  description_th: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CMSProduct {
  id: string;
  slug: string;
  category_id: string;
  name_en: string;
  name_th: string;
  desc_en: string;
  desc_th: string;
  price: number;
  image: string | null;
  is_sold_out: boolean;
  is_active: boolean;
  sort_order: number;
  stock_total: number;
  stock_remaining: number;
  available_days?: string[];
  stock_by_day?: Record<string, number>;
}

export interface CMSPage {
  id: string;
  page_key: string;
  title_en: string;
  title_th: string;
  body_en: string;
  body_th: string;
}

export interface CMSLabel {
  id: string;
  key: string;
  text_en: string;
  text_th: string;
}

export interface CMSSetting {
  id: string;
  setting_key: string;
  value: string;
}

export interface CMSPickupLocation {
  id: string;
  name_en: string;
  name_th: string;
  description_en: string | null;
  description_th: string | null;
  maps_url: string | null;
  available_days: string[];
  is_active: boolean;
  sort_order: number;
}

// Categories
export async function getCategories(): Promise<CMSCategory[]> {
  const { data, error } = await supabase
    .from('cms_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCategoryBySlug(slug: string): Promise<CMSCategory | null> {
  const { data, error } = await supabase
    .from('cms_categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Products
export async function getProducts(categoryId?: string): Promise<CMSProduct[]> {
  let query = supabase
    .from('cms_products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getProductBySlug(slug: string): Promise<CMSProduct | null> {
  const { data, error } = await supabase
    .from('cms_products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Pages
export async function getPageByKey(pageKey: string): Promise<CMSPage | null> {
  const { data, error } = await supabase
    .from('cms_pages')
    .select('*')
    .eq('page_key', pageKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllPages(): Promise<CMSPage[]> {
  const { data, error } = await supabase
    .from('cms_pages')
    .select('*')
    .order('page_key', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Labels
export async function getLabel(key: string): Promise<CMSLabel | null> {
  const { data, error } = await supabase
    .from('cms_labels')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllLabels(): Promise<CMSLabel[]> {
  const { data, error } = await supabase
    .from('cms_labels')
    .select('*');

  if (error) throw error;
  return data || [];
}

// Settings
export async function getSetting(key: string): Promise<CMSSetting | null> {
  const { data, error } = await supabase
    .from('cms_settings')
    .select('*')
    .eq('setting_key', key)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllSettings(): Promise<CMSSetting[]> {
  const { data, error } = await supabase
    .from('cms_settings')
    .select('*');

  if (error) throw error;
  return data || [];
}

// Pickup Locations
export async function getPickupLocations(): Promise<CMSPickupLocation[]> {
  const { data, error } = await supabase
    .from('cms_pickup_locations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getPickupLocationById(id: string): Promise<CMSPickupLocation | null> {
  const { data, error } = await supabase
    .from('cms_pickup_locations')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Image URLs
export async function getImageUrl(key: string, fallback: string = ''): Promise<string> {
  const setting = await getSetting(key);
  return setting?.value || fallback;
}

export async function getImageUrls(): Promise<Record<string, string>> {
  const settings = await getAllSettings();
  const imageSettings = settings.filter(s => s.setting_key.endsWith('_image_url'));

  const urls: Record<string, string> = {};
  imageSettings.forEach(setting => {
    urls[setting.setting_key] = setting.value;
  });

  return urls;
}
