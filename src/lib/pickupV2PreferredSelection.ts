export interface PreferredPickupDateV2 {
  pickupDateId: string;
  pickupDate: string;
  scheduleId: string;
  scheduleKey: string;
  scheduleLabelEn?: string | null;
  scheduleLabelTh?: string | null;
  scheduleLabelZh?: string | null;
}

const GUEST_KEY = 'guest';

function storageKey(userId: string | null): string {
  return `joko-pickup-v2-preferred-date:${userId ?? GUEST_KEY}`;
}

function parseStored(value: string | null): PreferredPickupDateV2 | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PreferredPickupDateV2>;
    if (
      typeof parsed.pickupDateId !== 'string'
      || typeof parsed.pickupDate !== 'string'
      || typeof parsed.scheduleId !== 'string'
      || typeof parsed.scheduleKey !== 'string'
    ) {
      return null;
    }
    return {
      pickupDateId: parsed.pickupDateId,
      pickupDate: parsed.pickupDate,
      scheduleId: parsed.scheduleId,
      scheduleKey: parsed.scheduleKey,
      scheduleLabelEn: typeof parsed.scheduleLabelEn === 'string' ? parsed.scheduleLabelEn : null,
      scheduleLabelTh: typeof parsed.scheduleLabelTh === 'string' ? parsed.scheduleLabelTh : null,
      scheduleLabelZh: typeof parsed.scheduleLabelZh === 'string' ? parsed.scheduleLabelZh : null,
    };
  } catch {
    return null;
  }
}

export function readPreferredPickupDateV2(userId: string | null): PreferredPickupDateV2 | null {
  const direct = parseStored(localStorage.getItem(storageKey(userId)));
  if (direct || userId === null) return direct;

  const guest = parseStored(localStorage.getItem(storageKey(null)));
  if (guest) {
    localStorage.setItem(storageKey(userId), JSON.stringify(guest));
    localStorage.removeItem(storageKey(null));
  }
  return guest;
}

export function writePreferredPickupDateV2(
  userId: string | null,
  value: PreferredPickupDateV2 | null,
): void {
  if (!value) {
    localStorage.removeItem(storageKey(userId));
    return;
  }

  localStorage.setItem(storageKey(userId), JSON.stringify(value));
  if (userId !== null) {
    localStorage.removeItem(storageKey(null));
  }
}

export function clearPreferredPickupDateV2(userId: string | null): void {
  localStorage.removeItem(storageKey(userId));
  if (userId !== null) {
    localStorage.removeItem(storageKey(null));
  }
}
