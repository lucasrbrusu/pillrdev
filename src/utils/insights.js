const pad2 = (n) => String(n).padStart(2, '0');

export const toLocalDateKey = (dateLike) => {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const parseDateOnlyToLocalNoon = (dateKey) => {
  if (!dateKey || typeof dateKey !== 'string') return null;
  const [y, m, d] = dateKey.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const local = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(local.getTime()) ? null : local;
};

export const startOfWeekMonday = (anchor = new Date(), weekOffset = 0) => {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  // JS: Sun=0..Sat=6. Convert to Monday=0..Sunday=6.
  const mondayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayIndex - weekOffset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const startOfMonth = (anchor = new Date(), monthOffset = 0) => {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthOffset, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const isWithinRange = (value, startInclusive, endExclusive) => {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= startInclusive.getTime() && d.getTime() < endExclusive.getTime();
};

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const formatRangeLabel = (start, endExclusive) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = addDays(endExclusive, -1);
  const opts = { month: 'short', day: 'numeric' };
  const startText = startDate.toLocaleDateString(undefined, opts);
  const endText = endDate.toLocaleDateString(undefined, opts);
  const yearText =
    startDate.getFullYear() === endDate.getFullYear()
      ? String(startDate.getFullYear())
      : `${startDate.getFullYear()} / ${endDate.getFullYear()}`;

  return `${startText} - ${endText}, ${yearText}`;
};

export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [time, period] = timeStr.split(' ');
  if (!time) return null;
  const [hourStr, minuteStr] = time.split(':');
  let hours = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const normalizedPeriod = (period || '').toUpperCase();
  if (normalizedPeriod === 'PM' && hours !== 12) hours += 12;
  if (normalizedPeriod === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const getSleepDurationMinutes = (sleepTime, wakeTime) => {
  const start = parseTimeToMinutes(sleepTime);
  const end = parseTimeToMinutes(wakeTime);
  if (start === null || end === null) return null;
  const minutes = end >= start ? end - start : 24 * 60 - start + end;
  return minutes;
};

export const formatDurationHuman = (ms) => {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalMinutes = Math.round(safeMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

