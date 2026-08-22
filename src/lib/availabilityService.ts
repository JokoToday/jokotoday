import { supabase } from './supabase';

export interface PickupDay {
  id: string;
  day_key: string;
  label: string;
  label_en: string | null;
  label_th: string | null;
  label_zh?: string | null;
  pickup_weekday: number;
  location_id: string | null;
  cutoff_time: string;
  cutoff_day: string;
  is_open: boolean;
  sort_order: number;
  cutoff_rule?: CutoffRule | null;
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

const dayKeyByLabel = new Map<string, string>();

function getEquivalentDayLabels(label: string): string[] {
  return Array.from(new Set([
    label,
    label.replace(/ – /g, ' - '),
    label.replace(/ - /g, ' – '),
  ]));
}

function registerPickupDay(day: PickupDay) {
  const labels = [day.label, day.label_en, day.label_th, day.label_zh]
    .filter((value): value is string => Boolean(value));

  labels.forEach((label) => {
    getEquivalentDayLabels(label).forEach((variant) => dayKeyByLabel.set(variant, day.day_key));
  });
  dayKeyByLabel.set(day.day_key, day.day_key);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function getBangkokCalendarDate(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const values: Record<string, string> = {};
  formatter.formatToParts(new Date()).forEach((part) => {
    values[part.type] = part.value;
  });

  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    12,
  ));
}

export function getNextPickupDate(pickupDay: PickupDay): Date | null {
  if (!Number.isInteger(pickupDay.pickup_weekday)
      || pickupDay.pickup_weekday < 0
      || pickupDay.pickup_weekday > 6) {
    return null;
  }

  const date = getBangkokCalendarDate();
  const daysAhead = (pickupDay.pickup_weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date;
}

export function isPickupDatePast(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
  if (!match) return false;
  const pickup = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return pickup.getTime() < getBangkokCalendarDate().getTime();
}

function isCutoffPassed(cutoffDay: string, cutoffTime: string): boolean {
  const cutoffDayOfWeek = WEEKDAY_INDEX[cutoffDay];
  if (cutoffDayOfWeek === undefined) {
    console.warn(`[Cutoff] Unknown day: ${cutoffDay}`);
    return true;
  }

  const [hours, minutes] = cutoffTime.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    console.warn(`[Cutoff] Invalid time: ${cutoffTime}`);
    return true;
  }

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

  const partsMap: Record<string, string> = {};
  formatter.formatToParts(new Date()).forEach((part) => {
    partsMap[part.type] = part.value;
  });

  const nowInBangkok = new Date(
    Number(partsMap.year),
    Number(partsMap.month) - 1,
    Number(partsMap.day),
    Number(partsMap.hour),
    Number(partsMap.minute),
    Number(partsMap.second),
  );

  const currentDayOfWeek = nowInBangkok.getDay();
  const cutoffDate = new Date(nowInBangkok);
  const dayDelta = cutoffDayOfWeek <= currentDayOfWeek
    ? -(currentDayOfWeek - cutoffDayOfWeek)
    : cutoffDayOfWeek - currentDayOfWeek;

  cutoffDate.setDate(cutoffDate.getDate() + dayDelta);
  cutoffDate.setHours(hours, minutes, 0, 0);
  return nowInBangkok >= cutoffDate;
}

export async function getPickupDays(): Promise<PickupDay[]> {
  const [daysResult, rulesResult] = await Promise.all([
    supabase
      .from('cms_pickup_days')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('pickup_cutoff_rules')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  if (daysResult.error) {
    console.error('Error fetching pickup days:', daysResult.error);
    return [];
  }
  if (rulesResult.error) {
    console.error('Error fetching authoritative cutoff rules:', rulesResult.error);
    return [];
  }

  const rulesByDayKey = new Map<string, CutoffRule>();
  (rulesResult.data || []).forEach((rule) => {
    if (rule.day_key) rulesByDayKey.set(rule.day_key, rule as CutoffRule);
  });

  const days = (daysResult.data || []).map((row) => {
    const rule = rulesByDayKey.get(row.day_key) || null;
    const day: PickupDay = {
      ...(row as PickupDay),
      cutoff_day: rule?.cutoff_day || '',
      cutoff_time: rule?.cutoff_time || '',
      // A slot without an active authoritative cutoff rule must not be orderable.
      is_open: Boolean(row.is_open && rule),
      cutoff_rule: rule,
    };
    registerPickupDay(day);
    return day;
  });

  return days;
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
  location: string,
): PickupOverride | null {
  const dateStr = date.toISOString().split('T')[0];
  return overrides.find((override) =>
    override.date === dateStr
    && override.pickup_day === pickupDay
    && override.location === location
    && override.is_active,
  ) || null;
}

export function getEffectiveCutoff(
  pickupDay: PickupDay,
  override: PickupOverride | null,
): { cutoffDay: string; cutoffTime: string } | null {
  if (!pickupDay.cutoff_day || !pickupDay.cutoff_time) return null;

  if (override?.override_type === 'custom_cutoff'
      && override.custom_cutoff_day
      && override.custom_cutoff_time) {
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
  if (!pickupDay.is_open || !pickupDay.cutoff_rule) return false;
  return !isCutoffPassed(pickupDay.cutoff_day, pickupDay.cutoff_time);
}

export function getDayKey(labelOrKey: string): string {
  return dayKeyByLabel.get(labelOrKey) || labelOrKey;
}

export function getPickupDayLabel(
  pickupDay: PickupDay,
  language: 'en' | 'th' | 'zh' = 'en',
): string {
  if (language === 'zh' && pickupDay.label_zh) return pickupDay.label_zh;
  if (language === 'th' && pickupDay.label_th) return pickupDay.label_th;
  if (language === 'en' && pickupDay.label_en) return pickupDay.label_en;
  return pickupDay.label;
}

export function getCutoffDayAndTime(pickupDay: PickupDay): string {
  if (!pickupDay.cutoff_day || !pickupDay.cutoff_time) return 'Not configured';
  return `${pickupDay.cutoff_day} at ${pickupDay.cutoff_time}`;
}

export function getAvailabilityStatus(
  product: any,
  selectedDay: string | null,
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
  const equivalentLabels = getEquivalentDayLabels(selectedDay);
  const availableDays = product.available_days as string[] || [];
  const stockByDay = product.stock_by_day as Record<string, number> || {};

  const isOfferedToday = availableDays.length === 0
    || availableDays.includes(selectedDay)
    || availableDays.includes(dayKey)
    || equivalentLabels.some((label) => availableDays.includes(label));

  if (!isOfferedToday) {
    return {
      isAvailable: false,
      isSoldOut: false,
      isNotOfferedToday: true,
      remainingStock: 0,
    };
  }

  const legacyStock = equivalentLabels
    .map((label) => stockByDay[label])
    .find((value) => value !== undefined);
  const remainingStock = stockByDay[dayKey]
    ?? stockByDay[selectedDay]
    ?? legacyStock
    ?? product.stock_remaining
    ?? 0;
  const isSoldOut = remainingStock <= 0;

  return {
    isAvailable: !isSoldOut,
    isSoldOut,
    isNotOfferedToday: false,
    remainingStock,
  };
}
