export const BADGE_SLOT_COUNT = 3;
export const EMPTY_BADGE_SLOTS = Object.freeze([null, null, null]);

export const ACHIEVEMENT_IDS = Object.freeze({
  LONGEST_CURRENT_STREAK: 'longest_current_streak',
  LONGEST_HABIT_STREAK: 'longest_habit_streak',
  TOTAL_HABIT_COMPLETIONS: 'total_habit_completions',
  TOTAL_HABITS_ACHIEVED: 'total_habits_achieved',
  ACCOUNT_AGE: 'account_age',
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeGoalPeriod = (value) => {
  const normalized = String(value || 'day').toLowerCase();
  if (normalized === 'week' || normalized === 'month') return normalized;
  return 'day';
};

const toStartOfLocalDay = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const toUtcDayNumber = (value) => {
  const day = toStartOfLocalDay(value);
  if (!day) return null;
  return Math.floor(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / MS_PER_DAY);
};

const getStreakPeriodIndex = (value, goalPeriod = 'day') => {
  const period = normalizeGoalPeriod(goalPeriod);
  const day = toStartOfLocalDay(value);
  if (!day) return null;

  if (period === 'month') {
    return day.getFullYear() * 12 + day.getMonth();
  }

  const dayNumber = toUtcDayNumber(day);
  if (!Number.isFinite(dayNumber)) return null;
  if (period === 'week') return Math.floor((dayNumber + 3) / 7);
  return dayNumber;
};

const computeBestRunFromIndices = (indices = []) => {
  if (!indices.length) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < indices.length; index += 1) {
    if (indices[index] - indices[index - 1] === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
};

export const computeBestStreakFromDateKeys = (dateKeys = [], goalPeriod = 'day') => {
  const indices = Array.from(
    new Set(
      (dateKeys || [])
        .map((value) => getStreakPeriodIndex(value, goalPeriod))
        .filter((index) => Number.isFinite(index))
    )
  ).sort((a, b) => a - b);

  return computeBestRunFromIndices(indices);
};

const computeLongestGlobalCompletionStreak = (habits = []) => {
  const dayNumbers = Array.from(
    new Set(
      (habits || []).flatMap((habit) =>
        (Array.isArray(habit?.completedDates) ? habit.completedDates : [])
          .map((value) => toUtcDayNumber(value))
          .filter((dayNumber) => Number.isFinite(dayNumber))
      )
    )
  ).sort((a, b) => a - b);

  return computeBestRunFromIndices(dayNumbers);
};

const hasHabitLifecycleCompleted = (habit = {}, referenceDate = new Date()) => {
  const endDate = toStartOfLocalDay(habit?.endDate || habit?.end_date);
  const referenceDay = toStartOfLocalDay(referenceDate);
  if (!endDate || !referenceDay) return false;
  const endDayNumber = toUtcDayNumber(endDate);
  const referenceDayNumber = toUtcDayNumber(referenceDay);
  if (!Number.isFinite(endDayNumber) || !Number.isFinite(referenceDayNumber)) return false;
  return referenceDayNumber >= endDayNumber;
};

const getAccountAgeMonths = (createdAt) => {
  const createdDate = createdAt ? new Date(createdAt) : null;
  if (!(createdDate instanceof Date) || Number.isNaN(createdDate.getTime())) return 0;

  const now = new Date();
  let months =
    (now.getFullYear() - createdDate.getFullYear()) * 12 +
    (now.getMonth() - createdDate.getMonth());

  if (now.getDate() < createdDate.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
};

const buildBadgeId = (achievementId, milestone) => `${achievementId}:${milestone}`;

const toPlural = (value, singular, plural) => `${value} ${value === 1 ? singular : plural}`;

const formatAccountAgeMilestone = (months) => {
  if (months >= 12) {
    const years = months / 12;
    return toPlural(years, 'year', 'years');
  }
  return toPlural(months, 'month', 'months');
};

const getBadgeVariant = (achievementId, milestone) => {
  if (achievementId === ACHIEVEMENT_IDS.LONGEST_CURRENT_STREAK) return 'streak_current';
  if (achievementId === ACHIEVEMENT_IDS.LONGEST_HABIT_STREAK) return 'streak_habit';
  if (achievementId === ACHIEVEMENT_IDS.TOTAL_HABIT_COMPLETIONS) return 'habit_completions';
  if (achievementId === ACHIEVEMENT_IDS.TOTAL_HABITS_ACHIEVED) return 'habits_achieved';
  if (achievementId === ACHIEVEMENT_IDS.ACCOUNT_AGE) {
    return milestone >= 12 ? 'account_yearly' : 'account_monthly';
  }
  return 'default';
};

const buildMilestoneLabel = (achievementId, milestone) => {
  if (
    achievementId === ACHIEVEMENT_IDS.LONGEST_CURRENT_STREAK ||
    achievementId === ACHIEVEMENT_IDS.LONGEST_HABIT_STREAK
  ) {
    return toPlural(milestone, 'day', 'days');
  }
  if (achievementId === ACHIEVEMENT_IDS.TOTAL_HABIT_COMPLETIONS) {
    return toPlural(milestone, 'habit completion', 'habit completions');
  }
  if (achievementId === ACHIEVEMENT_IDS.TOTAL_HABITS_ACHIEVED) {
    return toPlural(milestone, 'habit achieved', 'habits achieved');
  }
  if (achievementId === ACHIEVEMENT_IDS.ACCOUNT_AGE) {
    return formatAccountAgeMilestone(milestone);
  }
  return String(milestone);
};

const ACHIEVEMENT_DEFINITIONS = [
  {
    id: ACHIEVEMENT_IDS.LONGEST_CURRENT_STREAK,
    title: 'Longest Current Streak',
    slotTitle: 'Current Streak',
    metricKey: 'longestCurrentStreak',
    milestones: [2, 5, 7, 14, 30, 60, 90, 100, 180, 275, 365],
  },
  {
    id: ACHIEVEMENT_IDS.LONGEST_HABIT_STREAK,
    title: 'Longest Habit Streak',
    slotTitle: 'Habit Streak',
    metricKey: 'longestHabitStreak',
    milestones: [2, 5, 7, 14, 30, 60, 90, 100, 180, 275, 365],
  },
  {
    id: ACHIEVEMENT_IDS.TOTAL_HABIT_COMPLETIONS,
    title: 'Total Habit Completions',
    slotTitle: 'Completions',
    metricKey: 'totalHabitCompletions',
    milestones: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  },
  {
    id: ACHIEVEMENT_IDS.TOTAL_HABITS_ACHIEVED,
    title: 'Total Habits Achieved',
    slotTitle: 'Habits Achieved',
    metricKey: 'totalHabitsAchieved',
    milestones: [1, 3, 5, 10, 25, 50, 75, 100],
  },
  {
    id: ACHIEVEMENT_IDS.ACCOUNT_AGE,
    title: 'Account Age',
    slotTitle: 'Account Age',
    metricKey: 'accountAgeMonths',
    milestones: [1, 3, 6, 9, 12, 24, 36, 48, 60],
  },
];

const DEFINITION_BY_ID = ACHIEVEMENT_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.id] = definition;
  return acc;
}, {});

const sanitizeBadgeId = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const [achievementId, rawMilestone] = normalized.split(':');
  const definition = DEFINITION_BY_ID[achievementId];
  const milestone = Number(rawMilestone);
  if (!definition || !Number.isFinite(milestone)) return null;
  if (!definition.milestones.includes(milestone)) return null;
  return buildBadgeId(achievementId, milestone);
};

export const normalizeBadgeSlots = (value, fallback = EMPTY_BADGE_SLOTS) => {
  const fallbackSlots = Array.isArray(fallback)
    ? [...fallback, ...EMPTY_BADGE_SLOTS].slice(0, BADGE_SLOT_COUNT)
    : [...EMPTY_BADGE_SLOTS];

  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
    ? [
        value.slot1 ?? value.badge_slot_1,
        value.slot2 ?? value.badge_slot_2,
        value.slot3 ?? value.badge_slot_3,
      ]
    : [];

  const normalized = [...fallbackSlots];
  for (let index = 0; index < BADGE_SLOT_COUNT; index += 1) {
    const sourceValue = source[index];
    if (sourceValue === undefined) continue;
    const cleaned = sanitizeBadgeId(sourceValue);
    normalized[index] = cleaned;
  }
  return normalized;
};

export const parseBadgeId = (badgeId) => {
  const normalized = sanitizeBadgeId(badgeId);
  if (!normalized) return null;
  const [achievementId, rawMilestone] = normalized.split(':');
  const milestone = Number(rawMilestone);
  const definition = DEFINITION_BY_ID[achievementId];
  return {
    badgeId: normalized,
    achievementId,
    milestone,
    definition,
    variant: getBadgeVariant(achievementId, milestone),
    milestoneLabel: buildMilestoneLabel(achievementId, milestone),
    slotTitle: definition?.slotTitle || definition?.title || 'Badge',
  };
};

export const computeAchievementMetrics = ({
  habits = [],
  currentStreak = 0,
  profileCreatedAt = null,
  authCreatedAt = null,
} = {}) => {
  const safeHabits = Array.isArray(habits) ? habits : [];
  const longestGlobalStreak = computeLongestGlobalCompletionStreak(safeHabits);
  const longestCurrentStreak = Math.max(0, Number(currentStreak) || 0, longestGlobalStreak);

  const longestHabitStreak = safeHabits.reduce((best, habit) => {
    const bestFromDates = computeBestStreakFromDateKeys(
      Array.isArray(habit?.completedDates) ? habit.completedDates : [],
      habit?.goalPeriod || habit?.goal_period || 'day'
    );
    const value = Math.max(Number(habit?.streak) || 0, bestFromDates);
    return value > best ? value : best;
  }, 0);

  const totalHabitCompletions = safeHabits.reduce(
    (total, habit) => total + (Array.isArray(habit?.completedDates) ? habit.completedDates.length : 0),
    0
  );

  const now = new Date();
  const totalHabitsAchieved = safeHabits.filter((habit) => hasHabitLifecycleCompleted(habit, now)).length;

  const accountAgeMonths = getAccountAgeMonths(profileCreatedAt || authCreatedAt);

  return {
    longestCurrentStreak,
    longestHabitStreak,
    totalHabitCompletions,
    totalHabitsAchieved,
    accountAgeMonths,
  };
};

export const buildAchievementSections = ({ metrics = {}, badgeSlots = EMPTY_BADGE_SLOTS } = {}) => {
  const equipped = normalizeBadgeSlots(badgeSlots);

  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const metricValue = Math.max(0, Number(metrics?.[definition.metricKey]) || 0);
    const badges = definition.milestones.map((milestone) => {
      const badgeId = buildBadgeId(definition.id, milestone);
      const equippedSlots = equipped
        .map((slotBadgeId, slotIndex) => (slotBadgeId === badgeId ? slotIndex + 1 : null))
        .filter((slotValue) => Number.isFinite(slotValue));
      return {
        id: badgeId,
        badgeId,
        achievementId: definition.id,
        title: definition.title,
        slotTitle: definition.slotTitle,
        milestone,
        milestoneLabel: buildMilestoneLabel(definition.id, milestone),
        variant: getBadgeVariant(definition.id, milestone),
        unlocked: metricValue >= milestone,
        metricValue,
        equippedSlots,
      };
    });

    return {
      id: definition.id,
      title: definition.title,
      metricValue,
      badges,
    };
  });
};

export const isBadgeUnlocked = (badgeId, metrics = {}) => {
  const parsed = parseBadgeId(badgeId);
  if (!parsed?.definition) return false;
  const metricValue = Math.max(0, Number(metrics?.[parsed.definition.metricKey]) || 0);
  return metricValue >= parsed.milestone;
};

export const getBadgeDetails = (badgeId) => {
  const parsed = parseBadgeId(badgeId);
  if (!parsed) return null;
  return {
    id: parsed.badgeId,
    badgeId: parsed.badgeId,
    achievementId: parsed.achievementId,
    title: parsed.definition?.title || 'Badge',
    slotTitle: parsed.slotTitle,
    milestone: parsed.milestone,
    milestoneLabel: parsed.milestoneLabel,
    variant: parsed.variant,
  };
};
