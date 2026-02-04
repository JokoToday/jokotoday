import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG: Log Supabase connection on startup
console.log('🔗 Supabase Client Initialized');
console.log('   VITE_SUPABASE_URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    redirectTo: 'https://joko-today-pre-order-yamv.bolt.host/auth/callback'
  }
});

export type Category = {
  id: string;
  name_en: string;
  name_th: string;
  slug: string;
  display_order: number;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string;
  name_en: string;
  name_th: string;
  description_en: string;
  description_th: string;
  price: number;
  image_url: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_location: string;
  pickup_day: string;
  total_amount: number;
  status: string;
  notes: string;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price_at_order: number;
  created_at: string;
};
