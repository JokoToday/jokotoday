export interface PickupWindowHours {
  pickup_open_time?: string | null;
  pickup_close_time?: string | null;
  pickup_slot_minutes?: number | null;
  pickup_window_revision?: number | null;
}

export interface PickupWindow {
  start: string;
  end: string;
}

export interface PickupLocationSnapshot {
  name_en: string;
  name_th?: string | null;
  name_zh?: string | null;
  maps_url?: string | null;
}

function minutes(value: string | null | undefined): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d(?::00(?:\.0+)?)?$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

function clock(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function generatePickupWindows(hours: PickupWindowHours): PickupWindow[] {
  const open = minutes(hours.pickup_open_time);
  const close = minutes(hours.pickup_close_time);
  const interval = hours.pickup_slot_minutes;
  if (open === null || close === null || !interval || ![15, 30, 60].includes(interval)
    || close <= open || (close - open) % interval !== 0) return [];
  return Array.from({ length: (close - open) / interval }, (_, index) => ({
    start: clock(open + index * interval),
    end: clock(open + (index + 1) * interval),
  }));
}

export function pickupWindowLabel(start?: string | null, end?: string | null): string {
  return minutes(start) !== null && minutes(end) !== null ? `${start!.slice(0, 5)}–${end!.slice(0, 5)}` : '';
}

export function approximatePickupLabel(language: 'en' | 'th' | 'zh'): string {
  return language === 'th' ? 'ช่วงเวลารับสินค้าโดยประมาณ' : language === 'zh' ? '预计取货时间段' : 'Approximate pickup time';
}

export function snapshotLocationName(snapshot: PickupLocationSnapshot, language: 'en' | 'th' | 'zh'): string {
  return (language === 'th' ? snapshot.name_th : language === 'zh' ? snapshot.name_zh : snapshot.name_en) || snapshot.name_en;
}
