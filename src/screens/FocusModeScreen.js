import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';

const formatDuration = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const paddedSeconds = String(seconds).padStart(2, '0');
  return `${minutes}:${paddedSeconds}`;
};

const FocusModeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [active, setActive] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [startMs, setStartMs] = React.useState(0);
  const [accumulatedMs, setAccumulatedMs] = React.useState(0);
  const [tick, setTick] = React.useState(0);
  const [exitToast, setExitToast] = React.useState('');

  const elapsedMs = React.useMemo(() => {
    if (!active) return accumulatedMs;
    const nowMs = paused ? 0 : Date.now() - startMs;
    return accumulatedMs + nowMs;
  }, [active, paused, accumulatedMs, startMs, tick]);

  React.useEffect(() => {
    if (!active || paused) return undefined;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, paused]);

  React.useLayoutEffect(() => {
    navigation?.setOptions?.({ gestureEnabled: false });
  }, [navigation]);

  React.useEffect(() => {
    const onBackPress = () => true; // block hardware back
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  const handleStart = () => {
    setAccumulatedMs(0);
    setStartMs(Date.now());
    setPaused(false);
    setActive(true);
    setTick(Date.now());
  };

  const handlePause = () => {
    if (!active || paused) return;
    const now = Date.now();
    setAccumulatedMs((prev) => prev + (now - startMs));
    setPaused(true);
  };

  const handleResume = () => {
    if (!active || !paused) return;
    setStartMs(Date.now());
    setPaused(false);
    setTick(Date.now());
  };

  const handleExit = () => {
    const now = Date.now();
    const total = paused ? accumulatedMs : accumulatedMs + (now - startMs);
    setActive(false);
    setPaused(false);
    setAccumulatedMs(total);
    setStartMs(0);
    setTick(0);
    const message = `You have just spent ${formatDuration(total)} in focus mode`;
    navigation.navigate('Main', { screen: 'Home', params: { focusToast: message } });
  };

  const isExitAvailable = paused;

  return (
    <LinearGradient
      colors={['#2e2eb8', '#2e2eb8', '#000000']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.gradientContainer, { paddingTop: insets.top + spacing.xl }]}
    >
      {!!exitToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{exitToast}</Text>
        </View>
      )}
      <Text style={styles.timerText}>{formatDuration(elapsedMs)}</Text>
      <View style={styles.controls}>
        {!active && (
          <>
            <TouchableOpacity style={styles.controlButton} onPress={handleStart}>
              <Ionicons name="play" size={24} color="#fff" />
              <Text style={styles.controlText}>Start</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.dangerButton]} onPress={handleExit}>
              <Ionicons name="exit" size={24} color="#fff" />
              <Text style={styles.controlText}>Exit</Text>
            </TouchableOpacity>
          </>
        )}
        {active && !paused && (
          <TouchableOpacity style={styles.controlButton} onPress={handlePause}>
            <Ionicons name="pause" size={24} color="#fff" />
            <Text style={styles.controlText}>Pause</Text>
          </TouchableOpacity>
        )}
        {active && paused && (
          <>
            <TouchableOpacity style={[styles.controlButton, styles.secondaryButton]} onPress={handleResume}>
              <Ionicons name="play" size={24} color={colors.text} />
              <Text style={styles.controlTextSecondary}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.controlButton, styles.dangerButton]} onPress={handleExit}>
              <Ionicons name="exit" size={24} color="#fff" />
              <Text style={styles.controlText}>Exit</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <Text style={styles.hint}>
        {!active ? 'Tap start to begin focus.' : paused ? 'Resume or exit your session.' : 'Pause to reveal exit.'}
      </Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  timerText: {
    ...typography.h1,
    fontSize: 48,
    marginBottom: spacing.xl,
    color: colors.text,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: '#141452',
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  controlText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  controlTextSecondary: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: '#141452',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  toast: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.small,
  },
  toastText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
});

export default FocusModeScreen;
