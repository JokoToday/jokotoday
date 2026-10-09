import { supabase } from "../../lib/supabase";
export type SpecialsCatalog = {
  batch?: {
    id: string;
    title: string;
    pickup_start_at: string;
    pickup_end_at: string;
    sales_end_at: string;
    location: { name_en: string; name_th: string; maps_url: string | null };
  };
  items?: {
    id: string;
    name_en: string;
    name_th: string;
    image: string | null;
    price_satang: number;
    regular_price_satang: number;
    available: number;
    max_per_customer: number | null;
  }[];
};
export type SpecialsState = {
  checkout: {
    order_id: string;
    inventory_state: string;
    financial_state: string;
    fulfillment_state: string;
    payment_deadline: string;
    verification_deadline: string;
  };
  order: {
    id: string;
    order_number: string;
    total_amount: number;
    payment_status: string;
    status: string;
    pickup: {
      name_en: string;
      name_th: string;
      maps_url: string | null;
      start_at: string;
      end_at: string;
    };
  };
  qr_payload: string | null;
  receiver_label: string;
  server_now: string;
};
export async function specialsRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export const specialsTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function specialsError(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Could not complete this action. Refresh before retrying.";
}
