export const DEFAULT_TASK_DURATION_MINUTES = 30;
export const MIN_TASK_DURATION_MINUTES = 5;
export const MAX_TASK_DURATION_MINUTES = 24 * 60;

export const normalizeTaskDurationMinutes = (
  value,
  fallback = DEFAULT_TASK_DURATION_MINUTES
) => {
  const parsed = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback))
    ? Number(fallback)
    : DEFAULT_TASK_DURATION_MINUTES;
  if (!Number.isFinite(parsed)) {
    return Math.min(
      MAX_TASK_DURATION_MINUTES,
      Math.max(MIN_TASK_DURATION_MINUTES, Math.round(fallbackValue))
    );
  }
  return Math.min(
    MAX_TASK_DURATION_MINUTES,
    Math.max(MIN_TASK_DURATION_MINUTES, Math.round(parsed))
  );
};

export const parseTaskTimeToMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const suffix = (match[3] || '').toUpperCase();
  const hasSuffix = suffix === 'AM' || suffix === 'PM';

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (hasSuffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === 'PM' && hour < 12) hour += 12;
    if (suffix === 'AM' && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
};

const formatClockFromMinutes = (totalMinutes) => {
  if (!Number.isInteger(totalMinutes)) return '';
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const formatTaskDurationLabel = (durationMinutes) => {
  const normalized = normalizeTaskDurationMinutes(durationMinutes);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

export const getTaskDateTimeRange = (
  task = {},
  { fallbackDurationMinutes = DEFAULT_TASK_DURATION_MINUTES } = {}
) => {
  const dateKey = String(task?.date || '').trim();
  const startMinutes = parseTaskTimeToMinutes(task?.time);
  if (!dateKey || !Number.isInteger(startMinutes)) {
    return null;
  }

  const startAt = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(startAt.getTime())) {
    return null;
  }

  startAt.setHours(
    Math.floor(startMinutes / 60),
    startMinutes % 60,
    0,
    0
  );

  const durationMinutes = normalizeTaskDurationMinutes(
    task?.durationMinutes,
    fallbackDurationMinutes
  );
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  return {
    id: task?.id || null,
    title: task?.title || '',
    date: dateKey,
    startAt,
    endAt,
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
    durationMinutes,
  };
};

export const formatTaskTimeRangeLabel = (
  task = {},
  { fallbackDurationMinutes = DEFAULT_TASK_DURATION_MINUTES } = {}
) => {
  const range = getTaskDateTimeRange(task, { fallbackDurationMinutes });
  if (!range) {
    const durationText = formatTaskDurationLabel(
      normalizeTaskDurationMinutes(task?.durationMinutes, fallbackDurationMinutes)
    );
    if (task?.time) return `${task.time} | ${durationText}`;
    return durationText;
  }
  const endTotal = range.startMinutes + range.durationMinutes;
  return `${formatClockFromMinutes(range.startMinutes)} - ${formatClockFromMinutes(endTotal)} | ${formatTaskDurationLabel(range.durationMinutes)}`;
};

export const doTaskRangesOverlap = (taskA, taskB, options = {}) => {
  const rangeA = getTaskDateTimeRange(taskA, options);
  const rangeB = getTaskDateTimeRange(taskB, options);
  if (!rangeA || !rangeB) return false;
  return rangeA.startAt < rangeB.endAt && rangeB.startAt < rangeA.endAt;
};

export const findOverlappingTasks = (
  candidateTask,
  taskList = [],
  {
    excludeTaskId = null,
    includeCompleted = false,
    fallbackDurationMinutes = DEFAULT_TASK_DURATION_MINUTES,
  } = {}
) => {
  const candidateRange = getTaskDateTimeRange(candidateTask, {
    fallbackDurationMinutes,
  });
  if (!candidateRange) return [];

  const excludedId = excludeTaskId || candidateTask?.id || null;
  return (taskList || []).filter((task) => {
    if (!task) return false;
    if (!includeCompleted && task.completed) return false;
    if (excludedId && task.id === excludedId) return false;
    const range = getTaskDateTimeRange(task, { fallbackDurationMinutes });
    if (!range) return false;
    return candidateRange.startAt < range.endAt && range.startAt < candidateRange.endAt;
  });
};

export const getTaskOverlapPairs = (
  taskList = [],
  {
    includeCompleted = false,
    fallbackDurationMinutes = DEFAULT_TASK_DURATION_MINUTES,
  } = {}
) => {
  const pairs = [];
  const normalized = (taskList || [])
    .filter(Boolean)
    .filter((task) => (includeCompleted ? true : !task.completed))
    .map((task) => ({
      task,
      range: getTaskDateTimeRange(task, { fallbackDurationMinutes }),
    }))
    .filter((entry) => !!entry.range)
    .sort((a, b) => a.range.startAt - b.range.startAt);

  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i];
    for (let j = i + 1; j < normalized.length; j += 1) {
      const candidate = normalized[j];
      if (candidate.range.startAt >= current.range.endAt) {
        break;
      }
      if (current.range.startAt < candidate.range.endAt) {
        pairs.push({
          a: current.task,
          b: candidate.task,
          aRange: current.range,
          bRange: candidate.range,
        });
      }
    }
  }

  return pairs;
};
