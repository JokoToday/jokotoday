import { supabase } from './supabase';
export { getNextPickupDate } from './pickupSchedule';

export interface PickupDay {
  id: string;
  day_key: string;
  pickup_weekday: number;
  label: string;
  label_en: string | null;
  label_th: string | null;
  label_zh?: string | null;
  /** Deprecated configuration mirror. Cutoff calculations use pickup_cutoff_rules. */
  cutoff_time: string;
  /** Deprecated configuration mirror. Cutoff calculations use pickup_cutoff_rules. */
  cutoff_day: string;
  is_open: boolean;
  sort_order: number;
}

export interface ProductAvailability {
  isAvailable: boolean;
  isSoldOut: boolean;
  isNotOfferedToday: boolean;
  remainingStock: number;
}

export interface CutoffRule {
  id: string;
  day_key: string;
  pickup_label_en: string;
  pickup_label_th: string;
  pickup_label_zh?: string | null;
  pickup_day: string;
  location: string;
  cutoff_day: string;
  cutoff_day_zh?: string | null;
  cutoff_time: string;
  is_active: boolean;
  sort_order: number;
}

export interface PickupOverride {
  id: string;
  date: string;
  pickup_day: string;
  location: string;
  override_type: 'closed' | 'custom_cutoff' | 'sold_out';
  custom_cutoff_day: string | null;
  custom_cutoff_time: string | null;
  note_en: string;
  note_th: string;
  note_zh?: string | null;
  is_active: boolean;
}

export type PickupStatus = 'available' | 'closing_soon' | 'closed' | 'sold_out' | 'holiday';

const DAY_KEY_MAP: Record<string, string> = {
  'Friday - Mae Rim': 'friday_maerim',
  'Saturday - Mae Rim': 'saturday_maerim',
  'Sunday - In-Town': 'sunday_intown',
};

export async function getPickupDays(): Promise<PickupDay[]> {
  const { data, error } = await supabase
    .from('cms_pickup_days')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching pickup days:', error);
    return [];
  }

  return data as PickupDay[];
}

export async function getCutoffRules(): Promise<CutoffRule[]> {
  const { data, error } = await supabase
    .from('pickup_cutoff_rules')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching cutoff rules:', error);
    return [];
  }

  return data as CutoffRule[];
}

export async function getAllCutoffRules(): Promise<CutoffRule[]> {
  const { data, error } = await supabase
    .from('pickup_cutoff_rules')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching all cutoff rules:', error);
    return [];
  }

  return data as CutoffRule[];
}

export async function getPickupOverrides(): Promise<PickupOverride[]> {
  const { data, error } = await supabase
    .from('pickup_overrides')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching pickup overrides:', error);
    return [];
  }

  return data as PickupOverride[];
}

export async function getAllPickupOverrides(): Promise<PickupOverride[]> {
  const { data, error } = await supabase
    .from('pickup_overrides')
    .select('*');

  if (error) {
    console.error('Error fetching all pickup overrides:', error);
    return [];
  }

  return data as PickupOverride[];
}

export function getOverrideForDate(
  overrides: PickupOverride[],
  date: Date,
  pickupDay: string,
  location: string
): PickupOverride | null {
  const dateStr = date.toISOString().split('T')[0];
  return (
    overrides.find(
      (o) =>
        o.date === dateStr &&
        o.pickup_day === pickupDay &&
        o.location === location &&
        o.is_active
    ) || null
  );
}

export function getEffectiveCutoff(
  pickupDay: PickupDay,
  override: PickupOverride | null
): { cutoffDay: string; cutoffTime: string } | null {
  if (!override || override.override_type !== 'custom_cutoff') {
    return {
      cutoffDay: pickupDay.cutoff_day,
      cutoffTime: pickupDay.cutoff_time,
    };
  }

  if (override.custom_cutoff_day && override.custom_cutoff_time) {
    return {
      cutoffDay: override.custom_cutoff_day,
      cutoffTime: override.custom_cutoff_time,
    };
  }

  return {
    cutoffDay: pickupDay.cutoff_day,
    cutoffTime: pickupDay.cutoff_time,
  };
}

export function isDayOpenForOrdering(
  pickupDay: PickupDay,
  cutoffRule: CutoffRule | undefined,
): boolean {
  return pickupDay.is_open
    && cutoffRule?.is_active === true
    && cutoffRule.day_key === pickupDay.day_key;
}

export function getDayKey(label: string): string {
  return DAY_KEY_MAP[label] || label;
}

export function getPickupDayLabel(pickupDay: PickupDay, language: 'en' | 'th' | 'zh' = 'en'): string {
  if (language === 'zh' && pickupDay.label_zh) {
    return pickupDay.label_zh;
  }
  if (language === 'th' && pickupDay.label_th) {
    return pickupDay.label_th;
  }
  if (language === 'en' && pickupDay.label_en) {
    return pickupDay.label_en;
  }
  return pickupDay.label;
}

export function getCutoffDayAndTime(cutoffRule: CutoffRule): string {
  return `${cutoffRule.cutoff_day} at ${cutoffRule.cutoff_time}`;
}

export function getAvailabilityStatus(
  product: any,
  selectedDay: string | null
): ProductAvailability {
  if (!selectedDay) {
    return {
      isAvailable: true,
      isSoldOut: false,
      isNotOfferedToday: false,
      remainingStock: 0,
    };
  }

  const dayKey = getDayKey(selectedDay);
  const availableDays = product.available_days as string[] || [];
  const stockByDay = product.stock_by_day as Record<string, number> || {};

  const isOfferedToday = availableDays.includes(selectedDay);

  if (!isOfferedToday) {
    return {
      isAvailable: false,
      isSoldOut: false,
      isNotOfferedToday: true,
      remainingStock: 0,
    };
  }

  const remainingStock = stockByDay[dayKey] ?? product.stock_remaining ?? 0;
  const isSoldOut = remainingStock <= 0;

  return {
    isAvailable: !isSoldOut,
    isSoldOut,
    isNotOfferedToday: false,
    remainingStock,
  };
}
