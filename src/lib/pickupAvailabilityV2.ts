import { supabase } from './supabase';

export interface PickupAvailabilityLocation {
  id: string;
  name_en: string;
  name_th: string;
  name_zh: string | null;
  description_en: string | null;
  description_th: string | null;
  description_zh: string | null;
  maps_url: string | null;
  sort_order: number;
}

export interface PickupAvailabilityRow {
  pickup_date_id: string;
  pickup_date: string;
  order_cutoff_at: string;
  schedule_id: string;
  schedule_key: string;
  schedule_label_en: string;
  schedule_label_th: string | null;
  schedule_label_zh: string | null;
  product_id: string;
  remaining_quantity: number;
  locations: PickupAvailabilityLocation[];
}

export interface CartAvailabilityRequirement {
  productId: string;
  quantity: number;
  nameEn?: string | null;
  nameTh?: string | null;
  nameZh?: string | null;
}

export interface CommonPickupDateAvailability {
  pickupDateId: string;
  pickupDate: string;
  orderCutoffAt: string;
  scheduleId: string;
  scheduleKey: string;
  scheduleLabelEn: string;
  scheduleLabelTh: string | null;
  scheduleLabelZh: string | null;
  locations: PickupAvailabilityLocation[];
  remainingByProduct: Record<string, number>;
}

export interface PickupDateProductIssue {
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
  reason: 'not_offered' | 'insufficient_quantity';
  nameEn: string | null;
  nameTh: string | null;
  nameZh: string | null;
}

function parseLocations(value: unknown): PickupAvailabilityLocation[] {
  if (!Array.isArray(value)) return [];

  return value.filter((location): location is PickupAvailabilityLocation => {
    if (!location || typeof location !== 'object') return false;
    const candidate = location as Partial<PickupAvailabilityLocation>;
    return typeof candidate.id === 'string'
      && typeof candidate.name_en === 'string'
      && typeof candidate.name_th === 'string'
      && typeof candidate.sort_order === 'number';
  });
}

function normalizeRows(value: unknown): PickupAvailabilityRow[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const candidate = row as Record<string, unknown>;

    if (
      typeof candidate.pickup_date_id !== 'string'
      || typeof candidate.pickup_date !== 'string'
      || typeof candidate.order_cutoff_at !== 'string'
      || typeof candidate.schedule_id !== 'string'
      || typeof candidate.schedule_key !== 'string'
      || typeof candidate.schedule_label_en !== 'string'
      || typeof candidate.product_id !== 'string'
      || typeof candidate.remaining_quantity !== 'number'
    ) {
      return [];
    }

    return [{
      pickup_date_id: candidate.pickup_date_id,
      pickup_date: candidate.pickup_date,
      order_cutoff_at: candidate.order_cutoff_at,
      schedule_id: candidate.schedule_id,
      schedule_key: candidate.schedule_key,
      schedule_label_en: candidate.schedule_label_en,
      schedule_label_th: typeof candidate.schedule_label_th === 'string' ? candidate.schedule_label_th : null,
      schedule_label_zh: typeof candidate.schedule_label_zh === 'string' ? candidate.schedule_label_zh : null,
      product_id: candidate.product_id,
      remaining_quantity: candidate.remaining_quantity,
      locations: parseLocations(candidate.locations),
    }];
  });
}

export async function getCustomerPickupAvailabilityV2(
  productIds?: string[],
): Promise<PickupAvailabilityRow[]> {
  const uniqueProductIds = productIds
    ? Array.from(new Set(productIds.filter(Boolean)))
    : [];

  const { data, error } = await supabase.rpc('get_customer_pickup_availability_v2', {
    p_product_ids: uniqueProductIds.length > 0 ? uniqueProductIds : null,
  });

  if (error) {
    throw new Error(`Could not load Pickup v2 availability: ${error.message}`);
  }

  return normalizeRows(data);
}

function aggregateRequirements(requirements: CartAvailabilityRequirement[]): Map<string, CartAvailabilityRequirement> {
  const requiredByProduct = new Map<string, CartAvailabilityRequirement>();

  requirements.forEach((requirement) => {
    const { productId, quantity } = requirement;
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) return;
    const current = requiredByProduct.get(productId);
    if (current) {
      requiredByProduct.set(productId, {
        ...current,
        quantity: current.quantity + quantity,
        nameEn: current.nameEn || requirement.nameEn,
        nameTh: current.nameTh || requirement.nameTh,
        nameZh: current.nameZh || requirement.nameZh,
      });
      return;
    }
    requiredByProduct.set(productId, { ...requirement });
  });

  return requiredByProduct;
}

export function getCommonPickupDates(
  rows: PickupAvailabilityRow[],
  requirements: CartAvailabilityRequirement[],
): CommonPickupDateAvailability[] {
  const requiredByProduct = aggregateRequirements(requirements);

  if (requiredByProduct.size === 0) return [];

  const rowsByDate = new Map<string, PickupAvailabilityRow[]>();
  rows.forEach((row) => {
    const current = rowsByDate.get(row.pickup_date_id) || [];
    current.push(row);
    rowsByDate.set(row.pickup_date_id, current);
  });

  const commonDates: CommonPickupDateAvailability[] = [];

  rowsByDate.forEach((dateRows) => {
    const byProduct = new Map(dateRows.map((row) => [row.product_id, row]));

    const supportsEveryProduct = Array.from(requiredByProduct.values()).every(({ productId, quantity }) => {
      const row = byProduct.get(productId);
      return Boolean(row && row.remaining_quantity >= quantity);
    });

    if (!supportsEveryProduct) return;

    const representative = dateRows[0];
    commonDates.push({
      pickupDateId: representative.pickup_date_id,
      pickupDate: representative.pickup_date,
      orderCutoffAt: representative.order_cutoff_at,
      scheduleId: representative.schedule_id,
      scheduleKey: representative.schedule_key,
      scheduleLabelEn: representative.schedule_label_en,
      scheduleLabelTh: representative.schedule_label_th,
      scheduleLabelZh: representative.schedule_label_zh,
      locations: representative.locations,
      remainingByProduct: Object.fromEntries(
        Array.from(requiredByProduct.keys()).map((productId) => [
          productId,
          byProduct.get(productId)?.remaining_quantity || 0,
        ]),
      ),
    });
  });

  return commonDates.sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
}

export function getPickupDateProductIssues(
  rows: PickupAvailabilityRow[],
  requirements: CartAvailabilityRequirement[],
  pickupDateId: string,
): PickupDateProductIssue[] {
  if (!pickupDateId) return [];
  const requiredByProduct = aggregateRequirements(requirements);
  if (requiredByProduct.size === 0) return [];

  const rowsForDate = rows.filter((row) => row.pickup_date_id === pickupDateId);
  const byProduct = new Map(rowsForDate.map((row) => [row.product_id, row]));

  return Array.from(requiredByProduct.values()).flatMap((requirement) => {
    const row = byProduct.get(requirement.productId);
    const availableQuantity = Math.max(0, row?.remaining_quantity || 0);
    if (!row) {
      return [{
        productId: requirement.productId,
        requestedQuantity: requirement.quantity,
        availableQuantity: 0,
        reason: 'not_offered' as const,
        nameEn: requirement.nameEn || null,
        nameTh: requirement.nameTh || null,
        nameZh: requirement.nameZh || null,
      }];
    }
    if (availableQuantity < requirement.quantity) {
      return [{
        productId: requirement.productId,
        requestedQuantity: requirement.quantity,
        availableQuantity,
        reason: 'insufficient_quantity' as const,
        nameEn: requirement.nameEn || null,
        nameTh: requirement.nameTh || null,
        nameZh: requirement.nameZh || null,
      }];
    }
    return [];
  });
}
