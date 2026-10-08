export type SpecialsBatch = {
  id: string;
  title: string;
  business_date: string;
  status: "draft" | "prepared" | "closed" | "cancelled";
  pickup_location_id: string;
  sales_start_at: string;
  sales_end_at: string;
  pickup_start_at: string;
  pickup_end_at: string;
  notes_internal: string;
  version: number;
};
export type SpecialsItem = {
  id: string;
  batch_id: string;
  product_id: string;
  regular_price_satang: number;
  special_price_satang: number;
  quantity_allocated: number;
  quantity_available: number;
  quantity_held: number;
  quantity_committed: number;
  max_per_customer: number | null;
  is_enabled: boolean;
  version: number;
};
export type SpecialsAuditEvent = {
  id: string;
  batch_id: string;
  item_id: string | null;
  actor_id: string;
  event_type: string;
  quantity_delta: number;
  source_reference: string | null;
  reason: string;
  created_at: string;
};
export type SpecialsProduct = {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string | null;
  price: number;
  image: string | null;
  is_active: boolean;
};
export type SpecialsLocation = {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string | null;
  maps_url: string | null;
};
export type SpecialsAction =
  "save_batch" | "save_item" | "transfer" | "prepare" | "close" | "cancel";
export type SpecialsOperation = {
  action: SpecialsAction;
  request: Record<string, unknown>;
  operationKey: string;
};
