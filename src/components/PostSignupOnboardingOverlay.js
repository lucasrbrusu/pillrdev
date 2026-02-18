import React from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing } from '../utils/theme';

const STEPS = [
  {
    id: 'habits',
    title: 'Want to become a more disciplined you?',
    description:
      'Build consistency with small daily wins, streaks, and progress you can see.',
    buttonLabel: 'Yes, lets do it',
  },
  {
    id: 'tasks',
    title: 'Want to better plan your day?',
    description:
      'Turn big goals into clear actions and execute one focused step at a time.',
    buttonLabel: 'Keep going',
  },
  {
    id: 'health',
    title: 'Want more energy and focus?',
    description:
      'Track sleep, hydration, and nutrition so your discipline has fuel every day.',
    buttonLabel: 'I want this',
  },
  {
    id: 'routine',
    title: 'Want structure that actually sticks?',
    description:
      'Use routines, reminders, and repeatable systems to stay in control.',
    buttonLabel: 'Continue',
  },
  {
    id: 'finance',
    title: 'Ready to level up every area of life?',
    description:
      'Habits, tasks, health, routines, and finances in one place for real progress.',
    buttonLabel: 'Start my journey',
  },
];

const habitRows = [
  { id: 'habit-1', name: 'Study the book', progress: '0/5 times', streak: '0 day streak', percent: '0%', color: '#57B9B1' },
  { id: 'habit-2', name: 'Practise pitches', progress: '30/50 times', streak: '0 day streak', percent: '60%', color: '#6B4AE2' },
  { id: 'habit-3', name: 'Night exercises', progress: '1/1 times', streak: '2 day streak', percent: '100%', color: '#2F6BDF' },
  { id: 'habit-4', name: 'Morning stretches', progress: '1/1 times', streak: '2 day streak', percent: '100%', color: '#E33A3A' },
];

const taskRows = [
  { id: 'task-1', title: 'Meeting with associate', priority: 'Low', due: '02/23/2026', priorityColor: '#9CA3AF' },
  { id: 'task-2', title: 'Presentation with team', priority: 'High', due: '02/25/2026', priorityColor: '#EF4444' },
  { id: 'task-3', title: 'Discuss documents to John', priority: 'Medium', due: '03/05/2026', priorityColor: '#F59E0B' },
];

const routineRows = [
  { id: 'routine-1', title: 'morning routine', meta: '0 tasks · no range set' },
  { id: 'routine-2', title: 'Weekly reset', meta: 'Family · 0 tasks' },
  { id: 'routine-3', title: 'group routine', meta: '12:00 - 13:00 (1h)' },
];

const financeLegend = [
  { id: 'bills', name: 'bills', amount: '850', color: '#16A34A' },
  { id: 'health', name: 'health', amount: '400', color: '#EF4444' },
  { id: 'food', name: 'food', amount: '200', color: '#6366F1' },
  { id: 'shopping', name: 'shopping', amount: '160', color: '#F59E0B' },
  { id: 'entertainment', name: 'entertainment', amount: '50', color: '#EC4899' },
];

const renderHabitsPreview = () => (
  <View style={styles.previewCanvas}>
    <View style={styles.previewChipRow}>
      <View style={[styles.previewChip, styles.previewChipActive]}><Text style={styles.previewChipActiveText}>All</Text></View>
      <View style={styles.previewChip}><Text style={styles.previewChipText}>Morning</Text></View>
      <View style={styles.previewChip}><Text style={styles.previewChipText}>Evening</Text></View>
    </View>
    {habitRows.map((row) => (
      <View key={row.id} style={[styles.habitCard, { backgroundColor: row.color }]}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.habitTitle}>{row.name}</Text>
          <Text style={styles.habitMeta}>{row.progress}</Text>
        </View>
        <View style={styles.habitRight}>
          <Text style={styles.habitMeta}>{row.streak}</Text>
          <Text style={styles.habitPercent}>{row.percent}</Text>
        </View>
      </View>
    ))}
  </View>
);

const renderTasksPreview = () => (
  <View style={styles.previewCanvas}>
    <View style={styles.taskButtonRow}>
      <View style={[styles.taskButton, styles.taskButtonPrimary]}><Text style={styles.taskButtonPrimaryText}>Add Task</Text></View>
      <View style={styles.taskButton}><Text style={styles.taskButtonText}>Create Note</Text></View>
    </View>
    {taskRows.map((row) => (
      <View key={row.id} style={styles.taskRow}>
        <View style={[styles.taskPriorityPill, { backgroundColor: `${row.priorityColor}22` }]}>
          <Text style={[styles.taskPriorityText, { color: row.priorityColor }]}>{row.priority}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.taskTitle}>{row.title}</Text>
          <Text style={styles.taskDue}>{row.due}</Text>
        </View>
      </View>
    ))}
  </View>
);

const renderHealthPreview = () => (
  <View style={styles.previewCanvas}>
    <View style={styles.healthTopRow}>
      <View style={styles.healthStatCard}>
        <Text style={styles.healthStatLabel}>Avg Water</Text>
        <Text style={[styles.healthStatValue, { color: '#3B82F6' }]}>0.49 L</Text>
      </View>
      <View style={styles.healthStatCard}>
        <Text style={styles.healthStatLabel}>Avg Sleep</Text>
        <Text style={[styles.healthStatValue, { color: '#A855F7' }]}>7.5 hours</Text>
      </View>
    </View>
    <View style={styles.calorieCard}>
      <View style={styles.calorieLeft}>
        <Text style={styles.calorieTitle}>Calorie Tracker</Text>
        <Text style={styles.calorieMeta}>Goal 2159 cal</Text>
        <Text style={styles.calorieMeta}>Consumed 0 cal</Text>
      </View>
      <View style={styles.calorieRing}>
        <Text style={styles.calorieRingValue}>2159</Text>
        <Text style={styles.calorieRingLabel}>remaining</Text>
      </View>
    </View>
    <View style={styles.tipCard}>
      <Text style={styles.tipText}>Tip: Focus on carbs to stay on track today.</Text>
    </View>
  </View>
);

const renderRoutinePreview = () => (
  <View style={styles.previewCanvas}>
    <View style={styles.routineSummaryRow}>
      <View style={styles.routineSummary}><Text style={styles.routineSummaryValue}>3</Text><Text style={styles.routineSummaryLabel}>Routines</Text></View>
      <View style={styles.routineSummary}><Text style={styles.routineSummaryValue}>2</Text><Text style={styles.routineSummaryLabel}>Open items</Text></View>
      <View style={styles.routineSummary}><Text style={styles.routineSummaryValue}>2</Text><Text style={styles.routineSummaryLabel}>Reminders</Text></View>
    </View>
    {routineRows.map((row) => (
      <View key={row.id} style={styles.routineRow}>
        <View>
          <Text style={styles.routineTitle}>{row.title}</Text>
          <Text style={styles.routineMeta}>{row.meta}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#7C83A3" />
      </View>
    ))}
  </View>
);

const renderFinancePreview = () => (
  <View style={styles.previewCanvas}>
    <View style={styles.financeHeaderCard}>
      <Text style={styles.financeHeaderLabel}>Total Balance</Text>
      <Text style={styles.financeHeaderValue}>GBP 410</Text>
      <View style={styles.financeHeaderStats}>
        <Text style={styles.financeHeaderMeta}>Income 2100</Text>
        <Text style={styles.financeHeaderMeta}>Expenses 1690</Text>
      </View>
    </View>
    <View style={styles.financeInsightCard}>
      <View style={styles.financePie} />
      <View style={styles.financeLegend}>
        {financeLegend.map((item) => (
          <View key={item.id} style={styles.financeLegendRow}>
            <View style={[styles.financeDot, { backgroundColor: item.color }]} />
            <Text style={styles.financeLegendText}>{`${item.name} ${item.amount}`}</Text>
          </View>
        ))}
      </View>
    </View>
  </View>
);

const renderPreview = (id) => {
  if (id === 'tasks') return renderTasksPreview();
  if (id === 'health') return renderHealthPreview();
  if (id === 'routine') return renderRoutinePreview();
  if (id === 'finance') return renderFinancePreview();
  return renderHabitsPreview();
};

const PostSignupOnboardingOverlay = ({
  visible,
  onComplete,
  themeColors = colors,
}) => {
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = React.useState(0);
  const textColor = themeColors?.text || colors.text;
  const mutedColor = themeColors?.textSecondary || colors.textSecondary;

  React.useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  React.useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex > 0) {
        setStepIndex((prev) => Math.max(0, prev - 1));
      }
      return true;
    });
    return () => sub.remove();
  }, [stepIndex, visible]);

  if (!visible) return null;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
      return;
    }
    setStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1));
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <LinearGradient colors={['#F7EEF7', '#F6F3FF', '#F4FAFF']} style={styles.container}>
        <View style={styles.orbWrap} pointerEvents="none">
          <View style={styles.orbOne} />
          <View style={styles.orbTwo} />
        </View>
        <View style={[styles.inner, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton} disabled={stepIndex === 0}>
              {stepIndex > 0 ? <Ionicons name="arrow-back" size={21} color={textColor} /> : <View style={styles.backSpacer} />}
            </Pressable>
            <Text style={[styles.progressText, { color: mutedColor }]}>{`${stepIndex + 1}/${STEPS.length}`}</Text>
          </View>

          <View style={styles.centerContent}>
            <Text style={[styles.title, { color: textColor }]}>{step.title}</Text>
            <Text style={[styles.description, { color: mutedColor }]}>{step.description}</Text>

            <View style={styles.phoneFrame}>
              <View style={styles.notch} />
              {renderPreview(step.id)}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.indicatorRow}>
              {STEPS.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.indicatorDot,
                    index === stepIndex && styles.indicatorDotActive,
                  ]}
                />
              ))}
            </View>

            <Pressable style={styles.ctaButton} onPress={handleNext}>
              <LinearGradient colors={['#FF5F96', '#FF4E86']} style={styles.ctaGradient}>
                <Text style={styles.ctaLabel}>{step.buttonLabel}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orbWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  orbOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 105, 170, 0.14)',
    top: -80,
    right: -60,
  },
  orbTwo: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(80, 160, 255, 0.12)',
    bottom: -110,
    left: -80,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  backSpacer: {
    width: 21,
    height: 21,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: Platform.select({
      ios: 'AvenirNext-Bold',
      android: 'sans-serif-black',
      default: undefined,
    }),
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 430,
    flex: 1,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: '#E7E2F1',
    backgroundColor: '#FFFFFF',
    paddingTop: 26,
    paddingHorizontal: 14,
    paddingBottom: 12,
    overflow: 'hidden',
    ...shadows.medium,
  },
  notch: {
    position: 'absolute',
    top: 10,
    left: '50%',
    marginLeft: -46,
    width: 92,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#F1EDF4',
  },
  previewCanvas: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  previewChipRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  previewChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F4F1FB',
    marginRight: spacing.xs,
  },
  previewChipActive: {
    backgroundColor: '#B469E8',
  },
  previewChipText: {
    fontSize: 11,
    color: '#636C80',
    fontWeight: '700',
  },
  previewChipActiveText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  habitCard: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  habitMeta: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  habitRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  habitPercent: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  taskButtonRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  taskButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DEEF',
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: spacing.xs,
    backgroundColor: '#FFFFFF',
  },
  taskButtonPrimary: {
    backgroundColor: '#C34CEC',
    borderColor: '#C34CEC',
  },
  taskButtonText: {
    color: '#2A3247',
    fontSize: 13,
    fontWeight: '700',
  },
  taskButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  taskRow: {
    borderRadius: 16,
    backgroundColor: '#F7F3FF',
    borderWidth: 1,
    borderColor: '#EAE1F7',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskPriorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: spacing.sm,
  },
  taskPriorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  taskTitle: {
    color: '#20273A',
    fontSize: 13,
    fontWeight: '700',
  },
  taskDue: {
    marginTop: 2,
    color: '#778097',
    fontSize: 11,
    fontWeight: '600',
  },
  healthTopRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  healthStatCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E3F2',
    backgroundColor: '#FDFDFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginRight: spacing.xs,
  },
  healthStatLabel: {
    color: '#798199',
    fontSize: 12,
    fontWeight: '600',
  },
  healthStatValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
  },
  calorieCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BEE8D0',
    backgroundColor: '#F7FFFA',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  calorieLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  calorieTitle: {
    color: '#199B5E',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  calorieMeta: {
    color: '#4D8E6C',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  calorieRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieRingValue: {
    color: '#0D9B64',
    fontSize: 21,
    fontWeight: '800',
  },
  calorieRingLabel: {
    color: '#0D9B64',
    fontSize: 11,
    fontWeight: '700',
  },
  tipCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE4EF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  tipText: {
    color: '#6C7490',
    fontSize: 12,
    fontWeight: '600',
  },
  routineSummaryRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  routineSummary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E0F2',
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: spacing.xs,
    backgroundColor: '#FBF8FF',
  },
  routineSummaryValue: {
    color: '#2A3147',
    fontSize: 20,
    fontWeight: '800',
  },
  routineSummaryLabel: {
    color: '#768099',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  routineRow: {
    borderRadius: 14,
    backgroundColor: '#F5F2FB',
    borderWidth: 1,
    borderColor: '#E4DEF1',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  routineTitle: {
    color: '#5460E5',
    fontSize: 14,
    fontWeight: '700',
  },
  routineMeta: {
    color: '#79819B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  financeHeaderCard: {
    borderRadius: 16,
    backgroundColor: '#32A5F6',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: spacing.sm,
  },
  financeHeaderLabel: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
  },
  financeHeaderValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 3,
  },
  financeHeaderStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  financeHeaderMeta: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
  },
  financeInsightCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE7F3',
    backgroundColor: '#FFFFFF',
    padding: 10,
    flexDirection: 'row',
    flex: 1,
  },
  financePie: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EAF5FF',
    borderWidth: 8,
    borderColor: '#22C55E',
    marginRight: spacing.sm,
    alignSelf: 'center',
  },
  financeLegend: {
    flex: 1,
    justifyContent: 'center',
  },
  financeLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  financeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 6,
  },
  financeLegendText: {
    color: '#30374D',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    paddingTop: spacing.md,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D7D1E6',
    marginHorizontal: 4,
  },
  indicatorDotActive: {
    width: 28,
    borderRadius: 9,
    backgroundColor: '#FF5B92',
  },
  ctaButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    ...shadows.medium,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontFamily: Platform.select({
      ios: 'AvenirNext-DemiBold',
      android: 'sans-serif-medium',
      default: undefined,
    }),
  },
});

export default PostSignupOnboardingOverlay;
