import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Keyboard, TouchableWithoutFeedback, Platform, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const CountdownTimerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [durationMs, setDurationMs] = React.useState(5 * 60 * 1000);
  const [remainingMs, setRemainingMs] = React.useState(5 * 60 * 1000);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [showCustom, setShowCustom] = React.useState(false);
  const [pickerDate, setPickerDate] = React.useState(() => {
    const d = new Date();
    d.setHours(0, 5, 0, 0);
    return d;
  });

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
  const secondsOptions = React.useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

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
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused]);

  const applyPreset = (ms) => {
    setDurationMs(ms);
    setRemainingMs(ms);
    setShowCustom(false);
    setShowPicker(false);
    const d = new Date();
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, seconds, 0);
    setPickerDate(d);
  };

  const onPickerChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowPicker(false);
      return;
    }
    const prevSeconds = pickerDate.getSeconds();
    const nextDate = new Date(selectedDate || pickerDate);
    nextDate.setSeconds(prevSeconds);
    if (Platform.OS !== 'ios') setShowPicker(false);
    setPickerDate(nextDate);
    const totalSeconds =
      nextDate.getHours() * 3600 + nextDate.getMinutes() * 60 + nextDate.getSeconds();
    const ms = Math.max(totalSeconds, 1) * 1000;
    setDurationMs(ms);
    setRemainingMs(ms);
  };

  const handleStart = () => {
    if (remainingMs <= 0) return;
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    if (remainingMs <= 0) return;
    setIsPaused(false);
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    setRemainingMs(durationMs);
  };

  const setSecondsValue = (sec) => {
    setPickerDate((prev) => {
      const next = new Date(prev);
      next.setSeconds(sec);
      const totalSeconds = next.getHours() * 3600 + next.getMinutes() * 60 + sec;
      const ms = Math.max(totalSeconds, 1) * 1000;
      setDurationMs(ms);
      setRemainingMs(ms);
      return next;
    });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Countdown Timer</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.timer}>{formattedTime()}</Text>

        <View style={styles.mainActions}>
          {!isRunning && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, styles.startButton]}
              onPress={handleStart}
              disabled={remainingMs <= 0}
            >
              <Text style={styles.actionText}>Start</Text>
            </TouchableOpacity>
          )}
          {isRunning && !isPaused && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton, styles.actionButtonFull]}
              onPress={handlePause}
            >
              <Text style={styles.secondaryText}>Pause</Text>
            </TouchableOpacity>
          )}
          {isRunning && isPaused && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, styles.actionButtonFull]}
              onPress={handleResume}
            >
              <Text style={styles.actionText}>Resume</Text>
            </TouchableOpacity>
          )}
          {isRunning && (
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton, styles.actionButtonFull]}
              onPress={handleStop}
            >
              <Text style={styles.actionText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Quick Timer</Text>
        <View style={styles.presetsRow}>
          {[...presetOptions, { label: 'Custom', ms: null }].map(({ label, ms }) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.presetButton,
                (ms !== null && durationMs === ms) || (ms === null && showCustom)
                  ? styles.presetButtonActive
                  : null,
              ]}
              onPress={() => {
                if (ms === null) {
                  if (showCustom) {
                    setShowCustom(false);
                    setShowPicker(false);
                  } else {
                    setShowCustom(true);
                    setShowPicker(true);
                  }
                } else {
                  applyPreset(ms);
                }
              }}
            >
              <Text
                style={[
                  styles.presetText,
                  (ms !== null && durationMs === ms) || (ms === null && showCustom)
                    ? styles.presetTextActive
                    : null,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {showCustom && (
          <View style={styles.customRow}>
            <TouchableOpacity style={styles.customInput} onPress={() => setShowPicker(true)}>
              <Text style={styles.customInputText}>
                {String(pickerDate.getHours()).padStart(2, '0')}:
                {String(pickerDate.getMinutes()).padStart(2, '0')}:
                {String(pickerDate.getSeconds()).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.applyButtonText}>Set</Text>
            </TouchableOpacity>
          </View>
        )}
        {showPicker && (
          <>
            <View style={styles.pickerLabels}>
              <View style={styles.hmLabels}>
                <Text style={styles.pickerLabel}>Hours</Text>
                <Text style={styles.pickerLabel}>Minutes</Text>
              </View>
              <View style={styles.secondsLabelWrap}>
                <Text style={styles.pickerLabel}>Seconds</Text>
              </View>
            </View>
            <View style={styles.pickerRow}>
              <DateTimePicker
                style={styles.timePicker}
                value={pickerDate}
                mode="time"
                display="spinner"
                timePickerModeAndroid="spinner"
                onChange={onPickerChange}
                minuteInterval={1}
                themeVariant="light"
                textColor={colors.text}
              />
              <View style={styles.secondsPickerContainer}>
                <FlatList
                  data={secondsOptions}
                  keyExtractor={(item) => item.toString()}
                  showsVerticalScrollIndicator={false}
                  style={styles.secondsPicker}
                  contentContainerStyle={styles.secondsPickerContent}
                  getItemLayout={(_, index) => ({
                    length: 38,
                    offset: 38 * index,
                    index,
                  })}
                  renderItem={({ item }) => {
                    const selected = item === pickerDate.getSeconds();
                    return (
                      <TouchableOpacity
                        onPress={() => setSecondsValue(item)}
                        style={[styles.secondsItem, selected && styles.secondsItemSelected]}
                      >
                        <Text style={[styles.secondsText, selected && styles.secondsTextSelected]}>
                          {String(item).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </>
        )}
      </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  timer: {
    ...typography.h1,
    fontSize: 48,
    marginBottom: spacing.lg,
    color: colors.text,
  },
  mainActions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  presetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    flexBasis: '22%',
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#fff',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  customInput: {
    width: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
  },
  customInputText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  applyButton: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  applyButtonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  actionButtonFull: {
    alignSelf: 'stretch',
  },
  startButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  actionText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  secondaryText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  pickerLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  pickerLabel: {
    ...typography.bodySmall,
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: spacing.xs,
  },
  hmLabels: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  secondsLabelWrap: {
    width: 80,
    marginLeft: -spacing.sm,
    alignItems: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    paddingLeft: 0,
  },
  timePicker: {
    flex: 1,
  },
  secondsPickerContainer: {
    width: 80,
    marginLeft: -spacing.lg,
    height: 220,
    position: 'relative',
    justifyContent: 'center',
  },
  secondsPicker: {
    width: '100%',
    height: '100%',
  },
  secondsPickerContent: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  secondsItem: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  secondsItemSelected: {
    // mimic native picker highlight
  },
  secondsText: {
    fontSize: 20,
    color: '#6b7280', // darker gray for unselected
  },
  secondsTextSelected: {
    fontWeight: '600',
    color: colors.text,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    alignSelf: 'flex-start',
    marginTop: spacing.xxxl * 2,
    marginBottom: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
  },
});

export default CountdownTimerScreen;
