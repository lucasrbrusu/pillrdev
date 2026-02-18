import React from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing, typography } from '../utils/theme';

const TUTORIAL_STEPS = [
  {
    id: 'home',
    title: 'Home',
    summary: 'Quick daily overview with your progress, tasks, and shortcuts.',
    routeIndex: 0,
    color: colors.primary,
    highlightWidth: 92,
    highlightHeight: 72,
  },
  {
    id: 'habits',
    title: 'Habits',
    summary: 'Build consistency with habit streaks, reminders, and completions.',
    routeIndex: 1,
    color: colors.habits,
    highlightWidth: 92,
    highlightHeight: 72,
  },
  {
    id: 'tasks',
    title: 'Tasks',
    summary: 'Plan your day with tasks, due dates, and archive management.',
    routeIndex: 2,
    color: colors.tasks,
    highlightWidth: 92,
    highlightHeight: 72,
  },
  {
    id: 'health',
    title: 'Health',
    summary: 'Track nutrition, hydration, sleep, and wellness metrics.',
    routeIndex: 3,
    color: colors.health,
    highlightWidth: 92,
    highlightHeight: 72,
  },
  {
    id: 'routine',
    title: 'Routine',
    summary: 'Set repeatable routines with timings and daily structure.',
    routeIndex: 4,
    color: colors.routine,
    highlightWidth: 92,
    highlightHeight: 72,
  },
  {
    id: 'finance',
    title: 'Finance',
    summary: 'Manage spending, budgets, and financial insights in one place.',
    routeIndex: 5,
    color: colors.finance,
    highlightWidth: 92,
    highlightHeight: 72,
  },
  {
    id: 'assistant',
    title: 'AI Assistant',
    summary: 'Tap the sparkles button for guidance, ideas, and focused help.',
    color: '#4da6ff',
    feature: 'chat',
    highlightWidth: 96,
    highlightHeight: 96,
  },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getTargetX = ({ width, step, layoutConfig }) => {
  if (step.feature === 'chat') {
    return width / 2;
  }

  const routeIndex = Number(step.routeIndex);
  if (!Number.isFinite(routeIndex)) {
    return width / 2;
  }

  const containerPaddingHorizontal = layoutConfig?.containerPaddingHorizontal ?? 20;
  const tabBarPaddingHorizontal = layoutConfig?.tabBarPaddingHorizontal ?? 16;
  const chatSpacerWidth = layoutConfig?.chatSpacerWidth ?? 60;
  const tabCount = layoutConfig?.tabCount ?? 6;
  const chatGapAfterIndex = layoutConfig?.chatGapAfterIndex ?? 2;
  const clampedRouteIndex = clamp(routeIndex, 0, tabCount - 1);

  const hasMeasuredTabBar =
    Number.isFinite(layoutConfig?.tabBarLayout?.x) &&
    Number.isFinite(layoutConfig?.tabBarLayout?.width);
  const barOuterLeft = hasMeasuredTabBar
    ? layoutConfig.tabBarLayout.x
    : containerPaddingHorizontal;
  const barOuterWidth = hasMeasuredTabBar
    ? layoutConfig.tabBarLayout.width
    : width - containerPaddingHorizontal * 2;
  const barInnerWidth = barOuterWidth - tabBarPaddingHorizontal * 2;
  const tabItemWidth = (barInnerWidth - chatSpacerWidth) / tabCount;
  const spacerShift = clampedRouteIndex > chatGapAfterIndex ? chatSpacerWidth : 0;

  return (
    barOuterLeft +
    tabBarPaddingHorizontal +
    tabItemWidth * (clampedRouteIndex + 0.5) +
    spacerShift
  );
};

const AppTutorialOverlay = ({
  visible,
  onDismiss,
  bottomPadding = 20,
  chatButtonBottom = 20,
  chatButtonSize = 60,
  chatButtonLift = 14,
  layoutConfig,
  themeColors = colors,
}) => {
  const [stepIndex, setStepIndex] = React.useState(0);
  const { width, height } = useWindowDimensions();

  React.useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  React.useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  if (!visible) return null;

  const step = TUTORIAL_STEPS[stepIndex];
  const isFinalStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const bubbleWidth = Math.min(width - 20, 700);
  const targetX = getTargetX({ width, step, layoutConfig });
  const iconCenterOffsetFromBottom = layoutConfig?.iconCenterOffsetFromBottom ?? 34;
  const targetBottom =
    step.feature === 'chat'
      ? chatButtonBottom + chatButtonSize / 2 + chatButtonLift
      : bottomPadding + iconCenterOffsetFromBottom;
  const targetY = height - targetBottom;
  const bubbleLeft = (width - bubbleWidth) / 2;
  const highlightWidth = step.highlightWidth || 92;
  const highlightHeight = step.highlightHeight || 72;
  const bubbleBottom = Math.max(targetBottom + highlightHeight / 2 + 18, bottomPadding + 108);
  const tailLeft = clamp(targetX - bubbleLeft - 14, 24, bubbleWidth - 24);
  const highlightLeft = clamp(
    targetX - highlightWidth / 2,
    8,
    width - highlightWidth - 8
  );
  const highlightTop = targetY - highlightHeight / 2;
  const showcaseInset = 2;
  const holeLeft = clamp(highlightLeft - showcaseInset, 0, width);
  const holeTop = clamp(highlightTop - showcaseInset, 0, height);
  const holeRight = clamp(highlightLeft + highlightWidth + showcaseInset, 0, width);
  const holeBottom = clamp(highlightTop + highlightHeight + showcaseInset, 0, height);
  const holeHeight = Math.max(0, holeBottom - holeTop);

  const handleNext = () => {
    if (isFinalStep) {
      onDismiss?.();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Pressable
        style={[styles.overlaySegment, { top: 0, left: 0, right: 0, height: holeTop }]}
        onPress={() => {}}
      />
      <Pressable
        style={[styles.overlaySegment, { top: holeBottom, left: 0, right: 0, bottom: 0 }]}
        onPress={() => {}}
      />
      {holeHeight > 0 && (
        <>
          <Pressable
            style={[
              styles.overlaySegment,
              { top: holeTop, left: 0, width: holeLeft, height: holeHeight },
            ]}
            onPress={() => {}}
          />
          <Pressable
            style={[
              styles.overlaySegment,
              { top: holeTop, left: holeRight, right: 0, height: holeHeight },
            ]}
            onPress={() => {}}
          />
        </>
      )}
      {holeHeight > 0 && (
        <Pressable
          style={[
            styles.showcaseTouchBlocker,
            {
              left: holeLeft,
              top: holeTop,
              width: Math.max(0, holeRight - holeLeft),
              height: holeHeight,
            },
          ]}
          onPress={() => {}}
        />
      )}

      <View
        style={[
          styles.highlightFrame,
          {
            left: highlightLeft,
            top: highlightTop,
            width: highlightWidth,
            height: highlightHeight,
          },
        ]}
      >
        <View style={styles.highlightInner} />
      </View>

      <View
        style={[
          styles.bubble,
          {
            left: bubbleLeft,
            bottom: bubbleBottom,
            width: bubbleWidth,
            backgroundColor: '#F7F7FA',
            borderColor: '#B9BBC4',
          },
        ]}
      >
        <View style={styles.bubbleTopRow}>
          <Text style={[styles.badge, { color: step.color }]}>
            {`Step ${stepIndex + 1}/${TUTORIAL_STEPS.length} - ${step.title}`}
          </Text>
          <Pressable onPress={onDismiss} hitSlop={10}>
            <Ionicons name="close" size={18} color={themeColors.textSecondary || colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.bubbleContentRow}>
          <Text style={[styles.summary, { color: '#14161D' }]}>{step.summary}</Text>
          <View style={styles.divider} />
          <Pressable style={styles.actionButton} onPress={handleNext}>
            <Text style={[styles.actionText, { color: step.color }]}>
              {isFinalStep ? 'Ok!' : 'Next'}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.bubbleTail,
            {
              left: tailLeft,
              borderTopColor: '#F7F7FA',
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlaySegment: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  showcaseTouchBlocker: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  highlightFrame: {
    position: 'absolute',
    borderRadius: 8,
    padding: 0,
  },
  highlightInner: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(243, 243, 247, 0.4)',
    backgroundColor: 'rgba(222, 222, 227, 0.07)',
  },
  bubble: {
    position: 'absolute',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    ...shadows.large,
  },
  bubbleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs / 2,
  },
  badge: {
    ...typography.caption,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  bubbleContentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summary: {
    ...typography.body,
    flex: 1,
    paddingRight: spacing.md,
  },
  divider: {
    width: 1,
    marginVertical: 2,
    backgroundColor: '#B9BBC4',
  },
  actionButton: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...typography.h3,
    fontWeight: '700',
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -14,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

export default AppTutorialOverlay;
