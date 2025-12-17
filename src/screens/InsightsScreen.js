import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { Button, Card } from '../components';
import {
  addDays,
  addMonths,
  clamp,
  formatDurationHuman,
  formatRangeLabel,
  getSleepDurationMinutes,
  isWithinRange,
  parseDateOnlyToLocalNoon,
  startOfMonth,
  startOfWeekMonday,
} from '../utils/insights';
import { readAppUsageByDay, readFocusSessions } from '../utils/insightsTracking';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';

const MAX_HISTORY = 4;

const MetricCard = ({ styles, title, value, subtitle, icon, accent = colors.primary }) => (
  <Card style={styles.metricCard}>
    <View style={styles.metricHeader}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    {!!subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
  </Card>
);

const sum = (arr) => arr.reduce((acc, n) => acc + (Number(n) || 0), 0);

const safeCurrency = (n) => {
  const value = Number(n) || 0;
  const abs = Math.abs(value);
  const rounded = abs >= 100 ? Math.round(abs) : Math.round(abs * 100) / 100;
  return `${value < 0 ? '-' : ''}${rounded}`;
};

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    profile,
    tasks,
    habits,
    chores,
    healthData,
    notes,
    reminders,
    groceries,
    finances,
    authUser,
    themeColors,
  } = useApp();
  const theme = themeColors || colors;
  const textColor = theme.text || colors.text;
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);

  const isPremium = !!profile?.isPremium;
  const [tab, setTab] = React.useState('weekly'); // weekly | monthly
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [focusSessions, setFocusSessions] = React.useState([]);
  const [appUsageByDay, setAppUsageByDay] = React.useState({});

  const userId = authUser?.id || null;

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [sessions, usage] = await Promise.all([
        readFocusSessions(userId),
        readAppUsageByDay(userId),
      ]);
      if (cancelled) return;
      setFocusSessions(Array.isArray(sessions) ? sessions : []);
      setAppUsageByDay(usage && typeof usage === 'object' ? usage : {});
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activeOffset = tab === 'weekly' ? weekOffset : monthOffset;
  const setActiveOffset = (next) => {
    const clamped = clamp(next, 0, MAX_HISTORY);
    if (tab === 'weekly') setWeekOffset(clamped);
    else setMonthOffset(clamped);
  };

  const rangeStart = React.useMemo(() => {
    if (tab === 'weekly') return startOfWeekMonday(new Date(), weekOffset);
    return startOfMonth(new Date(), monthOffset);
  }, [tab, weekOffset, monthOffset]);

  const rangeEndExclusive = React.useMemo(() => {
    if (tab === 'weekly') return addDays(rangeStart, 7);
    return addMonths(rangeStart, 1);
  }, [tab, rangeStart]);

  const rangeLabel = React.useMemo(
    () => formatRangeLabel(rangeStart, rangeEndExclusive),
    [rangeStart, rangeEndExclusive]
  );

  const insights = React.useMemo(() => {
    const tasksCreated = (tasks || []).filter((t) =>
      isWithinRange(t?.createdAt, rangeStart, rangeEndExclusive)
    );
    const tasksCompleted = tasksCreated.filter((t) => !!t?.completed);

    const choresCreated = (chores || []).filter((c) =>
      isWithinRange(c?.createdAt, rangeStart, rangeEndExclusive)
    );
    const choresCompleted = choresCreated.filter((c) => !!c?.completed);

    const habitsCreated = (habits || []).filter((h) =>
      isWithinRange(h?.createdAt, rangeStart, rangeEndExclusive)
    );

    const habitCheckins = sum(
      (habits || []).map((h) => {
        const dates = Array.isArray(h?.completedDates) ? h.completedDates : [];
        return dates.filter((dateStr) =>
          isWithinRange(new Date(dateStr), rangeStart, rangeEndExclusive)
        ).length;
      })
    );

    const sessionsInRange = (focusSessions || []).filter((s) =>
      isWithinRange(s?.endAt || s?.endedAt, rangeStart, rangeEndExclusive)
    );
    const focusMs = sum(sessionsInRange.map((s) => s?.durationMs));

    const appUsageMs = sum(
      Object.entries(appUsageByDay || {}).map(([dateKey, ms]) => {
        const keyDate = parseDateOnlyToLocalNoon(dateKey);
        if (!keyDate) return 0;
        return isWithinRange(keyDate, rangeStart, rangeEndExclusive) ? ms : 0;
      })
    );

    const healthEntriesInRange = Object.entries(healthData || {})
      .map(([dateKey, day]) => ({ dateKey, day }))
      .filter(({ dateKey }) => {
        const keyDate = parseDateOnlyToLocalNoon(dateKey);
        if (!keyDate) return false;
        return isWithinRange(keyDate, rangeStart, rangeEndExclusive);
      });

    const sleepMinutesList = healthEntriesInRange
      .map(({ day }) => getSleepDurationMinutes(day?.sleepTime, day?.wakeTime))
      .filter((n) => typeof n === 'number' && Number.isFinite(n) && n > 0);

    const totalSleepMinutes = sum(sleepMinutesList);
    const sleepNights = sleepMinutesList.length;
    const avgSleepMinutes = sleepNights ? totalSleepMinutes / sleepNights : 0;

    const waterTotal = sum(
      healthEntriesInRange.map(({ day }) => Number(day?.waterIntake) || 0)
    );
    const waterAvg = healthEntriesInRange.length
      ? waterTotal / healthEntriesInRange.length
      : 0;

    const caloriesTotal = sum(
      healthEntriesInRange.map(({ day }) => Number(day?.calories) || 0)
    );

    const notesCreated = (notes || []).filter((n) =>
      isWithinRange(n?.createdAt, rangeStart, rangeEndExclusive)
    );

    const remindersCreated = (reminders || []).filter((r) =>
      isWithinRange(r?.createdAt, rangeStart, rangeEndExclusive)
    );

    const groceriesAdded = (groceries || []).filter((g) =>
      isWithinRange(g?.createdAt, rangeStart, rangeEndExclusive)
    );
    const groceriesCompleted = groceriesAdded.filter((g) => !!g?.completed);

    const transactionsInRange = (finances || []).filter((t) =>
      isWithinRange(t?.createdAt || t?.date, rangeStart, rangeEndExclusive)
    );
    const expenses = transactionsInRange
      .filter((t) => t?.type === 'expense')
      .reduce((acc, t) => acc + (Number(t?.amount) || 0), 0);
    const income = transactionsInRange
      .filter((t) => t?.type === 'income')
      .reduce((acc, t) => acc + (Number(t?.amount) || 0), 0);

    return {
      tasksCreatedCount: tasksCreated.length,
      tasksCompletedCount: tasksCompleted.length,
      habitsCreatedCount: habitsCreated.length,
      habitCheckinsCount: habitCheckins,
      choresCreatedCount: choresCreated.length,
      choresCompletedCount: choresCompleted.length,
      focusMs,
      appUsageMs,
      totalSleepMinutes,
      avgSleepMinutes,
      sleepNights,
      waterTotal,
      waterAvg,
      caloriesTotal,
      notesCreatedCount: notesCreated.length,
      remindersCreatedCount: remindersCreated.length,
      groceriesAddedCount: groceriesAdded.length,
      groceriesCompletedCount: groceriesCompleted.length,
      transactionsCount: transactionsInRange.length,
      income,
      expenses,
    };
  }, [
    tasks,
    habits,
    chores,
    healthData,
    notes,
    reminders,
    groceries,
    finances,
    focusSessions,
    appUsageByDay,
    rangeStart,
    rangeEndExclusive,
  ]);

  const goPrev = () => setActiveOffset(activeOffset + 1);
  const goNext = () => setActiveOffset(activeOffset - 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insights</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'weekly' && styles.tabButtonActive]}
          onPress={() => setTab('weekly')}
          activeOpacity={0.9}
        >
          <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>Weekly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'monthly' && styles.tabButtonActive]}
          onPress={() => setTab('monthly')}
          activeOpacity={0.9}
        >
          <Text style={[styles.tabText, tab === 'monthly' && styles.tabTextActive]}>Monthly</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.rangeRow}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={activeOffset >= MAX_HISTORY}
          style={[styles.rangeButton, activeOffset >= MAX_HISTORY && styles.rangeButtonDisabled]}
        >
          <Ionicons name="chevron-back" size={18} color={textColor} />
          <Text style={styles.rangeButtonText}>Prev</Text>
        </TouchableOpacity>
        <View style={styles.rangeTextWrap}>
          <Text style={styles.rangeTitle}>{activeOffset === 0 ? 'Current period' : `${activeOffset} back`}</Text>
          <Text style={styles.rangeSubtitle}>{rangeLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={goNext}
          disabled={activeOffset <= 0}
          style={[styles.rangeButton, activeOffset <= 0 && styles.rangeButtonDisabled]}
        >
          <Text style={styles.rangeButtonText}>Next</Text>
          <Ionicons name="chevron-forward" size={18} color={textColor} />
        </TouchableOpacity>
      </View>

      {!isPremium ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#0b1220', '#101c36']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.lockedCard}
          >
            <View style={styles.lockedIconWrap}>
              <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.lockedTitle}>Become a Premium member to access your insights!</Text>
            <Text style={styles.lockedSubtitle}>
              Weekly and monthly reports help you track progress across tasks, habits, sleep, focus mode, and more.
            </Text>
            <Button
              title="Upgrade to Premium"
              onPress={() => navigation.navigate('Profile')}
              icon="star"
              style={styles.upgradeButton}
              disableTranslation
            />
          </LinearGradient>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.metricsGrid}>
            <MetricCard
              styles={styles}
              title="Tasks created"
              value={`${insights.tasksCreatedCount}`}
              subtitle={`${insights.tasksCompletedCount} completed`}
              icon="checkmark-done-outline"
              accent={colors.tasks}
            />
            <MetricCard
              styles={styles}
              title="Habits"
              value={`${insights.habitsCreatedCount} created`}
              subtitle={`${insights.habitCheckinsCount} check-ins`}
              icon="flame-outline"
              accent={colors.habits}
            />
            <MetricCard
              styles={styles}
              title="Chores"
              value={`${insights.choresCreatedCount} created`}
              subtitle={`${insights.choresCompletedCount} completed`}
              icon="home-outline"
              accent={colors.routine}
            />
            <MetricCard
              styles={styles}
              title="Focus mode"
              value={formatDurationHuman(insights.focusMs)}
              subtitle="Time spent focusing"
              icon="timer-outline"
              accent="#6d7cff"
            />
            <MetricCard
              styles={styles}
              title="App time"
              value={formatDurationHuman(insights.appUsageMs)}
              subtitle="Time in the app"
              icon="phone-portrait-outline"
              accent={colors.primary}
            />
            <MetricCard
              styles={styles}
              title="Sleep"
              value={formatDurationHuman(insights.totalSleepMinutes * 60 * 1000)}
              subtitle={
                insights.sleepNights
                  ? `Avg ${Math.round((insights.avgSleepMinutes / 60) * 10) / 10}h/night`
                  : 'No sleep logs'
              }
              icon="moon-outline"
              accent={colors.health}
            />
            <MetricCard
              styles={styles}
              title="Water"
              value={`${Math.round(insights.waterTotal)} cups`}
              subtitle={
                insights.waterAvg
                  ? `Avg ${Math.round(insights.waterAvg * 10) / 10}/day`
                  : 'No water logs'
              }
              icon="water-outline"
              accent="#4da6ff"
            />
            <MetricCard
              styles={styles}
              title="Calories logged"
              value={`${Math.round(insights.caloriesTotal)}`}
              subtitle="From health logs"
              icon="nutrition-outline"
              accent={colors.health}
            />
            <MetricCard
              styles={styles}
              title="Notes"
              value={`${insights.notesCreatedCount}`}
              subtitle="Created"
              icon="document-text-outline"
              accent={colors.primary}
            />
            <MetricCard
              styles={styles}
              title="Reminders"
              value={`${insights.remindersCreatedCount}`}
              subtitle="Created"
              icon="notifications-outline"
              accent={colors.primary}
            />
            <MetricCard
              styles={styles}
              title="Groceries"
              value={`${insights.groceriesAddedCount} added`}
              subtitle={`${insights.groceriesCompletedCount} completed`}
              icon="basket-outline"
              accent={colors.routine}
            />
            <MetricCard
              styles={styles}
              title="Finances"
              value={`${insights.transactionsCount} tx`}
              subtitle={`+${safeCurrency(insights.income)} / -${safeCurrency(insights.expenses)}`}
              icon="cash-outline"
              accent={colors.finance}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (themeColorsParam) => {
  const theme = themeColorsParam || colors;
  const text = theme.text || colors.text;
  const textSecondary = theme.textSecondary || colors.textSecondary;
  const border = theme.border || colors.border;
  const card = theme.card || colors.card;
  const background = theme.background || colors.background;
  const primary = theme.primary || colors.primary;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    backButton: { padding: spacing.xs },
    headerTitle: { ...typography.h2, color: text },
    headerSpacer: { width: 32 },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
    },
    tabButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      alignItems: 'center',
    },
    tabButtonActive: {
      backgroundColor: primary,
      borderColor: primary,
    },
    tabText: { ...typography.body, color: text, fontWeight: '700' },
    tabTextActive: { color: '#FFFFFF' },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    rangeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
    },
    rangeButtonDisabled: { opacity: 0.4 },
    rangeButtonText: { ...typography.bodySmall, fontWeight: '700', color: text },
    rangeTextWrap: { flex: 1, alignItems: 'center' },
    rangeTitle: { ...typography.body, fontWeight: '800', color: text },
    rangeSubtitle: { ...typography.caption, color: textSecondary, marginTop: 2 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.xl },
    metricsGrid: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    metricCard: { padding: spacing.lg },
    metricHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    metricIconWrap: {
      width: 34,
      height: 34,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricTitle: { ...typography.body, fontWeight: '800', color: text, flex: 1 },
    metricValue: { ...typography.h2, marginTop: spacing.sm, color: text },
    metricSubtitle: { ...typography.caption, color: textSecondary, marginTop: 2 },
    lockedCard: {
      marginTop: spacing.lg,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      overflow: 'hidden',
      ...shadows.medium,
    },
    lockedIconWrap: {
      width: 46,
      height: 46,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    lockedTitle: { ...typography.h3, color: '#FFFFFF' },
    lockedSubtitle: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.78)',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    upgradeButton: {
      backgroundColor: '#FACC15',
      borderWidth: 1,
      borderColor: '#b8860b',
    },
  });
};
