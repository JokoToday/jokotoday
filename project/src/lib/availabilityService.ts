import { supabase } from './supabase';

export interface PickupDay {
  id: string;
  day_key: string;
  label: string;
  label_en: string | null;
  label_th: string | null;
  cutoff_time: string;
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
  pickup_label_en: string;
  pickup_label_th: string;
  pickup_day: string;
  location: string;
  cutoff_day: string;
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
  is_active: boolean;
}

export type PickupStatus = 'available' | 'closing_soon' | 'closed' | 'sold_out' | 'holiday';

const DAY_KEY_MAP: Record<string, string> = {
  'Friday - Mae Rim': 'friday_maerim',
  'Saturday - Mae Rim': 'saturday_maerim',
  'Sunday - In-Town': 'sunday_intown',
};

function isCutoffPassed(cutoffDay: string, cutoffTime: string): boolean {
  const dayMap: Record<string, number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
  };

  const cutoffDayOfWeek = dayMap[cutoffDay];
  if (cutoffDayOfWeek === undefined) {
    console.warn(`[Cutoff] Unknown day: ${cutoffDay}`);
    return true;
  }

  const [hours, minutes] = cutoffTime.split(':').map(Number);

  // Get current time in Asia/Bangkok timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const partsMap: Record<string, string> = {};
  parts.forEach((part) => {
    partsMap[part.type] = part.value;
  });

  const nowInBangkok = new Date(
    parseInt(partsMap.year),
    parseInt(partsMap.month) - 1,
    parseInt(partsMap.day),
    parseInt(partsMap.hour),
    parseInt(partsMap.minute),
    parseInt(partsMap.second)
  );

  const currentDayOfWeek = nowInBangkok.getDay();
  let cutoffDate = new Date(nowInBangkok);

  // Calculate the cutoff date for this week
  if (cutoffDayOfWeek <= currentDayOfWeek) {
    // Cutoff day was earlier in the week or is today
    const daysBack = currentDayOfWeek - cutoffDayOfWeek;
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  } else {
    // Cutoff day is later in the week
    const daysForward = cutoffDayOfWeek - currentDayOfWeek;
    cutoffDate.setDate(cutoffDate.getDate() + daysForward);
  }

  // Set the cutoff time
  cutoffDate.setHours(hours, minutes, 0, 0);

  const isPassed = nowInBangkok > cutoffDate;

  // Debug logging
  const nowStr = nowInBangkok.toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cutoffStr = cutoffDate.toLocaleString('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  console.log(
    `[Cutoff Check] Pickup: ${cutoffDay} ${cutoffTime} | Now: ${nowStr} | Cutoff: ${cutoffStr} | Passed: ${isPassed}`
  );

  return isPassed;
}

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

export function isDayOpenForOrdering(pickupDay: PickupDay): boolean {
  if (!pickupDay.is_open) {
    return false;
  }
  return !isCutoffPassed(pickupDay.cutoff_day, pickupDay.cutoff_time);
}

export function getDayKey(label: string): string {
  return DAY_KEY_MAP[label] || label;
}

export function getPickupDayLabel(pickupDay: PickupDay, language: 'en' | 'th' = 'en'): string {
  if (language === 'th' && pickupDay.label_th) {
    return pickupDay.label_th;
  }
  if (language === 'en' && pickupDay.label_en) {
    return pickupDay.label_en;
  }
  return pickupDay.label;
}

export function getCutoffDayAndTime(pickupDay: PickupDay): string {
  return `${pickupDay.cutoff_day} at ${pickupDay.cutoff_time}`;
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
