import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../utils/theme';

const MOOD_OPTIONS = [
  { key: 'happy', label: 'Happy', emoji: '\u{1F60A}', color: '#FFD166' },
  { key: 'loved', label: 'Loved', emoji: '\u{1F970}', color: '#FF8FAB' },
  { key: 'peaceful', label: 'Peaceful', emoji: '\u{1F60C}', color: '#A7F3D0' },
  { key: 'excited', label: 'Excited', emoji: '\u{1F929}', color: '#FDBA74' },
  { key: 'confident', label: 'Confident', emoji: '\u{1F60E}', color: '#60A5FA' },
  { key: 'celebrating', label: 'Celebrating', emoji: '\u{1F973}', color: '#F472B6' },
  { key: 'tired', label: 'Tired', emoji: '\u{1F634}', color: '#A1A1AA' },
  { key: 'okay', label: 'Okay', emoji: '\u{1F610}', color: '#FACC15' },
  { key: 'thoughtful', label: 'Thoughtful', emoji: '\u{1F914}', color: '#C084FC' },
  { key: 'sad', label: 'Sad', emoji: '\u{1F622}', color: '#93C5FD' },
  { key: 'anxious', label: 'Anxious', emoji: '\u{1F630}', color: '#F59E0B' },
  { key: 'frustrated', label: 'Frustrated', emoji: '\u{1F624}', color: '#F87171' },
];

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toIsoDateKey = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
  return date.toISOString().slice(0, 10);
};

const normalizeMoodIndex = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const idx = Math.trunc(numeric) - 1;
  if (idx < 0 || idx >= MOOD_OPTIONS.length) return null;
  return idx;
};

const getMoodThoughtValue = (day = {}) => {
  const rawValue = day?.moodThought ?? day?.mood_thought ?? day?.moodNote ?? '';
  if (typeof rawValue !== 'string') return null;
  const normalized = rawValue.trim();
  return normalized.length ? normalized : null;
};

const MoodCalendarScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { healthData, themeColors, themeName } = useApp();
  const isDark = themeName === 'dark';
  const paletteVars = useMemo(() => stylesVars(isDark), [isDark]);
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedIsoKey, setSelectedIsoKey] = useState(() => toIsoDateKey(new Date()));

  const dayDataByDateKey = useMemo(() => {
    const map = new Map();
    Object.entries(healthData || {}).forEach(([dateKey, day]) => {
      const idx = normalizeMoodIndex(day?.mood);
      const mood = idx !== null ? MOOD_OPTIONS[idx] : null;
      const thought = getMoodThoughtValue(day);
      if (!mood && !thought) return;
      map.set(dateKey, { mood, thought });
    });
    return map;
  }, [healthData]);

  const monthCells = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push({ type: 'spacer', key: `s-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      cells.push({
        type: 'day',
        key: `d-${day}`,
        day,
        isoKey: toIsoDateKey(date),
      });
    }

    return cells;
  }, [monthAnchor]);

  const loggedThisMonth = useMemo(
    () =>
      monthCells.reduce((count, cell) => {
        if (cell.type !== 'day') return count;
        const entry = dayDataByDateKey.get(cell.isoKey);
        return entry?.mood ? count + 1 : count;
      }, 0),
    [dayDataByDateKey, monthCells]
  );
  const selectedDayData = dayDataByDateKey.get(selectedIsoKey) || null;
  const selectedDateLabel = useMemo(() => {
    const parsed = new Date(`${selectedIsoKey}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return selectedIsoKey;
    return parsed.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedIsoKey]);
  const returnToMoodGarden = Boolean(route?.params?.returnToMoodGarden);
  const handleBack = () => {
    if (returnToMoodGarden) {
      navigation.navigate('Main', {
        screen: 'Health',
        params: { openMoodPicker: true },
      });
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.background,
          paddingTop: insets.top + spacing.sm,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={20} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Mood Calendar</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.calendarCard, { borderColor: paletteVars.cardBorder, backgroundColor: paletteVars.cardBg }]}>
          <View style={styles.calendarHeader}>
            <Text style={[styles.calendarTitle, { color: themeColors.text }]}>All Days</Text>
            <View style={styles.calendarNav}>
              <TouchableOpacity
                style={[styles.calendarNavBtn, { backgroundColor: paletteVars.navButtonBg }]}
                onPress={() => {
                  const nextAnchor = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1);
                  setMonthAnchor(nextAnchor);
                  setSelectedIsoKey(toIsoDateKey(nextAnchor));
                }}
              >
                <Ionicons name="chevron-back" size={16} color={themeColors.text} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthText, { color: themeColors.text }]}>
                {monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                style={[styles.calendarNavBtn, { backgroundColor: paletteVars.navButtonBg }]}
                onPress={() => {
                  const nextAnchor = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);
                  setMonthAnchor(nextAnchor);
                  setSelectedIsoKey(toIsoDateKey(nextAnchor));
                }}
              >
                <Ionicons name="chevron-forward" size={16} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.calendarMeta, { color: themeColors.textSecondary }]}>
            {loggedThisMonth} mood{loggedThisMonth === 1 ? '' : 's'} logged this month
          </Text>

          <View style={styles.calendarWeekRow}>
            {WEEK_DAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={[styles.calendarWeekDayText, { color: themeColors.textSecondary }]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {monthCells.map((cell) => {
              if (cell.type === 'spacer') {
                return <View key={cell.key} style={styles.calendarCell} />;
              }

              const dayData = dayDataByDateKey.get(cell.isoKey);
              const mood = dayData?.mood || null;
              const hasThought = !!dayData?.thought;
              const selectedDay = selectedIsoKey === cell.isoKey;
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={styles.calendarCell}
                  activeOpacity={0.85}
                  onPress={() => setSelectedIsoKey(cell.isoKey)}
                >
                  <View
                    style={[
                      styles.calendarDot,
                      {
                        backgroundColor: mood ? mood.color : paletteVars.emptyDayBg,
                        borderColor: mood ? mood.color : paletteVars.emptyDayBorder,
                        borderWidth: selectedDay ? 2 : 1,
                      },
                    ]}
                  >
                    {hasThought ? <View style={styles.calendarThoughtDot} /> : null}
                    {mood ? <Text style={styles.calendarMoodEmoji}>{mood.emoji}</Text> : null}
                    <Text
                      style={[
                        styles.calendarDotText,
                        { color: mood ? '#0F172A' : themeColors.text },
                        mood ? styles.calendarDotTextWithMood : null,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.selectedDayCard,
              {
                borderColor: paletteVars.emptyDayBorder,
                backgroundColor: paletteVars.emptyDayBg,
              },
            ]}
          >
            <Text style={[styles.selectedDayTitle, { color: themeColors.text }]}>
              {selectedDateLabel}
            </Text>
            {selectedDayData?.mood ? (
              <Text style={[styles.selectedDayMood, { color: themeColors.text }]}>
                {selectedDayData.mood.emoji} {selectedDayData.mood.label}
              </Text>
            ) : (
              <Text style={[styles.selectedDayEmpty, { color: themeColors.textSecondary }]}>
                No mood recorded for this day.
              </Text>
            )}
            {selectedDayData?.thought ? (
              <Text style={[styles.selectedDayThought, { color: themeColors.text }]}>
                "{selectedDayData.thought}"
              </Text>
            ) : (
              <Text style={[styles.selectedDayEmpty, { color: themeColors.textSecondary }]}>
                No thought shared.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const stylesVars = (isDark) => ({
  cardBg: isDark ? '#171C2E' : '#FFFFFF',
  cardBorder: isDark ? '#2A324D' : '#E6EAF3',
  navButtonBg: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6',
  emptyDayBg: isDark ? '#222A40' : '#F8FAFC',
  emptyDayBorder: isDark ? '#2D3754' : '#E5E7EB',
});

const createStyles = (isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    headerRow: {
      marginHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
    },
    headerSpacer: {
      width: 36,
      height: 36,
    },
    headerTitle: {
      ...typography.h3,
      fontWeight: '700',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: spacing.xs,
    },
    calendarCard: {
      marginHorizontal: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.lg,
      ...shadows.small,
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    calendarTitle: {
      ...typography.body,
      fontWeight: '700',
    },
    calendarNav: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    calendarNavBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarMonthText: {
      ...typography.bodySmall,
      fontWeight: '700',
      marginHorizontal: spacing.sm,
    },
    calendarMeta: {
      ...typography.caption,
      marginBottom: spacing.sm,
    },
    calendarWeekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      paddingHorizontal: 2,
    },
    calendarWeekDayText: {
      ...typography.caption,
      width: '14.2%',
      textAlign: 'center',
      fontWeight: '600',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    calendarCell: {
      width: '14.2%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    calendarDot: {
      width: 40,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 2,
      paddingBottom: 2,
      position: 'relative',
    },
    calendarThoughtDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#0F172A',
      position: 'absolute',
      top: 4,
      right: 4,
    },
    calendarMoodEmoji: {
      fontSize: 14,
      lineHeight: 16,
      marginBottom: 1,
    },
    calendarDotText: {
      ...typography.caption,
      fontWeight: '700',
      textAlign: 'center',
    },
    calendarDotTextWithMood: {
      fontSize: 10,
      lineHeight: 12,
    },
    selectedDayCard: {
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      padding: spacing.md,
    },
    selectedDayTitle: {
      ...typography.bodySmall,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    selectedDayMood: {
      ...typography.bodySmall,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    selectedDayThought: {
      ...typography.bodySmall,
      lineHeight: 20,
    },
    selectedDayEmpty: {
      ...typography.caption,
      marginBottom: spacing.xs,
    },
  });

export default MoodCalendarScreen;
