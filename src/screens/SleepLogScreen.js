import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { PlatformTimePicker } from '../components';
import { formatTimeFromDate } from '../utils/notifications';
import { spacing, borderRadius, shadows, typography } from '../utils/theme';

const RING_SIZE = 200;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const [time, period] = timeStr.split(' ');
  const [hourStr, minuteStr] = time.split(':');
  let hours = parseInt(hourStr, 10);
  const minutes = parseInt(minuteStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const getSleepDurationHours = (sleepTime, wakeTime) => {
  const start = parseTimeToMinutes(sleepTime);
  const end = parseTimeToMinutes(wakeTime);
  if (start === null || end === null) return null;
  const minutes = end >= start ? end - start : 24 * 60 - start + end;
  return Math.round((minutes / 60) * 10) / 10;
};

const SleepLogScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {
    healthData,
    todayHealth,
    updateHealthForDate,
    ensureHealthLoaded,
    profile,
    themeName,
  } = useApp();
  const isDark = themeName === 'dark';
  const palette = useMemo(() => getPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const dateISO = route?.params?.dateISO || todayISO;
  const [sleepTime, setSleepTime] = useState(null);
  const [wakeTime, setWakeTime] = useState(null);
  const [sleepQuality, setSleepQuality] = useState(null);
  const [environment, setEnvironment] = useState([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeTarget, setTimeTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    ensureHealthLoaded();
  }, [ensureHealthLoaded]);

  useEffect(() => {
    const base = healthData[dateISO] || (dateISO === todayISO ? todayHealth : {});
    setSleepTime(base?.sleepTime || null);
    setWakeTime(base?.wakeTime || null);
    setSleepQuality(base?.sleepQuality || null);
  }, [dateISO, healthData, todayHealth, todayISO]);

  const sleepDuration = getSleepDurationHours(sleepTime, wakeTime);
  const sleepGoal = Math.max(0, Number(profile?.dailySleepGoal) || 0);
  const progress =
    sleepGoal && sleepDuration !== null ? Math.min(1, sleepDuration / sleepGoal) : 0;
  const ringOffset = RING_CIRCUMFERENCE * (1 - progress);

  const qualityOptions = useMemo(
    () => [
      {
        id: 'Excellent',
        label: 'Excellent',
        icon: 'happy',
        tint: palette.qualityExcellent,
        bg: palette.qualityExcellentBg,
      },
      {
        id: 'Good',
        label: 'Good',
        icon: 'happy-outline',
        tint: palette.qualityGood,
        bg: palette.qualityGoodBg,
      },
      {
        id: 'Fair',
        label: 'Fair',
        icon: 'remove-circle-outline',
        tint: palette.qualityFair,
        bg: palette.qualityFairBg,
      },
      {
        id: 'Poor',
        label: 'Poor',
        icon: 'sad-outline',
        tint: palette.qualityPoor,
        bg: palette.qualityPoorBg,
      },
    ],
    [palette]
  );

  const environmentOptions = useMemo(
    () => [
      { id: 'Cool', label: 'Cool', icon: 'thermometer', tint: palette.envCool },
      { id: 'Dark', label: 'Dark', icon: 'moon', tint: palette.envDark },
      { id: 'Quiet', label: 'Quiet', icon: 'volume-mute', tint: palette.envQuiet },
    ],
    [palette]
  );

  const weekPattern = useMemo(() => {
    const baseDate = new Date(`${dateISO}T00:00:00`);
    const start = new Date(baseDate);
    start.setDate(baseDate.getDate() - 6);
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = day.toISOString().slice(0, 10);
      const dayData = healthData[key] || {};
      const hours = getSleepDurationHours(dayData.sleepTime, dayData.wakeTime);
      return {
        key,
        label: DAY_LABELS[day.getDay()],
        hours: hours || 0,
        hasData: hours !== null,
        isActive: key === dateISO,
      };
    });
  }, [dateISO, healthData]);

  const maxWeekHours = Math.max(8, ...weekPattern.map((d) => d.hours || 0));

  const handleSelectQuality = (quality) => {
    setSleepQuality(quality);
  };

  const handleToggleEnvironment = (value) => {
    setEnvironment((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  const openTimePicker = (target) => {
    setTimeTarget(target);
    setShowTimePicker(true);
  };

  const closeTimePicker = () => {
    setShowTimePicker(false);
    setTimeTarget(null);
  };

  const handleTimeChange = (value) => {
    const normalized = value instanceof Date ? formatTimeFromDate(value) : value;
    if (timeTarget === 'sleep') {
      setSleepTime(normalized);
    }
    if (timeTarget === 'wake') {
      setWakeTime(normalized);
    }
  };

  const handleSave = async () => {
    if (!sleepTime || !wakeTime || !sleepQuality) {
      Alert.alert('Complete your log', 'Please add sleep time, wake time, and quality.');
      return;
    }
    setIsSaving(true);
    try {
      await updateHealthForDate(dateISO, {
        sleepTime,
        wakeTime,
        sleepQuality,
      });
    } catch (err) {
      console.log('Error saving sleep log', err);
      Alert.alert('Unable to save', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = useMemo(() => {
    const date = new Date(`${dateISO}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'Today';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [dateISO]);

  const statusText = (() => {
    if (!sleepGoal || sleepDuration === null) return 'Log your sleep duration';
    if (sleepDuration >= sleepGoal) return 'Great sleep duration';
    if (sleepDuration >= sleepGoal * 0.8) return 'Nearly at your goal';
    return 'Keep aiming for your goal';
  })();

  return (
    <View style={[styles.container, { backgroundColor: palette.pageBackground }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <LinearGradient
          colors={palette.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        />
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Sleep Tracker</Text>
            <Text style={styles.headerSubtitle}>Track your sleep for better rest</Text>
            <Text style={styles.headerDate}>{formattedDate}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.trackerCard}>
          <Text style={styles.trackerLabel}>Total Sleep Duration</Text>
          <Text style={styles.trackerValue}>
            {sleepDuration !== null ? `${sleepDuration}h` : '--'}
          </Text>
          <View style={styles.trackerStatusRow}>
            <Ionicons name="checkmark-circle" size={16} color={palette.success} />
            <Text style={styles.trackerStatusText}>{statusText}</Text>
          </View>

          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Defs>
                <SvgLinearGradient id="sleepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={palette.ringStart} />
                  <Stop offset="100%" stopColor={palette.ringEnd} />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={palette.ringTrack}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="url(#sleepGradient)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={ringOffset}
                fill="none"
                rotation="-90"
                originX={RING_SIZE / 2}
                originY={RING_SIZE / 2}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Ionicons name="moon" size={22} color={palette.accent} />
              <Text style={styles.ringCenterValue}>
                {sleepDuration !== null ? `${sleepDuration}h` : '--'}
              </Text>
              <Text style={styles.ringCenterLabel}>
                {sleepGoal ? `${sleepGoal}h goal` : 'Set a goal'}
              </Text>
            </View>
            <View style={[styles.ringMarker, styles.ringMarkerLeft]}>
              <Ionicons name="moon" size={16} color={palette.accent} />
            </View>
            <View style={[styles.ringMarker, styles.ringMarkerRight]}>
              <Ionicons name="sunny" size={16} color={palette.sun} />
            </View>
          </View>

          <View style={styles.timeRow}>
            <TouchableOpacity
              style={styles.timeCard}
              onPress={() => openTimePicker('sleep')}
              activeOpacity={0.85}
            >
              <View style={[styles.timeIcon, { backgroundColor: palette.timeIconBg }]}>
                <Ionicons name="moon" size={16} color={palette.accent} />
              </View>
              <Text style={styles.timeLabel}>Bedtime</Text>
              <Text style={styles.timeValue}>{sleepTime || '--:--'}</Text>
            </TouchableOpacity>

            <View style={styles.timeDivider}>
              <Ionicons name="arrow-forward" size={16} color={palette.textSecondary} />
            </View>

            <TouchableOpacity
              style={styles.timeCard}
              onPress={() => openTimePicker('wake')}
              activeOpacity={0.85}
            >
              <View style={[styles.timeIcon, { backgroundColor: palette.sunBg }]}>
                <Ionicons name="sunny" size={16} color={palette.sun} />
              </View>
              <Text style={styles.timeLabel}>Wake up</Text>
              <Text style={styles.timeValue}>{wakeTime || '--:--'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>How was your sleep quality?</Text>
          <View style={styles.qualityRow}>
            {qualityOptions.map((option) => {
              const isActive = sleepQuality === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.qualityCard,
                    { backgroundColor: option.bg },
                    isActive && styles.qualityCardActive,
                  ]}
                  onPress={() => handleSelectQuality(option.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.qualityIcon, { backgroundColor: option.tint }]}>
                    <Ionicons name={option.icon} size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.qualityLabel}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sleep Environment</Text>
          <View style={styles.environmentRow}>
            {environmentOptions.map((option) => {
              const isActive = environment.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.environmentCard,
                    isActive && styles.environmentCardActive,
                  ]}
                  onPress={() => handleToggleEnvironment(option.id)}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.environmentIcon,
                      { backgroundColor: isActive ? option.tint : palette.envCardBg },
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={16}
                      color={isActive ? '#FFFFFF' : option.tint}
                    />
                  </View>
                  <Text style={styles.environmentLabel}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>This Week's Pattern</Text>
          <View style={styles.weekRow}>
            {weekPattern.map((day) => {
              const height = Math.max(8, (day.hours / maxWeekHours) * 80);
              return (
                <View key={day.key} style={styles.weekDay}>
                  <View
                    style={[
                      styles.weekBar,
                      {
                        height,
                        backgroundColor: day.isActive
                          ? palette.accent
                          : day.hasData
                          ? palette.weekBar
                          : palette.weekBarMuted,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.weekLabel,
                      day.isActive && styles.weekLabelActive,
                    ]}
                  >
                    {day.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={isSaving}
        >
          <LinearGradient
            colors={palette.saveGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveButtonGradient}
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Sleep Log'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <PlatformTimePicker
        visible={showTimePicker}
        value={timeTarget === 'sleep' ? sleepTime : timeTarget === 'wake' ? wakeTime : null}
        onChange={handleTimeChange}
        onClose={closeTimePicker}
      />
    </View>
  );
};

const getPalette = (isDark) => ({
  pageBackground: isDark ? '#0B1020' : '#F4F1FF',
  cardBackground: isDark ? '#141A2B' : '#FFFFFF',
  cardBorder: isDark ? '#28314A' : '#EAE3FF',
  textPrimary: isDark ? '#F8FAFC' : '#1F1B33',
  textSecondary: isDark ? '#9CA3AF' : '#6B7280',
  accent: '#A855F7',
  headerGradient: isDark ? ['#6D28D9', '#7C3AED'] : ['#B671FF', '#9F5BFF'],
  ringTrack: isDark ? '#2C3350' : '#EEE6FF',
  ringStart: '#A855F7',
  ringEnd: '#8B5CF6',
  success: isDark ? '#34D399' : '#22C55E',
  sun: '#F59E0B',
  sunBg: isDark ? 'rgba(245,158,11,0.2)' : '#FFF4D1',
  timeIconBg: isDark ? 'rgba(168,85,247,0.2)' : '#F2E8FF',
  weekBar: isDark ? '#3B3F6E' : '#D9CDFC',
  weekBarMuted: isDark ? '#232844' : '#EEE6FF',
  envCardBg: isDark ? '#202741' : '#F5F1FF',
  qualityExcellent: '#A855F7',
  qualityExcellentBg: isDark ? '#2B1D3B' : '#F3E8FF',
  qualityGood: '#6366F1',
  qualityGoodBg: isDark ? '#242648' : '#E0E7FF',
  qualityFair: '#F59E0B',
  qualityFairBg: isDark ? '#3A2D1B' : '#FEF3C7',
  qualityPoor: '#EF4444',
  qualityPoorBg: isDark ? '#3A1F27' : '#FEE2E2',
  envCool: '#60A5FA',
  envDark: '#A855F7',
  envQuiet: '#10B981',
  saveGradient: ['#8B5CF6', '#D946EF'],
});

const createStyles = (palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    headerGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      marginLeft: spacing.md,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    headerSubtitle: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    headerDate: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 4,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      marginTop: spacing.lg,
    },
    trackerCard: {
      backgroundColor: palette.cardBackground,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      ...shadows.medium,
      marginBottom: spacing.xl,
      alignItems: 'center',
    },
    trackerLabel: {
      ...typography.caption,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    trackerValue: {
      fontSize: 30,
      fontWeight: '700',
      color: palette.textPrimary,
      marginTop: spacing.xs,
    },
    trackerStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    trackerStatusText: {
      ...typography.bodySmall,
      color: palette.textSecondary,
      marginLeft: spacing.xs,
    },
    ringWrap: {
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenterValue: {
      fontSize: 20,
      fontWeight: '700',
      color: palette.textPrimary,
      marginTop: spacing.xs,
    },
    ringCenterLabel: {
      ...typography.caption,
      color: palette.textSecondary,
      marginTop: 2,
    },
    ringMarker: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      ...shadows.small,
    },
    ringMarkerLeft: {
      left: 8,
      bottom: 22,
    },
    ringMarkerRight: {
      right: 8,
      bottom: 22,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    timeCard: {
      flex: 1,
      backgroundColor: palette.cardBackground,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    timeIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    timeLabel: {
      ...typography.caption,
      color: palette.textSecondary,
    },
    timeValue: {
      ...typography.body,
      fontWeight: '600',
      color: palette.textPrimary,
      marginTop: spacing.xs,
    },
    timeDivider: {
      width: 40,
      alignItems: 'center',
    },
    sectionCard: {
      backgroundColor: palette.cardBackground,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      ...shadows.small,
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      color: palette.textPrimary,
      marginBottom: spacing.md,
    },
    qualityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    qualityCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      marginHorizontal: 4,
    },
    qualityCardActive: {
      borderWidth: 1,
      borderColor: palette.accent,
    },
    qualityIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    qualityLabel: {
      ...typography.caption,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    environmentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    environmentCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      marginHorizontal: 4,
      backgroundColor: palette.envCardBg,
    },
    environmentCardActive: {
      borderWidth: 1,
      borderColor: palette.cardBorder,
    },
    environmentIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    environmentLabel: {
      ...typography.caption,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    weekDay: {
      alignItems: 'center',
      flex: 1,
    },
    weekBar: {
      width: 10,
      borderRadius: 6,
      marginBottom: spacing.xs,
    },
    weekLabel: {
      ...typography.caption,
      color: palette.textSecondary,
    },
    weekLabelActive: {
      color: palette.accent,
      fontWeight: '600',
    },
    saveButton: {
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      marginBottom: spacing.xxxl,
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    saveButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.xl,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
  });

export default SleepLogScreen;
