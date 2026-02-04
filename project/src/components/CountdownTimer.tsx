import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  cutoffDay: string;
  cutoffTime: string;
  language: 'en' | 'th';
  compact?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  passed: boolean;
}

export function CountdownTimer({
  cutoffDay,
  cutoffTime,
  language,
  compact = false,
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    const calculateTimeRemaining = () => {
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
      if (cutoffDayOfWeek === undefined) return null;

      const [hours, minutes] = cutoffTime.split(':').map(Number);

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

      const now = new Date(
        parseInt(partsMap.year),
        parseInt(partsMap.month) - 1,
        parseInt(partsMap.day),
        parseInt(partsMap.hour),
        parseInt(partsMap.minute),
        parseInt(partsMap.second)
      );

      const currentDayOfWeek = now.getDay();
      let cutoffDate = new Date(now);

      if (cutoffDayOfWeek <= currentDayOfWeek) {
        const daysBack = currentDayOfWeek - cutoffDayOfWeek;
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      } else {
        const daysForward = cutoffDayOfWeek - currentDayOfWeek;
        cutoffDate.setDate(cutoffDate.getDate() + daysForward);
      }

      cutoffDate.setHours(hours, minutes, 0, 0);

      const passed = now > cutoffDate;

      if (passed) {
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

    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 60000);

    setTimeRemaining(calculateTimeRemaining());

    return () => clearInterval(timer);
  }, [cutoffDay, cutoffTime]);

  if (!timeRemaining) return null;

  if (timeRemaining.passed) {
    const closedText = language === 'th'
      ? 'ปิดรับออเดอร์สำหรับรอบนี้แล้ว'
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
