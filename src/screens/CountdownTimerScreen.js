import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { colors, spacing, typography, shadows } from '../utils/theme';
import {
  requestNotificationPermissionAsync,
  scheduleLocalNotificationAsync,
} from '../utils/notifications';
import { useApp } from '../context/AppContext';

const RING_SIZE = 220;
const RING_STROKE = 12;
const RING_INNER_SIZE = RING_SIZE - RING_STROKE * 2 - 16;

const CountdownTimerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);
  const [durationMs, setDurationMs] = React.useState(5 * 60 * 1000);
  const [remainingMs, setRemainingMs] = React.useState(5 * 60 * 1000);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [hasNotified, setHasNotified] = React.useState(false);
  const [showCustom, setShowCustom] = React.useState(false);
  const [customTime, setCustomTime] = React.useState({ hours: 0, minutes: 5, seconds: 0 });
  const scrollRef = React.useRef(null);
  const customSectionY = React.useRef(null);

  const presetOptions = [
    { label: '30s', ms: 30 * 1000 },
    { label: '1m', ms: 1 * 60 * 1000 },
    { label: '5m', ms: 5 * 60 * 1000 },
    { label: '10m', ms: 10 * 60 * 1000 },
    { label: '15m', ms: 15 * 60 * 1000 },
    { label: '25m', ms: 25 * 60 * 1000 },
    { label: '30m', ms: 30 * 60 * 1000 },
    { label: '45m', ms: 45 * 60 * 1000 },
    { label: '1h', ms: 60 * 60 * 1000 },
  ];
  const iconColor = themeColors.textSecondary || colors.textSecondary;
  const accent = themeColors.primary || colors.primary;
  const accentGradient = ['#8B5CF6', '#EC4899'];
  const ringRadius = (RING_SIZE - RING_STROKE) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progress =
    durationMs > 0
      ? Math.min(Math.max(remainingMs / durationMs, 0), 1)
      : 0;
  const ringOffset = ringCircumference * (1 - progress);

  const formattedTime = () => {
    const totalSeconds = Math.floor(Math.max(remainingMs, 0) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  React.useEffect(() => {
    let interval = null;
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setRemainingMs((prev) => {
          const next = Math.max(prev - 1000, 0);
          if (next === 0) {
            setIsRunning(false);
            setIsPaused(false);
            notifyCompletion();
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused]);

  const notifyCompletion = React.useCallback(async () => {
    if (hasNotified) return;
    setHasNotified(true);
    const granted = await requestNotificationPermissionAsync();
    if (!granted) return;
    await scheduleLocalNotificationAsync({
      title: 'Timer finished',
      body: 'Your countdown timer is finished.',
      trigger: null, // immediate
    });
  }, [hasNotified]);

  const applyPreset = (ms) => {
    setDurationMs(ms);
    setRemainingMs(ms);
    setIsRunning(false);
    setIsPaused(false);
    setHasNotified(false);
    setShowCustom(false);
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    setCustomTime({ hours, minutes, seconds });
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const adjustCustomTime = (unit, delta) => {
    setCustomTime((prev) => {
      const limits = { hours: 23, minutes: 59, seconds: 59 };
      const nextValue = clamp(prev[unit] + delta, 0, limits[unit]);
      return { ...prev, [unit]: nextValue };
    });
  };

  const handleTimeInput = (unit, value) => {
    const limits = { hours: 23, minutes: 59, seconds: 59 };
    const sanitized = value.replace(/\D/g, '');
    if (!sanitized) {
      setCustomTime((prev) => ({ ...prev, [unit]: 0 }));
      return;
    }
    const parsed = parseInt(sanitized, 10);
    setCustomTime((prev) => ({ ...prev, [unit]: clamp(parsed, 0, limits[unit]) }));
  };

  const handleStart = () => {
    if (remainingMs <= 0) return;
    setIsRunning(true);
    setIsPaused(false);
    setHasNotified(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    if (remainingMs <= 0) return;
    setIsPaused(false);
    setIsRunning(true);
    setHasNotified(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    setRemainingMs(durationMs);
    setHasNotified(false);
  };

  const handleSetCustomTime = () => {
    const totalSeconds =
      customTime.hours * 3600 + customTime.minutes * 60 + customTime.seconds;
    const ms = Math.max(totalSeconds, 1) * 1000;
    setDurationMs(ms);
    setRemainingMs(ms);
    setIsRunning(false);
    setIsPaused(false);
    setHasNotified(false);
  };

  const handlePrimaryAction = () => {
    if (isRunning && !isPaused) {
      handlePause();
      return;
    }
    if (isPaused) {
      handleResume();
      return;
    }
    handleStart();
  };

  const handleToggleCustom = () => {
    setShowCustom((prev) => !prev);
  };

  const handleFocusCustom = () => {
    if (!scrollRef.current) return;
    if (customSectionY.current !== null) {
      const targetY = Math.max(customSectionY.current - spacing.lg, 0);
      scrollRef.current.scrollTo({ y: targetY, animated: true });
    } else {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  };

  React.useEffect(() => {
    if (!showCustom) return;
    const timer = setTimeout(() => {
      if (!scrollRef.current) return;
      if (customSectionY.current !== null) {
        const targetY = Math.max(customSectionY.current - spacing.lg, 0);
        scrollRef.current.scrollTo({ y: targetY, animated: true });
      } else {
        scrollRef.current.scrollToEnd({ animated: true });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [showCustom]);

  const primaryIconName = isRunning && !isPaused ? 'pause' : 'play';
  const isPrimaryDisabled = !isRunning && remainingMs <= 0;

  const renderTimeBlock = (label, value, onMinus, onPlus, onChange) => (
    <View style={styles.timeBlock}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeValueCard}>
        <TextInput
          style={styles.timeInput}
          value={String(value)}
          onChangeText={onChange}
          onFocus={handleFocusCustom}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
        <View style={styles.timeControls}>
          <TouchableOpacity style={styles.adjustButton} onPress={onMinus}>
            <Ionicons name="remove" size={16} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.adjustButton} onPress={onPlus}>
            <Ionicons name="add" size={16} color={accent} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + spacing.lg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + spacing.lg}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={iconColor} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <View style={styles.headerIcon}>
              <Ionicons name="timer-outline" size={16} color={accent} />
            </View>
            <Text style={styles.title}>Countdown Timer</Text>
          </View>
        </View>

        <View style={styles.timerCard}>
          <View style={styles.timerRingWrap}>
            <View style={styles.timerRing}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Defs>
                  <SvgLinearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={accentGradient[0]} />
                    <Stop offset="100%" stopColor={accentGradient[1]} />
                  </SvgLinearGradient>
                </Defs>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={ringRadius}
                  stroke="#EEE7F7"
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={ringRadius}
                  stroke="url(#timerGradient)"
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </Svg>
              <View style={styles.timerRingInner}>
                <Text style={styles.timerValue}>{formattedTime()}</Text>
              </View>
            </View>
          </View>

          <View style={styles.timerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleStop}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={20} color={iconColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.playButton, isPrimaryDisabled && styles.iconButtonDisabled]}
              onPress={handlePrimaryAction}
              disabled={isPrimaryDisabled}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={accentGradient}
                start={{ x: 0.1, y: 0.2 }}
                end={{ x: 0.9, y: 0.8 }}
                style={styles.playButtonGradient}
              >
                <Ionicons name={primaryIconName} size={24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, showCustom && styles.iconButtonActive]}
              onPress={handleToggleCustom}
              activeOpacity={0.85}
            >
              <Ionicons name="alarm-outline" size={20} color={iconColor} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Timers</Text>
          <View style={styles.presetGrid}>
            {presetOptions.map(({ label, ms }) => {
              const isActive = durationMs === ms;
              return (
                <TouchableOpacity
                  key={label}
                  style={styles.presetItem}
                  onPress={() => applyPreset(ms)}
                  activeOpacity={0.85}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={accentGradient}
                      start={{ x: 0.1, y: 0.2 }}
                      end={{ x: 0.9, y: 0.8 }}
                      style={styles.presetButtonActive}
                    >
                      <Text style={styles.presetTextActive}>{label}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.presetButton}>
                      <Text style={styles.presetText}>{label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {showCustom && (
          <View
            style={styles.sectionCard}
            onLayout={(event) => {
              customSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.sectionTitle}>Custom Time</Text>
            <View style={styles.customGrid}>
              {renderTimeBlock(
                'Hours',
                customTime.hours,
                () => adjustCustomTime('hours', -1),
                () => adjustCustomTime('hours', 1),
                (value) => handleTimeInput('hours', value)
              )}
              {renderTimeBlock(
                'Minutes',
                customTime.minutes,
                () => adjustCustomTime('minutes', -1),
                () => adjustCustomTime('minutes', 1),
                (value) => handleTimeInput('minutes', value)
              )}
              {renderTimeBlock(
                'Seconds',
                customTime.seconds,
                () => adjustCustomTime('seconds', -1),
                () => adjustCustomTime('seconds', 1),
                (value) => handleTimeInput('seconds', value)
              )}
            </View>
            <TouchableOpacity style={styles.customButton} onPress={handleSetCustomTime} activeOpacity={0.85}>
              <LinearGradient
                colors={accentGradient}
                start={{ x: 0.1, y: 0.2 }}
                end={{ x: 0.9, y: 0.8 }}
                style={styles.customButtonGradient}
              >
                <Text style={styles.customButtonText}>Set Custom Time</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (themeColorsParam = colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F6F2FF',
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl * 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      ...shadows.small,
    },
    headerTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: spacing.sm,
    },
    headerIcon: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F2E8FF',
      marginRight: spacing.sm,
    },
    title: {
      ...typography.h3,
      fontSize: 18,
      color: themeColorsParam.text || colors.text,
    },
    timerCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: spacing.xl,
      alignItems: 'center',
      ...shadows.large,
    },
    timerRingWrap: {
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    timerRing: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    timerRingInner: {
      position: 'absolute',
      width: RING_INNER_SIZE,
      height: RING_INNER_SIZE,
      borderRadius: RING_INNER_SIZE / 2,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    timerValue: {
      ...typography.h1,
      fontSize: 34,
      fontWeight: '700',
      color: themeColorsParam.text || colors.text,
    },
    timerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F2F4F9',
      ...shadows.small,
    },
    iconButtonActive: {
      backgroundColor: '#F2E8FF',
    },
    iconButtonDisabled: {
      opacity: 0.5,
    },
    playButton: {
      width: 70,
      height: 70,
      borderRadius: 22,
      overflow: 'hidden',
      ...shadows.medium,
    },
    playButtonGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionCard: {
      marginTop: spacing.lg,
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      padding: spacing.lg,
      ...shadows.medium,
    },
    sectionTitle: {
      ...typography.h3,
      fontSize: 18,
      fontWeight: '700',
      color: themeColorsParam.text || colors.text,
      marginBottom: spacing.md,
    },
    presetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    presetItem: {
      flexBasis: '30%',
      flexGrow: 1,
    },
    presetButton: {
      borderRadius: 16,
      backgroundColor: '#F5F6FB',
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    presetButtonActive: {
      borderRadius: 16,
      paddingVertical: spacing.md,
      alignItems: 'center',
      ...shadows.small,
    },
    presetText: {
      ...typography.body,
      fontWeight: '600',
      color: themeColorsParam.textSecondary || colors.textSecondary,
    },
    presetTextActive: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    customGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    timeBlock: {
      flex: 1,
    },
    timeLabel: {
      ...typography.caption,
      color: themeColorsParam.textSecondary || colors.textSecondary,
      marginBottom: spacing.xs,
    },
    timeValueCard: {
      backgroundColor: '#F8F3FF',
      borderRadius: 18,
      paddingVertical: spacing.md,
      alignItems: 'center',
      ...shadows.small,
    },
    timeInput: {
      fontSize: 26,
      fontWeight: '700',
      color: themeColorsParam.text || colors.text,
      textAlign: 'center',
      paddingVertical: 0,
      minWidth: 40,
    },
    timeControls: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    adjustButton: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EFE7FF',
    },
    customButton: {
      marginTop: spacing.lg,
      borderRadius: 18,
      overflow: 'hidden',
    },
    customButtonGradient: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    customButtonText: {
      ...typography.body,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });

export default CountdownTimerScreen;
