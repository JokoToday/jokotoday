export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price_at_order: number;
}

export interface Order {
  id: string;
  order_number: string;
  order_items: OrderItem[];
  total_amount: number;
  pickup_day: string;
  pickup_date: string;
  pickup_location_id: string | null;
  status: string;
  payment_status: string;
  created_at: string;
  purchase_type?: 'online' | 'walk_in';
  walk_in_amount?: number;
  loyalty_points_earned?: number;
}

export interface PickupLocation {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string | null;
  maps_url: string | null;
}

export interface PickupDay {
  id: string;
  day_key: string;
  label: string;
  label_en: string;
  label_th: string;
  label_zh: string;
  location_id: string | null;
}

export type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';
