import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing, typography } from '../utils/theme';

const TUTORIAL_STEPS = [
  {
    id: 'habits',
    title: 'Habits',
    subtitle: 'Build consistency with daily check-ins and streak momentum.',
    color: colors.habits,
    features: [
      {
        icon: 'calendar-outline',
        name: 'Date switcher',
        does: 'Lets users review habit progress for any day.',
        howTo: 'Use left or right arrows, or tap the date field to jump between days.',
      },
      {
        icon: 'flame-outline',
        name: 'Summary cards',
        does: 'Shows Current streak, Due today, and Total habits at a glance.',
        howTo: 'Check these first to understand daily priority and streak status.',
      },
      {
        icon: 'filter-outline',
        name: 'Habit filters',
        does: 'Splits habits by type and time window so the list stays focused.',
        howTo: 'Tap chips like All, Personal, Group, Morning, or Evening.',
      },
      {
        icon: 'swap-horizontal-outline',
        name: 'Habit action cards',
        does: 'Supports quick progress and quick actions directly on each card.',
        howTo:
          'Swipe right to add progress, swipe left for actions, or tap a habit for detailed progress.',
      },
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    subtitle: 'Plan the day with clear priorities and a calendar view.',
    color: colors.tasks,
    features: [
      {
        icon: 'calendar-clear-outline',
        name: 'Month and day strip',
        does: 'Shows the active month with selectable day targets.',
        howTo: 'Tap a day to load that date, or use arrows to move to the next period.',
      },
      {
        icon: 'list-outline',
        name: 'Task tabs and sorting',
        does: 'Separates All, Tasks, and Holidays plus quick sorting controls.',
        howTo: 'Tap filters like Date, Priority, and A-Z to reorder the list instantly.',
      },
      {
        icon: 'add-circle-outline',
        name: 'Quick create actions',
        does: 'Adds new tasks and opens additional creation actions from the header.',
        howTo: 'Tap the plus button to create a task with date, time, and priority.',
      },
    ],
  },
  {
    id: 'health',
    title: 'Health',
    subtitle: 'Track hydration, sleep, nutrition, and mood in one flow.',
    color: colors.health,
    features: [
      {
        icon: 'water-outline',
        name: 'Water and sleep summary',
        does: 'Shows average hydration and sleep performance over recent days.',
        howTo: 'Check the cards daily to compare progress against your goal values.',
      },
      {
        icon: 'fitness-outline',
        name: 'Calorie tracker',
        does: 'Tracks daily calories and macro goals with remaining balance.',
        howTo: 'Tap Edit to update targets, then log meals to reduce the remaining count.',
      },
      {
        icon: 'flower-outline',
        name: 'Mood Garden shortcut',
        does: 'Connects mood logging with visual wellbeing tracking.',
        howTo: 'Open Mood Garden from the card to log a mood and grow your garden.',
      },
    ],
  },
  {
    id: 'mood-garden',
    title: 'Mood Garden',
    subtitle: 'Log feelings and visualize emotional trends as flowers.',
    color: '#E55EA4',
    features: [
      {
        icon: 'leaf-outline',
        name: 'Garden health',
        does: 'Summarizes mood consistency and overall emotional momentum.',
        howTo: 'Review the health percentage to monitor week-to-week wellbeing.',
      },
      {
        icon: 'calendar-number-outline',
        name: 'This week tracker',
        does: 'Shows which days already have a logged mood.',
        howTo: 'Use the weekly row to quickly spot missed days and keep consistency.',
      },
      {
        icon: 'happy-outline',
        name: 'Mood picker grid',
        does: 'Lets users select specific feelings and instantly log them.',
        howTo: 'Tap one mood tile per day; each log plants a new flower in the garden.',
      },
    ],
  },
  {
    id: 'routine',
    title: 'Routine Hub',
    subtitle: 'Manage routines, group routines, lists, and reminders.',
    color: colors.routine,
    features: [
      {
        icon: 'stats-chart-outline',
        name: 'Routine summary cards',
        does: 'Shows counts for routines, open list items, and reminders.',
        howTo: 'Use the top cards to identify where attention is needed first.',
      },
      {
        icon: 'repeat-outline',
        name: 'Routine sections',
        does: 'Organizes personal routines, group routines, lists, and reminders.',
        howTo: 'Open any section card to view details, then tap Create or Add to build one.',
      },
      {
        icon: 'add-outline',
        name: 'Quick add button',
        does: 'Creates new routine items without leaving the screen.',
        howTo: 'Use the top-right plus button for fast routine and reminder creation.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finances',
    subtitle: 'Track income, expenses, transactions, and spending insights.',
    color: colors.finance,
    features: [
      {
        icon: 'cash-outline',
        name: 'Record income and expense',
        does: 'Adds money in or out for the selected date.',
        howTo: 'Tap Record Income or Record Expense, fill details, then save.',
      },
      {
        icon: 'wallet-outline',
        name: 'Balance overview card',
        does: 'Displays total balance with income and expense breakdown.',
        howTo: 'Use the top amount as net position and the sub-cards for quick comparison.',
      },
      {
        icon: 'receipt-outline',
        name: 'Transactions panel',
        does: 'Lists all entries for the active date.',
        howTo: 'Expand Transactions, then tap an entry when you need to update or remove it.',
      },
      {
        icon: 'pie-chart-outline',
        name: 'Spending insights',
        does: 'Breaks spending into categories and trend summaries.',
        howTo: 'Tap View details to open deeper analysis and category totals.',
      },
    ],
  },
  {
    id: 'home-widgets',
    title: 'Friends and Streak',
    subtitle: 'Use social progress and streaks to stay accountable.',
    color: '#4B6BFB',
    features: [
      {
        icon: 'people-outline',
        name: 'Friends widget',
        does: 'Shows friend count and quick profile access from the home area.',
        howTo: 'Tap the Friends card or avatar initials to open friends and profile activity.',
      },
      {
        icon: 'flame-outline',
        name: 'Current streak card',
        does: 'Tracks consecutive days of completed habit activity.',
        howTo: 'Check it daily and avoid missed days to keep the streak growing.',
      },
    ],
  },
  {
    id: 'navigation',
    title: 'Navigation and Assistant',
    subtitle: 'Move across app areas quickly and use the assistant for guidance.',
    color: '#4DA6FF',
    features: [
      {
        icon: 'grid-outline',
        name: 'Bottom navigation',
        does: 'Switches between Home, Habits, Tasks, Health, Routine, and Finance.',
        howTo: 'Tap any tab icon to move sections while keeping your context.',
      },
      {
        icon: 'sparkles-outline',
        name: 'Center AI button',
        does: 'Opens the assistant for ideas, planning help, and quick guidance.',
        howTo: 'Tap the sparkles button whenever you want support across any feature.',
      },
    ],
  },
];

const AppTutorialOverlay = ({ visible, onDismiss, themeColors = colors }) => {
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  if (!visible) return null;

  const step = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const textPrimary = themeColors?.text || '#1A1B22';
  const textMuted = themeColors?.textSecondary || '#5F667A';

  const handleClose = () => onDismiss?.();
  const handleNext = () => {
    if (isLastStep) {
      onDismiss?.();
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.header, { backgroundColor: `${step.color}1F` }]}>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.stepCount, { color: step.color }]}>
                {`Step ${stepIndex + 1} of ${TUTORIAL_STEPS.length}`}
              </Text>
              <Text style={[styles.headerTitle, { color: textPrimary }]}>{step.title}</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={textPrimary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={[styles.subtitle, { color: textMuted }]}>{step.subtitle}</Text>

            {step.features.map((feature) => (
              <View key={`${step.id}-${feature.name}`} style={styles.featureCard}>
                <View style={[styles.iconWrap, { backgroundColor: `${step.color}16` }]}>
                  <Ionicons name={feature.icon} size={18} color={step.color} />
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={[styles.featureName, { color: textPrimary }]}>{feature.name}</Text>
                  <Text style={[styles.featureLine, { color: textMuted }]}>
                    <Text style={styles.featureLabel}>Does: </Text>
                    {feature.does}
                  </Text>
                  <Text style={[styles.featureLine, { color: textMuted }]}>
                    <Text style={styles.featureLabel}>How: </Text>
                    {feature.howTo}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.dotRow}>
              {TUTORIAL_STEPS.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.dot,
                    index === stepIndex && [styles.dotActive, { backgroundColor: step.color }],
                  ]}
                />
              ))}
            </View>
            <Pressable style={[styles.nextButton, { backgroundColor: step.color }]} onPress={handleNext}>
              <Text style={styles.nextButtonText}>{isLastStep ? 'Done' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 19, 29, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EAF2',
    ...shadows.large,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  stepCount: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '800',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  featureCard: {
    borderWidth: 1,
    borderColor: '#E9ECF5',
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 1,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureName: {
    ...typography.body,
    fontWeight: '800',
    marginBottom: 2,
  },
  featureLine: {
    ...typography.bodySmall,
    lineHeight: 20,
    fontWeight: '600',
  },
  featureLabel: {
    fontWeight: '800',
    color: '#1C2232',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F6',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingRight: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DFE4EF',
    marginRight: 6,
    marginTop: 2,
  },
  dotActive: {
    width: 22,
    borderRadius: 8,
  },
  nextButton: {
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    minWidth: 104,
    alignItems: 'center',
  },
  nextButtonText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default AppTutorialOverlay;
