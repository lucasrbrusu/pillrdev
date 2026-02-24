import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { colors, shadows, borderRadius, spacing, typography } from '../utils/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toStartOfDay = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toUtcDayNumber = (value) => {
  const date = toStartOfDay(value);
  if (!date) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
};

const dayNumberToLocalDate = (dayNumber) => {
  if (!Number.isFinite(dayNumber)) return null;
  const utcDate = new Date(dayNumber * DAY_MS);
  if (Number.isNaN(utcDate.getTime())) return null;
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
};

const getStreakUnit = (goalPeriod = 'day', plural = false) => {
  const normalized = String(goalPeriod || 'day').toLowerCase();
  if (normalized === 'week') return plural ? 'weeks' : 'week';
  if (normalized === 'month') return plural ? 'months' : 'month';
  return plural ? 'days' : 'day';
};

const computeBestRun = (dayNumbers = []) => {
  if (!dayNumbers.length) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < dayNumbers.length; index += 1) {
    if (dayNumbers[index] - dayNumbers[index - 1] === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
};

const formatDayLabel = (date) => {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const StreakScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    habits,
    themeColors,
    themeName,
    currentStreak,
    getBestStreak,
    streakFrozen,
  } = useApp();

  const isDark = themeName === 'dark';
  const palette = React.useMemo(
    () => ({
      background: themeColors?.background || colors.background,
      card: isDark ? '#171826' : '#FFFFFF',
      cardBorder: isDark ? '#2E3046' : '#ECEAF4',
      text: themeColors?.text || colors.text,
      textMuted: themeColors?.textSecondary || colors.textSecondary,
      textLight: themeColors?.textLight || colors.textLight,
      gain: isDark ? '#22C55E' : '#16A34A',
      loss: isDark ? '#F97316' : '#EA580C',
      neutral: isDark ? '#3C3F58' : '#E5E7EB',
    }),
    [isDark, themeColors]
  );
  const styles = React.useMemo(() => createStyles(palette, isDark), [palette, isDark]);

  const [monthAnchor, setMonthAnchor] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const completionData = React.useMemo(() => {
    const completionCountByDay = new Map();
    const habitTitlesByDay = new Map();

    (habits || []).forEach((habit) => {
      const title = habit?.title || 'Untitled habit';
      const seenDays = new Set();
      (habit?.completedDates || []).forEach((value) => {
        const dayNumber = toUtcDayNumber(value);
        if (!Number.isFinite(dayNumber)) return;
        if (seenDays.has(dayNumber)) return;
        seenDays.add(dayNumber);

        completionCountByDay.set(dayNumber, (completionCountByDay.get(dayNumber) || 0) + 1);
        const existingSet = habitTitlesByDay.get(dayNumber) || new Set();
        existingSet.add(title);
        habitTitlesByDay.set(dayNumber, existingSet);
      });
    });

    const completionDays = Array.from(completionCountByDay.keys()).sort((a, b) => a - b);
    const completionSet = new Set(completionDays);
    const todayDayNumber = toUtcDayNumber(new Date());
    const globalBestStreak = computeBestRun(completionDays);

    const lossDays = Array.from(
      new Set(
        completionDays
          .map((dayNumber) => dayNumber + 1)
          .filter(
            (dayNumber) =>
              Number.isFinite(todayDayNumber) &&
              dayNumber <= todayDayNumber &&
              !completionSet.has(dayNumber)
          )
      )
    ).sort((a, b) => a - b);
    const lossDaySet = new Set(lossDays);

    const timeline = [
      ...completionDays.map((dayNumber) => ({
        dayNumber,
        type: 'gain',
        count: completionCountByDay.get(dayNumber) || 0,
        habits: Array.from(habitTitlesByDay.get(dayNumber) || []),
      })),
      ...lossDays.map((dayNumber) => ({
        dayNumber,
        type: 'loss',
        count: 0,
        habits: [],
      })),
    ].sort((a, b) => b.dayNumber - a.dayNumber);

    return {
      completionCountByDay,
      habitTitlesByDay,
      completionDays,
      completionSet,
      lossDaySet,
      timeline,
      globalBestStreak,
      todayDayNumber,
    };
  }, [habits]);

  const [selectedDayNumber, setSelectedDayNumber] = React.useState(
    completionData.todayDayNumber || toUtcDayNumber(new Date())
  );

  React.useEffect(() => {
    if (!Number.isFinite(completionData.todayDayNumber)) return;
    setSelectedDayNumber((prev) =>
      Number.isFinite(prev) ? prev : completionData.todayDayNumber
    );
  }, [completionData.todayDayNumber]);

  const topCurrentHabits = React.useMemo(
    () =>
      (habits || [])
        .filter((habit) => (habit?.streak || 0) > 0)
        .sort((a, b) => (b?.streak || 0) - (a?.streak || 0))
        .slice(0, 5),
    [habits]
  );

  const calendarCells = React.useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const firstWeekDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let idx = 0; idx < firstWeekDay; idx += 1) {
      cells.push({ type: 'spacer', key: `spacer-${idx}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const dayNumber = toUtcDayNumber(date);
      const hasGain = completionData.completionSet.has(dayNumber);
      const hasLoss = !hasGain && completionData.lossDaySet.has(dayNumber);

      cells.push({
        type: 'day',
        key: `day-${day}`,
        day,
        dayNumber,
        isToday: dayNumber === completionData.todayDayNumber,
        hasGain,
        hasLoss,
        completionCount: completionData.completionCountByDay.get(dayNumber) || 0,
      });
    }

    return cells;
  }, [monthAnchor, completionData]);

  const selectedDate = React.useMemo(
    () => dayNumberToLocalDate(selectedDayNumber),
    [selectedDayNumber]
  );
  const selectedHasGain = completionData.completionSet.has(selectedDayNumber);
  const selectedHasLoss = !selectedHasGain && completionData.lossDaySet.has(selectedDayNumber);
  const selectedCompletionCount =
    completionData.completionCountByDay.get(selectedDayNumber) || 0;
  const selectedCompletedHabits = React.useMemo(
    () => Array.from(completionData.habitTitlesByDay.get(selectedDayNumber) || []),
    [completionData.habitTitlesByDay, selectedDayNumber]
  );

  const selectedStatusText = selectedHasGain
    ? 'Streak increased'
    : selectedHasLoss
    ? 'Streak missed/lost'
    : 'No streak change';
  const selectedStatusIcon = selectedHasGain
    ? 'arrow-up-circle'
    : selectedHasLoss
    ? 'close-circle'
    : 'ellipse-outline';
  const selectedStatusColor = selectedHasGain
    ? palette.gain
    : selectedHasLoss
    ? palette.loss
    : palette.textMuted;

  const calendarMonthLabel = monthAnchor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const bestHabitCurrentStreak = getBestStreak ? getBestStreak() : 0;
  const frozenStreakIconColor = '#4DA6FF';
  const todayDateKey = React.useMemo(() => new Date().toDateString(), []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Streaks</Text>
          <Text style={styles.headerSubtitle}>Momentum and consistency insights</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={isDark ? ['#C56020', '#89290C'] : ['#FF7A2D', '#FF4D2D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons
                name="flame"
                size={20}
                color={streakFrozen ? frozenStreakIconColor : '#FFFFFF'}
              />
            </View>
            {streakFrozen ? (
              <View style={styles.frozenBadge}>
                <Ionicons name="snow" size={13} color="#FFFFFF" />
                <Text style={styles.frozenBadgeText}>Frozen</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroLabel}>Current streak</Text>
          <Text style={styles.heroValue}>
            {currentStreak || 0} day{(currentStreak || 0) === 1 ? '' : 's'}
          </Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Best streak</Text>
              <Text style={styles.heroMetaValue}>{completionData.globalBestStreak}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Top habit streak</Text>
              <Text style={styles.heroMetaValue}>{bestHabitCurrentStreak}</Text>
            </View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>Streak days</Text>
              <Text style={styles.heroMetaValue}>{completionData.completionDays.length}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.row}>
          <View style={styles.smallStatCard}>
            <Feather name="target" size={16} color={palette.textMuted} />
            <Text style={styles.smallStatLabel}>Habits with streak</Text>
            <Text style={styles.smallStatValue}>{topCurrentHabits.length}</Text>
          </View>
          <View style={styles.smallStatCard}>
            <Ionicons name="calendar-number" size={16} color={palette.textMuted} />
            <Text style={styles.smallStatLabel}>Tracked events</Text>
            <Text style={styles.smallStatValue}>{completionData.timeline.length}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top current habits</Text>
            <Text style={styles.sectionSubtitle}>Highest active streaks right now</Text>
          </View>
          {topCurrentHabits.length ? (
            topCurrentHabits.map((habit, index) => {
              const streakValue = habit?.streak || 0;
              const streakIconColor =
                streakFrozen && !(habit?.completedDates || []).includes(todayDateKey)
                  ? frozenStreakIconColor
                  : '#F97316';
              return (
                <View key={habit?.id || `${habit?.title || 'habit'}-${index}`} style={styles.habitRow}>
                  <View style={styles.habitRank}>
                    <Text style={styles.habitRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.habitTextWrap}>
                    <Text style={styles.habitTitle} numberOfLines={1}>
                      {habit?.title || 'Untitled habit'}
                    </Text>
                    <Text style={styles.habitMeta}>
                      {streakValue} {getStreakUnit(habit?.goalPeriod || 'day', streakValue !== 1)}
                    </Text>
                  </View>
                  <Ionicons name="flame" size={16} color={streakIconColor} />
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              Start completing habits consistently to build your first streak.
            </Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Streak calendar</Text>
              <Text style={styles.sectionSubtitle}>Track increases and misses by day</Text>
            </View>
            <View style={styles.monthNav}>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() =>
                  setMonthAnchor(
                    new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-back" size={16} color={palette.text} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{calendarMonthLabel}</Text>
              <TouchableOpacity
                style={styles.monthNavBtn}
                onPress={() =>
                  setMonthAnchor(
                    new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-forward" size={16} color={palette.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={`weekday-${index}-${label}`} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((cell) => {
              if (cell.type === 'spacer') {
                return <View key={cell.key} style={styles.calendarCell} />;
              }

              const selected = cell.dayNumber === selectedDayNumber;
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.calendarCell,
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    cell.isToday && styles.dayCellToday,
                  ]}
                  onPress={() => setSelectedDayNumber(cell.dayNumber)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.dayTextSelected,
                      cell.isToday && styles.dayTextToday,
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {cell.hasGain ? (
                    <View style={[styles.activityDot, styles.gainDot]} />
                  ) : cell.hasLoss ? (
                    <View style={[styles.activityDot, styles.lossDot]} />
                  ) : (
                    <View style={[styles.activityDot, styles.neutralDot]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.gainDot]} />
              <Text style={styles.legendText}>Streak increased</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.lossDot]} />
              <Text style={styles.legendText}>Missed/lost</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Selected day</Text>
          <Text style={styles.sectionSubtitle}>{formatDayLabel(selectedDate)}</Text>
          <View style={styles.selectedStatusRow}>
            <Ionicons name={selectedStatusIcon} size={16} color={selectedStatusColor} />
            <Text style={[styles.selectedStatusText, { color: selectedStatusColor }]}>
              {selectedStatusText}
            </Text>
          </View>
          {selectedHasGain ? (
            <>
              <Text style={styles.selectedMeta}>
                Completed habits: {selectedCompletionCount}
              </Text>
              {selectedCompletedHabits.slice(0, 4).map((title) => (
                <Text key={`${title}-${selectedDayNumber}`} style={styles.selectedHabitItem}>
                  • {title}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.selectedMeta}>No completed habits recorded for this day.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent streak events</Text>
          <Text style={styles.sectionSubtitle}>Latest streak gains and losses</Text>
          {completionData.timeline.slice(0, 10).map((event) => {
            const eventDate = dayNumberToLocalDate(event.dayNumber);
            const gain = event.type === 'gain';
            return (
              <View key={`${event.type}-${event.dayNumber}`} style={styles.eventRow}>
                <View style={[styles.eventIconWrap, gain ? styles.eventGain : styles.eventLoss]}>
                  <Ionicons
                    name={gain ? 'arrow-up' : 'close'}
                    size={14}
                    color={gain ? palette.gain : palette.loss}
                  />
                </View>
                <View style={styles.eventTextWrap}>
                  <Text style={styles.eventTitle}>
                    {gain ? 'Streak increased' : 'Streak lost'}
                  </Text>
                  <Text style={styles.eventSubtitle}>{formatDayLabel(eventDate)}</Text>
                </View>
                {gain ? (
                  <Text style={styles.eventCount}>
                    {event.count} habit{event.count === 1 ? '' : 's'}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {!completionData.timeline.length ? (
            <Text style={styles.emptyText}>No streak history yet.</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    headerTextWrap: {
      flex: 1,
    },
    headerTitle: {
      ...typography.h2,
      color: palette.text,
      fontWeight: '800',
    },
    headerSubtitle: {
      ...typography.caption,
      color: palette.textMuted,
      marginTop: 2,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    heroCard: {
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      ...shadows.medium,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    heroIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.24)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    frozenBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    frozenBadgeText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    heroLabel: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.86)',
      marginBottom: 2,
      fontWeight: '600',
    },
    heroValue: {
      fontSize: 32,
      color: '#FFFFFF',
      fontWeight: '900',
    },
    heroMetaRow: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    heroMetaItem: {
      flex: 1,
    },
    heroMetaDivider: {
      width: 1,
      backgroundColor: 'rgba(255,255,255,0.25)',
      marginHorizontal: spacing.sm,
    },
    heroMetaLabel: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.82)',
      marginBottom: 2,
    },
    heroMetaValue: {
      ...typography.h3,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    smallStatCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...shadows.small,
    },
    smallStatLabel: {
      ...typography.caption,
      color: palette.textMuted,
      marginTop: spacing.xs,
    },
    smallStatValue: {
      ...typography.h3,
      color: palette.text,
      fontWeight: '800',
      marginTop: 2,
    },
    sectionCard: {
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      ...shadows.small,
    },
    sectionHeader: {
      marginBottom: spacing.sm,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.h3,
      color: palette.text,
      fontWeight: '800',
    },
    sectionSubtitle: {
      ...typography.caption,
      color: palette.textMuted,
      marginTop: 2,
    },
    habitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: palette.cardBorder,
    },
    habitRank: {
      width: 26,
      height: 26,
      borderRadius: borderRadius.full,
      backgroundColor: isDark ? '#292B3E' : '#F4F1FD',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    habitRankText: {
      ...typography.caption,
      color: palette.textMuted,
      fontWeight: '700',
    },
    habitTextWrap: {
      flex: 1,
    },
    habitTitle: {
      ...typography.body,
      color: palette.text,
      fontWeight: '700',
    },
    habitMeta: {
      ...typography.caption,
      color: palette.textMuted,
      marginTop: 2,
    },
    emptyText: {
      ...typography.bodySmall,
      color: palette.textMuted,
      marginTop: spacing.xs,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    monthNavBtn: {
      width: 28,
      height: 28,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      backgroundColor: isDark ? '#212338' : '#F8F7FC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      ...typography.bodySmall,
      color: palette.text,
      fontWeight: '700',
      minWidth: 116,
      textAlign: 'center',
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    weekdayLabel: {
      flex: 1,
      textAlign: 'center',
      ...typography.caption,
      color: palette.textMuted,
      fontWeight: '700',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: spacing.xs,
    },
    calendarCell: {
      width: '14.2857%',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
      minHeight: 40,
    },
    dayCell: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    dayCellSelected: {
      borderColor: palette.textMuted,
      backgroundColor: isDark ? '#212338' : '#F8F7FC',
    },
    dayCellToday: {
      borderColor: isDark ? '#5467FF66' : '#4F46E54D',
    },
    dayText: {
      ...typography.bodySmall,
      color: palette.text,
      fontWeight: '600',
    },
    dayTextSelected: {
      fontWeight: '800',
    },
    dayTextToday: {
      color: isDark ? '#A5B4FC' : '#4338CA',
    },
    activityDot: {
      width: 8,
      height: 8,
      borderRadius: borderRadius.full,
      marginTop: 3,
    },
    gainDot: {
      backgroundColor: palette.gain,
    },
    lossDot: {
      backgroundColor: palette.loss,
    },
    neutralDot: {
      backgroundColor: palette.neutral,
      opacity: 0.45,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: borderRadius.full,
    },
    legendText: {
      ...typography.caption,
      color: palette.textMuted,
    },
    selectedStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    selectedStatusText: {
      ...typography.bodySmall,
      fontWeight: '700',
    },
    selectedMeta: {
      ...typography.bodySmall,
      color: palette.textMuted,
      marginTop: 2,
    },
    selectedHabitItem: {
      ...typography.bodySmall,
      color: palette.text,
      marginTop: 4,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: palette.cardBorder,
    },
    eventIconWrap: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    eventGain: {
      backgroundColor: isDark ? 'rgba(34,197,94,0.18)' : '#DCFCE7',
    },
    eventLoss: {
      backgroundColor: isDark ? 'rgba(249,115,22,0.2)' : '#FFEDD5',
    },
    eventTextWrap: {
      flex: 1,
    },
    eventTitle: {
      ...typography.bodySmall,
      color: palette.text,
      fontWeight: '700',
    },
    eventSubtitle: {
      ...typography.caption,
      color: palette.textMuted,
      marginTop: 2,
    },
    eventCount: {
      ...typography.caption,
      color: palette.textLight,
      fontWeight: '700',
    },
  });

export default StreakScreen;
