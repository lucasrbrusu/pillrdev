import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, shadows, spacing, typography } from '../utils/theme';

const TUTORIAL_STEPS = [
  {
    id: 'enter',
    title: 'Enter habit page',
    description: 'Tap on the habit to add exact progress.',
  },
  {
    id: 'quick_done',
    title: 'Quick mark as done',
    description: 'Swipe right to add progress and completion.',
  },
  {
    id: 'quick_actions',
    title: 'More quick actions',
    description: 'Swipe left on a habit to reveal details, skip, and reset actions.',
  },
  {
    id: 'choose_method',
    title: 'Choose completion method',
    description:
      'Pick how you want to complete habits. You can change this anytime from the Habits header settings button.',
  },
];

const normalizeCompletionMethod = (value) =>
  String(value || 'swipe').toLowerCase() === 'manual_plus' ? 'manual_plus' : 'swipe';

const PREVIEW_ROWS = [
  {
    id: 'pitches',
    title: 'Practise pitches through...',
    progress: '36 / 50 times',
    streak: '0 day streak',
    percent: '72%',
    color: '#6D42D8',
    icon: '\u266B',
  },
  {
    id: 'night',
    title: 'Night exercises',
    progress: '0 / 1 times',
    streak: '2 day streak',
    percent: '0%',
    color: '#6D8FD2',
    icon: '\u2728',
  },
  {
    id: 'stretches',
    title: 'Morning stretches',
    progress: '1 / 1 times',
    streak: '3 day streak',
    percent: '100%',
    color: '#DF2B33',
    icon: '\u{1F9D8}',
  },
  {
    id: 'report',
    title: 'Check report daily',
    progress: '10 / 10 times',
    streak: '4 day streak',
    percent: '100%',
    color: '#06A66F',
    icon: '\u{1F4C8}',
  },
];

const HabitPreviewRow = ({ row, compact = false, clipRight = false, style }) => (
  <View
    style={[
      styles.previewRow,
      compact && styles.previewRowCompact,
      { backgroundColor: row.color },
      clipRight && styles.previewRowClipped,
      style,
    ]}
  >
    <View style={styles.previewRowMain}>
      <View style={styles.previewIconWrap}>
        <Text style={styles.previewIconText}>{row.icon}</Text>
      </View>
      <View style={styles.previewTextWrap}>
        <Text style={styles.previewTitle} numberOfLines={1}>
          {row.title}
        </Text>
        <Text style={styles.previewProgress}>{row.progress}</Text>
      </View>
      <View style={styles.previewStatsWrap}>
        <Text style={styles.previewStreak}>{`\u{1F525} ${row.streak}`}</Text>
        <Text style={styles.previewPercent}>{row.percent}</Text>
      </View>
    </View>
    {!compact ? (
      <Text style={styles.previewHint} numberOfLines={1}>
        Swipe right to add progress - Swipe left for actions - Tap for exact amount
      </Text>
    ) : null}
  </View>
);

const SwipeActionsRail = () => (
  <View style={styles.actionsRail}>
    <View style={[styles.actionTile, styles.actionTileDetails]}>
      <Ionicons name="create-outline" size={18} color="#2D6BFF" />
      <Text style={[styles.actionText, { color: '#2D6BFF' }]}>Details</Text>
    </View>
    <View style={[styles.actionTile, styles.actionTileSkip]}>
      <Ionicons name="play-skip-forward" size={18} color="#F18C1F" />
      <Text style={[styles.actionText, { color: '#F18C1F' }]}>Skip</Text>
    </View>
    <View style={[styles.actionTile, styles.actionTileReset]}>
      <Ionicons name="refresh" size={18} color="#1F9F58" />
      <Text style={[styles.actionText, { color: '#1F9F58' }]}>Reset</Text>
    </View>
  </View>
);

const renderStepPreview = (stepId, selectedCompletionMethod, onSelectCompletionMethod) => {
  const selectedMethod = normalizeCompletionMethod(selectedCompletionMethod);

  if (stepId === 'choose_method') {
    const isSwipeSelected = selectedMethod === 'swipe';
    const isManualSelected = selectedMethod === 'manual_plus';
    return (
      <View style={styles.methodPickerWrap}>
        <Pressable
          style={[styles.methodOption, isSwipeSelected && styles.methodOptionSelected]}
          onPress={() => onSelectCompletionMethod?.('swipe')}
        >
          <View style={styles.methodPreviewRow}>
            <View style={styles.methodPreviewFill} />
            <Ionicons name="arrow-forward" size={16} color="#1D4ED8" />
          </View>
          <Text style={styles.methodOptionTitle}>Swipe completion</Text>
          <Text style={styles.methodOptionText}>Swipe right to fill progress quickly.</Text>
        </Pressable>

        <Pressable
          style={[styles.methodOption, isManualSelected && styles.methodOptionSelected]}
          onPress={() => onSelectCompletionMethod?.('manual_plus')}
        >
          <View style={styles.methodPreviewRow}>
            <View style={styles.methodPreviewDot} />
            <View style={styles.methodPreviewPlus}>
              <Ionicons name="add" size={15} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.methodOptionTitle}>Manual + button</Text>
          <Text style={styles.methodOptionText}>Use + on each habit card to add completion.</Text>
        </Pressable>
      </View>
    );
  }

  if (stepId === 'quick_done') {
    return (
      <View>
        <HabitPreviewRow row={PREVIEW_ROWS[0]} compact />
        <View style={styles.previewSpacer} />
        <View style={styles.quickDoneRow}>
          <HabitPreviewRow row={PREVIEW_ROWS[1]} compact />
          <View style={styles.quickDoneGestureWrap}>
            <Ionicons name="arrow-forward" size={30} color="#111827" />
            <Ionicons name="hand-left" size={28} color="#F2C9A6" style={styles.quickDoneHand} />
          </View>
        </View>
        <View style={styles.previewSpacer} />
        <HabitPreviewRow row={PREVIEW_ROWS[2]} compact />
      </View>
    );
  }

  if (stepId === 'quick_actions') {
    return (
      <View>
        <HabitPreviewRow row={PREVIEW_ROWS[0]} compact />
        <View style={styles.previewSpacer} />
        <View style={styles.quickActionsRow}>
          <HabitPreviewRow row={PREVIEW_ROWS[1]} compact style={styles.quickActionsSwipedCard} />
          <SwipeActionsRail />
        </View>
        <View style={styles.previewSpacer} />
        <HabitPreviewRow row={PREVIEW_ROWS[2]} compact />
      </View>
    );
  }

  return (
    <View>
      {PREVIEW_ROWS.map((row) => (
        <View key={row.id} style={styles.previewListRowWrap}>
          <HabitPreviewRow row={row} compact />
        </View>
      ))}
      <View style={styles.tapPointerWrap} pointerEvents="none">
        <Ionicons name="hand-left" size={34} color="#F2C9A6" />
      </View>
    </View>
  );
};

const HabitsHowToOverlay = ({
  visible,
  onFinish,
  initialCompletionMethod = 'swipe',
}) => {
  const [stepIndex, setStepIndex] = React.useState(0);
  const [selectedCompletionMethod, setSelectedCompletionMethod] = React.useState('swipe');

  React.useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
  }, [visible]);

  React.useEffect(() => {
    if (!visible) return;
    setSelectedCompletionMethod(normalizeCompletionMethod(initialCompletionMethod));
  }, [initialCompletionMethod, visible]);

  if (!visible) return null;

  const step = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onFinish?.({ completionMethod: normalizeCompletionMethod(selectedCompletionMethod) });
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  };

  const handleClose = () => {
    onFinish?.({ completionMethod: normalizeCompletionMethod(selectedCompletionMethod) });
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
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{step.title}</Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={20} color="#2B2B2B" />
            </Pressable>
          </View>

          <View style={styles.body}>
            {renderStepPreview(step.id, selectedCompletionMethod, setSelectedCompletionMethod)}
          </View>

          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.footer}>
            <View style={styles.dotRow}>
              {TUTORIAL_STEPS.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.dot, index === stepIndex && styles.dotActive]}
                />
              ))}
            </View>
            <Pressable style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>{isLastStep ? 'Save & Done' : 'Next'}</Text>
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
    backgroundColor: 'rgba(20, 22, 30, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEAF3',
    ...shadows.large,
  },
  header: {
    backgroundColor: '#E9D9C8',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '800',
    color: '#1A1A1A',
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  previewListRowWrap: {
    marginBottom: spacing.sm,
  },
  previewRow: {
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  previewRowCompact: {
    minHeight: 86,
  },
  previewRowClipped: {
    width: '66%',
  },
  previewRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  previewIconText: {
    fontSize: 24,
  },
  previewTextWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  previewTitle: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  previewProgress: {
    ...typography.body,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '700',
    marginTop: 2,
  },
  previewStatsWrap: {
    alignItems: 'flex-end',
  },
  previewStreak: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  previewPercent: {
    ...typography.h3,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 2,
  },
  previewHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  previewSpacer: {
    height: spacing.sm,
  },
  quickDoneRow: {
    justifyContent: 'center',
  },
  quickDoneGestureWrap: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickDoneHand: {
    marginLeft: 2,
    marginTop: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    marginHorizontal: -spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  quickActionsSwipedCard: {
    width: '70%',
    marginLeft: -80,
  },
  actionsRail: {
    width: '50%',
    marginLeft: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionTile: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionTileDetails: {
    backgroundColor: '#EEF4FF',
    borderColor: '#D8E6FF',
  },
  actionTileSkip: {
    backgroundColor: '#FFF4E7',
    borderColor: '#FFE2C2',
  },
  actionTileReset: {
    backgroundColor: '#EAF9F0',
    borderColor: '#CFEEDB',
  },
  actionText: {
    ...typography.bodySmall,
    marginTop: 4,
    fontWeight: '800',
  },
  tapPointerWrap: {
    position: 'absolute',
    left: '50%',
    top: '45%',
    marginLeft: -16,
  },
  methodPickerWrap: {
    marginBottom: spacing.xs,
  },
  methodOption: {
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: '#E9E0F0',
    backgroundColor: '#F8F5FC',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  methodOptionSelected: {
    borderColor: '#ED718B',
    backgroundColor: '#FDEFF4',
  },
  methodPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    height: 34,
  },
  methodPreviewFill: {
    flex: 1,
    height: 12,
    borderRadius: borderRadius.full,
    backgroundColor: '#86B9FF',
    marginRight: spacing.sm,
  },
  methodPreviewDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C7B6EA',
  },
  methodPreviewPlus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodOptionTitle: {
    ...typography.body,
    color: '#1E1E1E',
    fontWeight: '800',
  },
  methodOptionText: {
    ...typography.caption,
    color: '#4B5563',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  description: {
    ...typography.body,
    color: '#262626',
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E4DEE8',
    marginRight: 8,
  },
  dotActive: {
    width: 22,
    borderRadius: 8,
    backgroundColor: '#ED718B',
  },
  nextButton: {
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#ED718B',
  },
  nextButtonText: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default HabitsHowToOverlay;
