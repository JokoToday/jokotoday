import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  cutoffDay: string;
  cutoffTime: string;
  pickupWeekday: number;
  language: 'en' | 'th' | 'zh';
  compact?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  passed: boolean;
}

const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getBangkokWallClock(): Date {
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

  const values: Record<string, string> = {};
  formatter.formatToParts(new Date()).forEach((part) => {
    values[part.type] = part.value;
  });

  return new Date(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
}

export function CountdownTimer({
  cutoffDay,
  cutoffTime,
  pickupWeekday,
  language,
  compact = false,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    const calculateTimeRemaining = (): TimeRemaining | null => {
      const cutoffWeekday = DAY_INDEX[cutoffDay];
      if (cutoffWeekday === undefined || pickupWeekday < 0 || pickupWeekday > 6) return null;

      const [hours, minutes] = cutoffTime.split(':').map(Number);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;

      const now = getBangkokWallClock();
      const pickupDate = new Date(now);
      pickupDate.setHours(0, 0, 0, 0);
      const daysUntilPickup = (pickupWeekday - now.getDay() + 7) % 7;
      pickupDate.setDate(pickupDate.getDate() + daysUntilPickup);

      const daysBeforePickup = (pickupWeekday - cutoffWeekday + 7) % 7;
      const cutoffDate = new Date(pickupDate);
      cutoffDate.setDate(cutoffDate.getDate() - daysBeforePickup);
      cutoffDate.setHours(hours, minutes, 0, 0);

      if (now >= cutoffDate) {
        return { days: 0, hours: 0, minutes: 0, passed: true };
      }

      const diffMs = cutoffDate.getTime() - now.getTime();
      const diffSecs = Math.floor(diffMs / 1000);

      return {
        days: Math.floor(diffSecs / (24 * 3600)),
        hours: Math.floor((diffSecs % (24 * 3600)) / 3600),
        minutes: Math.floor((diffSecs % 3600) / 60),
        passed: false,
      };
    };

    const update = () => setTimeRemaining(calculateTimeRemaining());
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [cutoffDay, cutoffTime, pickupWeekday]);

  if (!timeRemaining) return null;

  if (timeRemaining.passed) {
    const closedText = language === 'th'
      ? 'ปิดรับออเดอร์สำหรับรอบนี้แล้ว'
      : language === 'zh'
      ? '此取货时段已截止'
      : 'Closed for this pickup';

    return (
      <div className={`text-red-600 font-medium ${compact ? 'text-sm' : ''}`}>
        {closedText}
      </div>
    );
  }

  if (language === 'th') {
    const daysText = timeRemaining.days > 0 ? `${timeRemaining.days} วัน ` : '';
    const hoursText = timeRemaining.hours > 0 ? `${timeRemaining.hours} ชม. ` : '';
    const minutesText = `${timeRemaining.minutes} นาที`;

    return (
      <div className={`text-orange-600 font-medium ${compact ? 'text-sm' : ''}`}>
        ปิดรับออเดอร์ในอีก: {daysText}{hoursText}{minutesText}
      </div>
    );
  }

  if (language === 'zh') {
    const parts: string[] = [];
    if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}天`);
    if (timeRemaining.hours > 0) parts.push(`${timeRemaining.hours}小时`);
    parts.push(`${timeRemaining.minutes}分钟`);

    return (
      <div className={`text-orange-600 font-medium ${compact ? 'text-sm' : ''}`}>
        距截止：{parts.join('')}
      </div>
    );
  }

  const parts: string[] = [];
  if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}d`);
  if (timeRemaining.hours > 0) parts.push(`${timeRemaining.hours}h`);
  parts.push(`${timeRemaining.minutes}m`);

  return (
    <div className={`text-orange-600 font-medium ${compact ? 'text-sm' : ''}`}>
      Closes in: {parts.join(' ')}
    </div>
  );
}
