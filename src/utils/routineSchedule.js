export const ROUTINE_REPEAT = Object.freeze({
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
});

export const ROUTINE_REPEAT_OPTIONS = [
  { label: 'Daily', value: ROUTINE_REPEAT.DAILY },
  { label: 'Specific weekdays', value: ROUTINE_REPEAT.WEEKLY },
  { label: 'Specific month days', value: ROUTINE_REPEAT.MONTHLY },
];

export const ROUTINE_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ROUTINE_WEEKDAY_ALIASES = {
  sun: 'Sun',
  sunday: 'Sun',
  mon: 'Mon',
  monday: 'Mon',
  tue: 'Tue',
  tues: 'Tue',
  tuesday: 'Tue',
  wed: 'Wed',
  weds: 'Wed',
  wednesday: 'Wed',
  thu: 'Thu',
  thur: 'Thu',
  thurs: 'Thu',
  thursday: 'Thu',
  fri: 'Fri',
  friday: 'Fri',
  sat: 'Sat',
  saturday: 'Sat',
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (error) {
        // Ignore malformed JSON and continue with comma parsing.
      }
    }
    return trimmed.split(',').map((item) => item.trim());
  }
  return [];
};

const normalizeRoutineWeekDays = (value) => {
  const selected = new Set();
  toArray(value).forEach((item) => {
    const normalized = String(item || '').trim().toLowerCase();
    const mapped = ROUTINE_WEEKDAY_ALIASES[normalized];
    if (mapped) selected.add(mapped);
  });
  return ROUTINE_WEEKDAY_LABELS.filter((label) => selected.has(label));
};

const normalizeRoutineMonthDays = (value) => {
  const selected = new Set();
  toArray(value).forEach((item) => {
    const day = Number.parseInt(String(item || '').trim(), 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) return;
    selected.add(day);
  });
  return Array.from(selected)
    .sort((a, b) => a - b)
    .map((day) => String(day));
};

export const normalizeRoutineRepeat = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (
    normalized === 'weekly' ||
    normalized === 'week' ||
    normalized === 'specific_weekdays' ||
    normalized === 'specific weekdays'
  ) {
    return ROUTINE_REPEAT.WEEKLY;
  }
  if (
    normalized === 'monthly' ||
    normalized === 'month' ||
    normalized === 'specific_month_days' ||
    normalized === 'specific month days'
  ) {
    return ROUTINE_REPEAT.MONTHLY;
  }
  return ROUTINE_REPEAT.DAILY;
};

export const normalizeRoutineDays = (value, repeat = ROUTINE_REPEAT.DAILY) => {
  const normalizedRepeat = normalizeRoutineRepeat(repeat);
  if (normalizedRepeat === ROUTINE_REPEAT.WEEKLY) {
    return normalizeRoutineWeekDays(value);
  }
  if (normalizedRepeat === ROUTINE_REPEAT.MONTHLY) {
    return normalizeRoutineMonthDays(value);
  }
  return [];
};

export const normalizeRoutineSchedule = (source = {}) => {
  const repeat = normalizeRoutineRepeat(
    source?.repeat !== undefined
      ? source.repeat
      : source?.scheduleType !== undefined
      ? source.scheduleType
      : source?.schedule_type
  );

  if (repeat === ROUTINE_REPEAT.WEEKLY) {
    const candidates = [];
    if (source?.days !== undefined) candidates.push(source.days);
    if (source?.weekDays !== undefined) candidates.push(source.weekDays);
    if (source?.week_days !== undefined) candidates.push(source.week_days);

    let normalizedDays = [];
    candidates.some((candidate) => {
      normalizedDays = normalizeRoutineDays(candidate, repeat);
      return normalizedDays.length > 0;
    });

    return {
      repeat,
      days: normalizedDays,
    };
  }

  if (repeat === ROUTINE_REPEAT.MONTHLY) {
    const candidates = [];
    if (source?.days !== undefined) candidates.push(source.days);
    if (source?.monthDays !== undefined) candidates.push(source.monthDays);
    if (source?.month_days !== undefined) candidates.push(source.month_days);

    let normalizedDays = [];
    candidates.some((candidate) => {
      normalizedDays = normalizeRoutineDays(candidate, repeat);
      return normalizedDays.length > 0;
    });

    return {
      repeat,
      days: normalizedDays,
    };
  }

  return {
    repeat: ROUTINE_REPEAT.DAILY,
    days: [],
  };
};

export const getRoutineDaysForRepeat = ({
  repeat = ROUTINE_REPEAT.DAILY,
  weekDays = [],
  monthDays = [],
} = {}) => {
  const normalizedRepeat = normalizeRoutineRepeat(repeat);
  if (normalizedRepeat === ROUTINE_REPEAT.WEEKLY) {
    return normalizeRoutineDays(weekDays, ROUTINE_REPEAT.WEEKLY);
  }
  if (normalizedRepeat === ROUTINE_REPEAT.MONTHLY) {
    return normalizeRoutineDays(monthDays, ROUTINE_REPEAT.MONTHLY);
  }
  return [];
};

export const isRoutineScheduleValid = (repeat, days = []) => {
  const normalizedRepeat = normalizeRoutineRepeat(repeat);
  if (normalizedRepeat === ROUTINE_REPEAT.DAILY) return true;
  return Array.isArray(days) && days.length > 0;
};

export const getRoutineScheduleLabel = (repeat, days = []) => {
  const normalizedRepeat = normalizeRoutineRepeat(repeat);
  if (normalizedRepeat === ROUTINE_REPEAT.DAILY) return 'Daily';
  const normalizedDays = normalizeRoutineDays(days, normalizedRepeat);
  if (normalizedRepeat === ROUTINE_REPEAT.WEEKLY) {
    return normalizedDays.length ? normalizedDays.join(', ') : 'Specific weekdays';
  }
  return normalizedDays.length ? `Days ${normalizedDays.join(', ')}` : 'Specific month days';
};
