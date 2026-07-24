type PickupDaySchedule = {
  day_key: string;
  pickup_weekday: number;
};

type PickupCutoffSchedule = {
  day_key: string;
  cutoff_day: string;
  cutoff_time: string;
};

const WEEKDAY_NUMBER: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getBangkokDateTime(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ));
}

export function getNextPickupDate(
  pickupDay: PickupDaySchedule,
  cutoffRule: PickupCutoffSchedule,
  now = new Date(),
): string | null {
  const cutoffWeekday = WEEKDAY_NUMBER[cutoffRule.cutoff_day];
  const [cutoffHour, cutoffMinute] = cutoffRule.cutoff_time.split(':').map(Number);
  if (
    cutoffRule.day_key !== pickupDay.day_key
    || !Number.isInteger(pickupDay.pickup_weekday)
    || pickupDay.pickup_weekday < 0
    || pickupDay.pickup_weekday > 6
    || cutoffWeekday === undefined
    || !Number.isInteger(cutoffHour)
    || !Number.isInteger(cutoffMinute)
  ) {
    return null;
  }

  const bangkokNow = getBangkokDateTime(now);
  const pickupDate = new Date(bangkokNow);
  pickupDate.setUTCHours(0, 0, 0, 0);
  pickupDate.setUTCDate(
    pickupDate.getUTCDate()
      + (pickupDay.pickup_weekday - pickupDate.getUTCDay() + 7) % 7,
  );

  const daysFromCutoffToPickup = (pickupDay.pickup_weekday - cutoffWeekday + 7) % 7;
  if (daysFromCutoffToPickup === 0) return null;

  const cutoffDate = new Date(pickupDate);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysFromCutoffToPickup);
  cutoffDate.setUTCHours(cutoffHour, cutoffMinute, 0, 0);

  if (bangkokNow > cutoffDate) {
    pickupDate.setUTCDate(pickupDate.getUTCDate() + 7);
  }

  return pickupDate.toISOString().slice(0, 10);
}
