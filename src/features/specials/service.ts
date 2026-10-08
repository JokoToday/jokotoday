import { supabase } from "../../lib/supabase";
import type {
  SpecialsAuditEvent,
  SpecialsBatch,
  SpecialsItem,
  SpecialsLocation,
  SpecialsOperation,
  SpecialsProduct,
} from "./contracts";

export async function loadSpecialsWorkspace() {
  const [batches, products, locations] = await Promise.all([
    supabase
      .from("specials_batches")
      .select(
        "id,title,business_date,status,pickup_location_id,sales_start_at,sales_end_at,pickup_start_at,pickup_end_at,notes_internal,version",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("cms_products")
      .select("id,name_en,name_th,name_zh,price,image,is_active")
      .order("sort_order"),
    supabase
      .from("cms_pickup_locations")
      .select("id,name_en,name_th,name_zh,maps_url")
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  for (const response of [batches, products, locations])
    if (response.error) throw response.error;
  return {
    batches: batches.data as SpecialsBatch[],
    products: products.data as SpecialsProduct[],
    locations: locations.data as SpecialsLocation[],
  };
}
export async function loadSpecialsBatch(batchId: string) {
  const [items, events] = await Promise.all([
    supabase
      .from("specials_items")
      .select(
        "id,batch_id,product_id,regular_price_satang,special_price_satang,quantity_allocated,quantity_available,quantity_held,quantity_committed,max_per_customer,is_enabled,version",
      )
      .eq("batch_id", batchId)
      .order("created_at"),
    supabase
      .from("specials_audit_events")
      .select(
        "id,batch_id,item_id,actor_id,event_type,quantity_delta,source_reference,reason,created_at",
      )
      .eq("batch_id", batchId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (items.error) throw items.error;
  if (events.error) throw events.error;
  return {
    items: items.data as SpecialsItem[],
    events: events.data as SpecialsAuditEvent[],
  };
}
export async function performSpecialsOperation(operation: SpecialsOperation) {
  const { data, error } = await supabase.rpc("admin_specials_action_v1", {
    p_action: operation.action,
    p_request: operation.request,
    p_operation_key: operation.operationKey,
  });
  if (error) throw error;
  if (!data?.batch?.id)
    throw new Error(
      "Specials did not return a batch. Retry this operation before making another change.",
    );
  return data as { batch: SpecialsBatch; item: SpecialsItem | null };
}
