import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xvhualoeboobulwgmkla.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2aHVhbG9lYm9vYnVsd2dta2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzQ5OTAsImV4cCI6MjA4NTAxMDk5MH0.GysjJZ5sLbJGBcU1qSh9COLTJ7Spf_IAOnpKbk4yjGA';

console.log('🔗 Supabase Client Initialized');
console.log('   Supabase URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});

export type Category = {
  id: string;
  name_en: string;
  name_th: string;
  name_zh?: string | null;
  slug: string;
  display_order: number;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string;
  name_en: string;
  name_th: string;
  name_zh?: string | null;
  description_en: string;
  description_th: string;
  description_zh?: string | null;
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
