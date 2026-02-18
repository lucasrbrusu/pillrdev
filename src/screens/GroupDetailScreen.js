import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  PanResponder,
  TextInput,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card, Modal, Button, Input } from '../components';
import { useApp } from '../context/AppContext';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const parseNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};
const withAlpha = (hexColor, alpha = 0.15) => {
  if (!hexColor || typeof hexColor !== 'string') return `rgba(155,89,182,${alpha})`;
  const clean = hexColor.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  if (full.length !== 6) return `rgba(155,89,182,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
};
const shadeColor = (hexColor, amount = 0) => {
  const clean = (hexColor || '#9B59B6').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const base = full.length === 6 ? full : '9B59B6';
  const toChannel = (index) => {
    const raw = parseInt(base.slice(index, index + 2), 16);
    const next = Math.round(raw + amount * 255);
    return clamp(next, 0, 255);
  };
  const r = toChannel(0).toString(16).padStart(2, '0');
  const g = toChannel(2).toString(16).padStart(2, '0');
  const b = toChannel(4).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};
const getReadableTextColor = (hexColor) => {
  const clean = (hexColor || '#9B59B6').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const base = full.length === 6 ? full : '9B59B6';
  const toLinear = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = parseInt(base.slice(0, 2), 16);
  const g = parseInt(base.slice(2, 4), 16);
  const b = parseInt(base.slice(4, 6), 16);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.43 ? '#F8FAFC' : '#111827';
};
const parseColorToRgba = (value) => {
  if (!value || typeof value !== 'string') return null;
  const source = value.trim();
  if (!source) return null;

  const hex = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const clean = hex[1];
    const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = source.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1]
      .split(',')
      .map((part) => part.trim())
      .map((part) => Number(part));
    if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(part))) return null;
    return {
      r: clamp(Math.round(parts[0]), 0, 255),
      g: clamp(Math.round(parts[1]), 0, 255),
      b: clamp(Math.round(parts[2]), 0, 255),
      a: parts.length >= 4 && Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1,
    };
  }

  return null;
};
const toSolidColor = (value, backdrop = '#FFFFFF') => {
  const foreground = parseColorToRgba(value);
  if (!foreground) return null;
  const alpha = Number.isFinite(foreground.a) ? clamp(foreground.a, 0, 1) : 1;
  if (alpha >= 0.999) {
    return { r: foreground.r, g: foreground.g, b: foreground.b };
  }

  const backgroundSolid = toSolidColor(backdrop, '#FFFFFF') || { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(foreground.r * alpha + backgroundSolid.r * (1 - alpha)),
    g: Math.round(foreground.g * alpha + backgroundSolid.g * (1 - alpha)),
    b: Math.round(foreground.b * alpha + backgroundSolid.b * (1 - alpha)),
  };
};
const toRelativeLuminance = ({ r, g, b }) => {
  const toLinear = (value) => {
    const channel = clamp(value, 0, 255) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};
const getContrastRatio = (foreground, background) => {
  const l1 = toRelativeLuminance(foreground);
  const l2 = toRelativeLuminance(background);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
};
const resolveContrastColor = ({
  preferredColor,
  backgroundColor,
  fallbackColor,
  backgroundBaseColor = '#FFFFFF',
  minContrast = 2.5,
}) => {
  const preferred = toSolidColor(preferredColor, '#FFFFFF');
  const background =
    toSolidColor(backgroundColor, backgroundBaseColor) || toSolidColor(backgroundBaseColor, '#FFFFFF');
  const fallback = toSolidColor(fallbackColor, '#FFFFFF');
  if (!preferred || !background) return preferredColor;

  const preferredRatio = getContrastRatio(preferred, background);
  if (preferredRatio >= minContrast) return preferredColor;

  if (!fallback) return preferredColor;
  const fallbackRatio = getContrastRatio(fallback, background);
  return fallbackRatio > preferredRatio ? fallbackColor : preferredColor;
};
const toOpaqueColor = (value, backdrop = '#FFFFFF') => {
  const solid = toSolidColor(value, backdrop);
  if (!solid) return value;
  return `rgb(${solid.r},${solid.g},${solid.b})`;
};
const getGoalValue = (habit) => Math.max(1, parseNumber(habit?.goalValue, 1));
const getCompletionRatio = (habit, amount) => {
  const goal = getGoalValue(habit);
  return clamp(amount / goal, 0, 1);
};
const computeCurrentStreakFromIsoDates = (dateValues = []) => {
  if (!dateValues.length) return 0;
  const dateSet = new Set((dateValues || []).map((value) => String(value).slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const SwipeHabitCard = ({
  habit,
  progress,
  ratio,
  completed,
  completedMembers = [],
  isInteractive,
  onTap,
  onEdit,
  onSkip,
  onReset,
  onSwipeAdd,
  onSwipeInteractionChange,
  styles,
  palette,
}) => {
  const ACTION_RAIL_WIDTH = 228;
  const FILL_SWIPE_DISTANCE = 165;
  const { width: windowWidth } = useWindowDimensions();
  const rowWidth = Math.max(1, windowWidth - spacing.lg * 2);
  const translateX = useRef(new Animated.Value(0)).current;
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dragFillRatio, setDragFillRatio] = useState(0);
  const dragFillRatioRef = useRef(0);
  const progressRatioRef = useRef(clamp(ratio, 0, 1));
  const swipeStartRatioRef = useRef(clamp(ratio, 0, 1));
  const swipeActiveRef = useRef(false);
  const fillRafRef = useRef(null);
  const fillResetTimeoutRef = useRef(null);

  useEffect(() => {
    progressRatioRef.current = clamp(ratio, 0, 1);
  }, [ratio]);

  const getSwipeTargetRatio = useCallback(
    (dx, startRatio = progressRatioRef.current) => {
      const base = clamp(startRatio, 0, 1);
      if (dx <= 0) return base;

      const remaining = Math.max(0, 1 - base);
      if (remaining <= 0) return 1;

      const swipeProgress = clamp(dx / FILL_SWIPE_DISTANCE, 0, 1);
      const delta = swipeProgress * remaining;
      return clamp(base + delta, base, 1);
    },
    [FILL_SWIPE_DISTANCE]
  );

  const flushDragFillToState = useCallback(() => {
    if (fillRafRef.current !== null) {
      cancelAnimationFrame(fillRafRef.current);
      fillRafRef.current = null;
    }
    setDragFillRatio(dragFillRatioRef.current);
  }, []);

  const setDragFillPreview = useCallback(
    (next, { instant = false } = {}) => {
      if (fillResetTimeoutRef.current) {
        clearTimeout(fillResetTimeoutRef.current);
        fillResetTimeoutRef.current = null;
      }
      const clamped = clamp(next, 0, 1);
      const previous = dragFillRatioRef.current;
      if (!instant && Math.abs(clamped - previous) < 0.0015) return;
      dragFillRatioRef.current = clamped;

      if (instant) {
        flushDragFillToState();
        return;
      }

      if (fillRafRef.current !== null) return;
      fillRafRef.current = requestAnimationFrame(() => {
        fillRafRef.current = null;
        setDragFillRatio(dragFillRatioRef.current);
      });
    },
    [flushDragFillToState]
  );

  const clearDragFillPreview = useCallback(
    ({ deferMs = 0 } = {}) => {
      if (fillResetTimeoutRef.current) {
        clearTimeout(fillResetTimeoutRef.current);
        fillResetTimeoutRef.current = null;
      }

      const clearNow = () => {
        dragFillRatioRef.current = 0;
        flushDragFillToState();
      };

      if (deferMs > 0) {
        fillResetTimeoutRef.current = setTimeout(clearNow, deferMs);
        return;
      }

      clearNow();
    },
    [flushDragFillToState]
  );

  const setSwipeInteractionActive = useCallback(
    (active) => {
      if (swipeActiveRef.current === active) return;
      swipeActiveRef.current = active;
      if (typeof onSwipeInteractionChange === 'function') {
        onSwipeInteractionChange(active);
      }
    },
    [onSwipeInteractionChange]
  );

  useEffect(
    () => () => {
      if (fillResetTimeoutRef.current) {
        clearTimeout(fillResetTimeoutRef.current);
        fillResetTimeoutRef.current = null;
      }
      if (fillRafRef.current !== null) {
        cancelAnimationFrame(fillRafRef.current);
        fillRafRef.current = null;
      }
      setSwipeInteractionActive(false);
    },
    [setSwipeInteractionActive]
  );

  const closeActions = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 7,
    }).start(() => setActionsOpen(false));
  }, [translateX]);

  const openActions = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -ACTION_RAIL_WIDTH,
      useNativeDriver: true,
      speed: 22,
      bounciness: 7,
    }).start(() => setActionsOpen(true));
  }, [ACTION_RAIL_WIDTH, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          isInteractive && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 7,
        onPanResponderGrant: () => {
          if (!isInteractive) return;
          swipeStartRatioRef.current = progressRatioRef.current;
          setSwipeInteractionActive(true);
        },
        onPanResponderMove: (_, g) => {
          if (!isInteractive) return;

          if (actionsOpen) {
            clearDragFillPreview();
            if (g.dx >= 0) {
              translateX.setValue(clamp(-ACTION_RAIL_WIDTH + g.dx, -ACTION_RAIL_WIDTH, 0));
            } else {
              translateX.setValue(-ACTION_RAIL_WIDTH);
            }
            return;
          }

          if (g.dx < 0) {
            clearDragFillPreview();
            translateX.setValue(clamp(g.dx, -ACTION_RAIL_WIDTH, 0));
            return;
          }

          translateX.setValue(0);
          setDragFillPreview(getSwipeTargetRatio(g.dx, swipeStartRatioRef.current));
        },
        onPanResponderRelease: (_, g) => {
          setSwipeInteractionActive(false);
          if (!isInteractive) {
            clearDragFillPreview();
            closeActions();
            return;
          }

          if (actionsOpen) {
            clearDragFillPreview();
            const shouldClose = g.dx > 32 || g.vx > 0.35;
            if (shouldClose) {
              closeActions();
            } else {
              openActions();
            }
            return;
          }

          if (g.dx < 0) {
            clearDragFillPreview();
            const shouldOpen = g.dx < -42 || g.vx < -0.35;
            if (shouldOpen) {
              openActions();
            } else {
              closeActions();
            }
            return;
          }

          if (g.dx >= 12) {
            const targetRatio = Math.max(
              dragFillRatioRef.current,
              getSwipeTargetRatio(g.dx, swipeStartRatioRef.current)
            );
            const ratioDelta = targetRatio - swipeStartRatioRef.current;
            if (ratioDelta < 0.012) {
              clearDragFillPreview();
              closeActions();
              return;
            }
            setDragFillPreview(targetRatio, { instant: true });
            onSwipeAdd(habit, Math.max(1, Math.round(getGoalValue(habit) * targetRatio)));
            clearDragFillPreview({ deferMs: 120 });
            closeActions();
            return;
          }

          clearDragFillPreview();
          closeActions();
        },
        onPanResponderTerminate: () => {
          setSwipeInteractionActive(false);
          clearDragFillPreview();
          if (actionsOpen) {
            openActions();
          } else {
            closeActions();
          }
        },
      }),
    [
      ACTION_RAIL_WIDTH,
      actionsOpen,
      clearDragFillPreview,
      closeActions,
      dragFillRatioRef,
      getSwipeTargetRatio,
      habit,
      isInteractive,
      onSwipeAdd,
      setSwipeInteractionActive,
      openActions,
      ratio,
      setDragFillPreview,
      translateX,
    ]
  );

  const isAndroid = Platform.OS === 'android';
  const displayRatio = clamp(isAndroid ? ratio : Math.max(ratio, dragFillRatio), 0, 1);
  const visualFillRatio = completed ? 1 : displayRatio;
  const fillWidth = rowWidth * visualFillRatio;
  const habitColor = habit.color || palette.habits;
  const tintedTrack = withAlpha(habitColor, 0.16);
  const surfaceTone = shadeColor(habitColor, completed ? -0.16 : -0.24);
  const tintedSurface = withAlpha(surfaceTone, completed ? 0.58 : 0.52);
  const colorBackdrop = palette.background || palette.card || '#FFFFFF';
  const tintedTrackColor = isAndroid ? toOpaqueColor(tintedTrack, colorBackdrop) : tintedTrack;
  const tintedSurfaceColor = isAndroid
    ? toOpaqueColor(tintedSurface, colorBackdrop)
    : tintedSurface;
  const androidFillOverlayColor = isAndroid ? habitColor : null;
  const shouldRenderFillTrack = !isAndroid && visualFillRatio > 0.001;
  const habitTextColor = '#F8FAFC';
  const habitSubTextColor = withAlpha(habitTextColor, 0.82);
  const habitHintColor = withAlpha(habitTextColor, 0.72);
  const streakIconColor = resolveContrastColor({
    preferredColor: '#F97316',
    backgroundColor: tintedSurfaceColor,
    fallbackColor: habitTextColor === '#F8FAFC' ? '#F97316' : habitTextColor,
    backgroundBaseColor: tintedTrackColor,
  });

  return (
    <View style={styles.swipeRow}>
      <Animated.View
        style={[
          styles.swipeTrack,
          {
            width: rowWidth + ACTION_RAIL_WIDTH,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.habitWrapper, { width: rowWidth }]}>
          {shouldRenderFillTrack ? (
            <View pointerEvents="none" style={[styles.fillTrack, { backgroundColor: tintedTrackColor }]}>
              <View style={[styles.fillValue, { width: fillWidth, backgroundColor: habitColor }]} />
            </View>
          ) : null}
          <TouchableOpacity
            style={[
              styles.habitCard,
              {
                borderColor: habitColor,
                backgroundColor: tintedSurfaceColor,
                opacity: isInteractive ? 1 : 0.78,
              },
            ]}
            onPress={() => {
              if (actionsOpen) {
                closeActions();
                return;
              }
              onTap(habit);
            }}
            activeOpacity={0.9}
          >
            {isAndroid && visualFillRatio > 0.001 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.androidFillOverlay,
                  {
                    ...(visualFillRatio >= 0.999
                      ? { right: 0 }
                      : { width: `${visualFillRatio * 100}%` }),
                    backgroundColor: androidFillOverlayColor,
                    borderTopRightRadius: visualFillRatio >= 0.999 ? borderRadius.xl : 0,
                    borderBottomRightRadius: visualFillRatio >= 0.999 ? borderRadius.xl : 0,
                  },
                ]}
              />
            ) : null}
            <View style={styles.habitCardContent}>
              <View style={styles.habitRow}>
                <View style={[styles.habitAvatar, { backgroundColor: withAlpha(habitColor, 0.2) }]}>
                  <Text style={[styles.habitAvatarText, { color: habitTextColor }]}>
                    {habit.emoji || habit.title?.slice(0, 1)?.toUpperCase() || 'H'}
                  </Text>
                </View>
                <View style={styles.habitInfo}>
                  <Text style={[styles.habitTitle, { color: habitTextColor }]} numberOfLines={1}>
                    {habit.title}
                  </Text>
                  <View style={styles.habitMetaRow}>
                    <Text style={[styles.habitMeta, { color: habitSubTextColor }]}>
                      {Math.round(progress)} / {getGoalValue(habit)} {habit.goalUnit || 'times'}
                    </Text>
                    {completedMembers.length ? (
                      <View style={styles.completedMembersRow}>
                        {completedMembers.map((member, index) => (
                          <View
                            key={`${member?.id || 'member'}-${index}`}
                            style={[
                              styles.completedMemberAvatar,
                              index > 0 && styles.completedMemberAvatarOverlap,
                              {
                                backgroundColor: withAlpha(habitColor, 0.22),
                                borderColor: tintedSurface,
                              },
                            ]}
                          >
                            {member?.avatarUrl ? (
                              <Image
                                source={{ uri: member.avatarUrl }}
                                style={styles.completedMemberImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={[styles.completedMemberInitial, { color: habitTextColor }]}>
                                {(member?.name || member?.username || '?').slice(0, 1).toUpperCase()}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.progressMeta}>
                  <View style={styles.progressStreakRow}>
                    <Ionicons name="flame" size={14} color={streakIconColor} />
                    <Text style={[styles.progressMetaStreak, { color: habitTextColor }]}>
                      {habit.streak || 0} day streak
                    </Text>
                  </View>
                  <Text style={[styles.progressMetaPercent, { color: habitTextColor }]}>
                    {Math.round(ratio * 100)}%
                  </Text>
                </View>
              </View>
              <Text style={[styles.habitHint, { color: habitHintColor }]}>
                Swipe right to add progress - Swipe left for actions - Tap for exact amount
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={[styles.actionRailInline, { width: ACTION_RAIL_WIDTH }]}>
          <TouchableOpacity
            style={[styles.actionTile, styles.actionTileEdit]}
            onPress={() => {
              closeActions();
              onEdit(habit);
            }}
          >
            <Feather name="edit-2" size={17} color="#2D6BFF" />
            <Text style={[styles.actionText, { color: '#2D6BFF' }]}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionTile, styles.actionTileSkip]}
            onPress={() => {
              closeActions();
              onSkip(habit);
            }}
          >
            <Ionicons name="play-skip-forward" size={17} color="#FF8A1F" />
            <Text style={[styles.actionText, { color: '#FF8A1F' }]}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionTile, styles.actionTileReset]}
            onPress={() => {
              closeActions();
              onReset(habit);
            }}
          >
            <Ionicons name="refresh" size={17} color="#16A34A" />
            <Text style={[styles.actionText, { color: '#16A34A' }]}>Reset</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const GroupDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params || {};

  const {
    habits,
    groups,
    groupHabits,
    groupHabitCompletions,
    groupRoutines,
    fetchGroupMembers,
    toggleGroupHabitCompletion,
    addTaskToGroupRoutine,
    removeTaskFromGroupRoutine,
    reorderGroupRoutineTasks,
    deleteGroupRoutine,
    deleteGroup,
    themeColors,
    authUser,
    friends,
    sendGroupInvites,
    isPremiumUser,
    ensureGroupDataLoaded,
    ensureFriendDataLoaded,
    themeName,
  } = useApp();
  const isDark = themeName === 'dark';

  const [members, setMembers] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [selectedRoutineId, setSelectedRoutineId] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isHabitSwipeActive, setIsHabitSwipeActive] = useState(false);
  const [groupLocalProgressMap, setGroupLocalProgressMap] = useState({});
  const [activeHabitId, setActiveHabitId] = useState(null);
  const [showHabitManualModal, setShowHabitManualModal] = useState(false);
  const [habitManualAmount, setHabitManualAmount] = useState('');
  const [habitManualAutoComplete, setHabitManualAutoComplete] = useState(false);

  const themedStyles = useMemo(() => createStyles(themeColors || colors, isDark), [themeColors, isDark]);
  const habitPalette = useMemo(
    () => ({
      habits: themeColors?.habits || themeColors?.primary || colors.habits,
      card: themeColors?.card || colors.card,
      cardBorder: themeColors?.border || colors.border,
      text: themeColors?.text || colors.text,
      textMuted: themeColors?.textSecondary || colors.textSecondary,
      textLight: themeColors?.textLight || colors.textLight,
      mutedSurface: themeColors?.inputBackground || colors.inputBackground,
      background: themeColors?.background || colors.background,
    }),
    [themeColors]
  );

  const group = groups.find((g) => g.id === groupId);
  const isAdmin = group?.ownerId === authUser?.id;
  const groupHabitsForGroup = useMemo(
    () => (groupHabits || []).filter((habit) => habit.groupId === groupId),
    [groupHabits, groupId]
  );
  const groupRoutinesForGroup = useMemo(
    () => (groupRoutines || []).filter((routine) => routine.groupId === groupId),
    [groupRoutines, groupId]
  );
  const memberList = useMemo(
    () => (members.length ? members : group?.members || []),
    [members, group?.members]
  );
  const membersById = useMemo(
    () =>
      (memberList || []).reduce((acc, member) => {
        if (member?.id) acc[member.id] = member;
        return acc;
      }, {}),
    [memberList]
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const memberCount = memberList.length;

  const allGroupCompletions = useMemo(
    () =>
      groupHabitsForGroup.flatMap((habit) => groupHabitCompletions[habit.id] || []),
    [groupHabitsForGroup, groupHabitCompletions]
  );
  const todayCompletions = useMemo(
    () => allGroupCompletions.filter((completion) => completion.date === todayKey),
    [allGroupCompletions, todayKey]
  );
  const completionPercent = useMemo(() => {
    if (!memberCount || !groupHabitsForGroup.length) return 0;
    const totalPossible = memberCount * groupHabitsForGroup.length;
    return Math.min(100, Math.round((todayCompletions.length / totalPossible) * 100));
  }, [memberCount, groupHabitsForGroup.length, todayCompletions.length]);
  const activeToday = useMemo(() => {
    const unique = new Set(todayCompletions.map((completion) => completion.userId));
    return unique.size;
  }, [todayCompletions]);
  const activityStreak = useMemo(() => {
    if (!allGroupCompletions.length) return 0;
    const dateSet = new Set(allGroupCompletions.map((completion) => completion.date));
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (!dateSet.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [allGroupCompletions]);
  const memberLeaderboard = useMemo(() => {
    const counts = new Map();
    todayCompletions.forEach((completion) => {
      counts.set(completion.userId, (counts.get(completion.userId) || 0) + 1);
    });
    return [...memberList]
      .map((member) => ({ ...member, todayCount: counts.get(member.id) || 0 }))
      .sort((a, b) => b.todayCount - a.todayCount);
  }, [memberList, todayCompletions]);
  const sourceHabitsById = useMemo(
    () =>
      (habits || []).reduce((acc, habit) => {
        if (habit?.id) acc[habit.id] = habit;
        return acc;
      }, {}),
    [habits]
  );
  const groupHabitsWithDefaults = useMemo(
    () =>
      (groupHabitsForGroup || []).map((habit) => {
        const sourceHabit = habit?.sourceHabitId ? sourceHabitsById[habit.sourceHabitId] : null;
        const completions = groupHabitCompletions[habit.id] || [];
        const myCompletionDays = completions
          .filter((completion) => completion.userId === authUser?.id)
          .map((completion) => String(completion.date).slice(0, 10));
        const goalValue = Math.max(1, parseNumber(habit.goalValue, parseNumber(sourceHabit?.goalValue, 1)));
        return {
          ...habit,
          habitType: habit.habitType || sourceHabit?.habitType || 'build',
          goalValue,
          goalUnit: habit.goalUnit || sourceHabit?.goalUnit || 'times',
          goalPeriod: habit.goalPeriod || sourceHabit?.goalPeriod || 'day',
          timeRange: habit.timeRange || sourceHabit?.timeRange || 'all_day',
          taskDaysMode: habit.taskDaysMode || sourceHabit?.taskDaysMode || 'every_day',
          taskDaysCount: parseNumber(habit.taskDaysCount, parseNumber(sourceHabit?.taskDaysCount, 3)),
          monthDays:
            Array.isArray(habit.monthDays) && habit.monthDays.length
              ? habit.monthDays
              : Array.isArray(sourceHabit?.monthDays)
              ? sourceHabit.monthDays
              : [],
          remindersEnabled: habit.remindersEnabled ?? sourceHabit?.remindersEnabled ?? false,
          reminderTimes:
            Array.isArray(habit.reminderTimes) && habit.reminderTimes.length
              ? habit.reminderTimes
              : Array.isArray(sourceHabit?.reminderTimes)
              ? sourceHabit.reminderTimes
              : [],
          reminderMessage: habit.reminderMessage || sourceHabit?.reminderMessage || '',
          showMemoAfterCompletion:
            habit.showMemoAfterCompletion ?? sourceHabit?.showMemoAfterCompletion ?? false,
          chartType: habit.chartType || sourceHabit?.chartType || 'bar',
          startDate: habit.startDate || sourceHabit?.startDate || null,
          endDate: habit.endDate || sourceHabit?.endDate || null,
          color: habit.color || sourceHabit?.color || habitPalette.habits,
          emoji: habit.emoji || sourceHabit?.emoji || '',
          streak: computeCurrentStreakFromIsoDates(myCompletionDays),
        };
      }),
    [groupHabitsForGroup, groupHabitCompletions, authUser?.id, habitPalette.habits, sourceHabitsById]
  );
  const completedMembersByHabit = useMemo(() => {
    const map = {};
    (groupHabitsWithDefaults || []).forEach((habit) => {
      const seen = new Set();
      map[habit.id] = (groupHabitCompletions[habit.id] || [])
        .filter((completion) => completion.date === todayKey)
        .map((completion) => {
          const userId = completion?.userId;
          if (!userId || seen.has(userId)) return null;
          seen.add(userId);
          return membersById[userId] || { id: userId, name: 'Member', avatarUrl: null };
        })
        .filter(Boolean);
    });
    return map;
  }, [groupHabitsWithDefaults, groupHabitCompletions, membersById, todayKey]);
  const selectedHabit = useMemo(
    () => groupHabitsWithDefaults.find((habit) => habit.id === activeHabitId) || null,
    [activeHabitId, groupHabitsWithDefaults]
  );
  const selectedHabitColor = selectedHabit?.color || habitPalette.habits;
  const selectedHabitProgress = selectedHabit
    ? groupLocalProgressMap[selectedHabit.id] ??
      (() => {
        const row = (groupHabitCompletions[selectedHabit.id] || []).find(
          (completion) => completion.userId === authUser?.id && completion.date === todayKey
        );
        if (!row) return 0;
        const rawAmount = Number(row.amount);
        return Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 1;
      })()
    : 0;

  useEffect(() => {
    ensureGroupDataLoaded();
    ensureFriendDataLoaded();
  }, [ensureFriendDataLoaded, ensureGroupDataLoaded]);

  useEffect(() => {
    if (groupId) {
      fetchGroupMembers(groupId).then((res) => setMembers(res || []));
    }
  }, [groupId, fetchGroupMembers]);

  const handleAddTask = async () => {
    if (!taskName.trim() || !selectedRoutineId) return;
    await addTaskToGroupRoutine(selectedRoutineId, { name: taskName.trim() });
    setTaskName('');
    setSelectedRoutineId(null);
    setShowTaskModal(false);
  };

  const handleDeleteGroup = () => {
    if (!groupId) return;
    Alert.alert(
      'Delete group?',
      'This will remove the group for all members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingGroup(true);
            try {
              await deleteGroup(groupId);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Unable to delete group', err?.message || 'Please try again.');
            } finally {
              setDeletingGroup(false);
            }
          },
        },
      ]
    );
  };


  const openInviteModal = () => {
    if (!isPremiumUser) {
      navigation.navigate('Paywall', { source: 'groups' });
      return;
    }
    setShowInviteModal(true);
  };
  const openGroupHabitCreator = useCallback(() => {
    if (!groupId) return;
    navigation.navigate('Main', {
      screen: 'Habits',
      params: {
        openHabitForm: true,
        openHabitFormKey: `${groupId}-${Date.now()}`,
        groupId,
        hideSharing: true,
        lockGroupSelection: true,
      },
    });
  }, [navigation, groupId]);
  const openGroupRoutineCreator = useCallback(() => {
    if (!groupId) return;
    navigation.navigate('Main', {
      screen: 'Routine',
      params: {
        openRoutineForm: true,
        openRoutineFormKey: `${groupId}-${Date.now()}`,
        routineCreateType: 'group',
        groupId,
      },
    });
  }, [navigation, groupId]);

  const handleToggleInvitee = (userId) => {
    setSelectedInvitees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSendInvites = async () => {
    if (!selectedInvitees.length) {
      setShowInviteModal(false);
      return;
    }
    setSendingInvites(true);
    try {
      await sendGroupInvites({ groupId, userIds: selectedInvitees });
      setSelectedInvitees([]);
      setShowInviteModal(false);
    } catch (err) {
      Alert.alert('Unable to send invites', err?.message || 'Please try again.');
    } finally {
      setSendingInvites(false);
    }
  };

  const getGroupHabitProgressAmount = useCallback(
    (habit, localMap = groupLocalProgressMap) => {
      if (!habit?.id) return 0;
      if (Object.prototype.hasOwnProperty.call(localMap, habit.id)) {
        return parseNumber(localMap[habit.id], 0);
      }
      const mineRow = (groupHabitCompletions[habit.id] || []).find(
        (completion) => completion.userId === authUser?.id && completion.date === todayKey
      );
      if (!mineRow) return 0;
      const rawAmount = Number(mineRow.amount);
      return Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 1;
    },
    [groupHabitCompletions, groupLocalProgressMap, authUser?.id, todayKey]
  );

  const applyGroupHabitProgress = useCallback(
    async (habit, amountValue) => {
      if (!habit?.id) return;
      const amount = Math.max(0, parseNumber(amountValue, 0));
      setGroupLocalProgressMap((prev) => ({ ...prev, [habit.id]: amount }));
      await toggleGroupHabitCompletion(habit.id, {
        amount,
        dateISO: todayKey,
      });
    },
    [toggleGroupHabitCompletion, todayKey]
  );

  const submitHabitManualAmount = async () => {
    if (!selectedHabit) {
      setShowHabitManualModal(false);
      setHabitManualAutoComplete(false);
      return;
    }
    const amountToApply = habitManualAutoComplete ? getGoalValue(selectedHabit) : habitManualAmount;
    await applyGroupHabitProgress(selectedHabit, amountToApply);
    setShowHabitManualModal(false);
    setHabitManualAutoComplete(false);
  };

  const renderRoutine = (routine) => (
    <TouchableOpacity
      key={routine.id}
      style={themedStyles.routineCard}
      activeOpacity={0.92}
      onPress={() => navigation.navigate('RoutineDetail', { routineId: routine.id, isGroup: true })}
    >
      <View style={themedStyles.routineHeader}>
        <View style={themedStyles.routineTitleWrap}>
          <View style={themedStyles.routineIcon}>
            <Ionicons name="sparkles-outline" size={18} color={themedStyles.routineIconColor} />
          </View>
          <View>
            <Text style={themedStyles.routineTitle}>{routine.name}</Text>
            <Text style={themedStyles.routineMeta}>
              {(routine.tasks || []).length} tasks
            </Text>
          </View>
        </View>
        <View style={themedStyles.routineActions}>
          <TouchableOpacity
            style={themedStyles.routineActionButton}
            onPress={() => {
              setSelectedRoutineId(routine.id);
              setTaskName('');
              setShowTaskModal(true);
            }}
          >
            <Ionicons name="add" size={18} color={themedStyles.subduedText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.routineActionButton}
            onPress={() =>
              Alert.alert('Delete routine?', 'Remove this routine for the group?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteGroupRoutine(routine.id),
                },
              ])
            }
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
      {(routine.tasks || []).length === 0 ? (
        <Text style={themedStyles.habitMeta}>No tasks yet.</Text>
      ) : (
        routine.tasks.map((task, index) => {
          const atTop = index === 0;
          const atBottom = index === (routine.tasks || []).length - 1;
          return (
            <View key={task.id} style={themedStyles.taskRow}>
              <View style={themedStyles.taskOrderControls}>
                <TouchableOpacity
                  onPress={() =>
                    reorderGroupRoutineTasks(routine.id, [
                      ...routine.tasks.slice(0, index - 1),
                      routine.tasks[index],
                      routine.tasks[index - 1],
                      ...routine.tasks.slice(index + 1),
                    ])
                  }
                  disabled={atTop}
                >
                  <Ionicons
                    name="chevron-up"
                    size={16}
                    color={atTop ? colors.border : themedStyles.subduedText}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    reorderGroupRoutineTasks(routine.id, [
                      ...routine.tasks.slice(0, index),
                      routine.tasks[index + 1],
                      routine.tasks[index],
                      ...routine.tasks.slice(index + 2),
                    ])
                  }
                  disabled={atBottom}
                >
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={atBottom ? colors.border : themedStyles.subduedText}
                  />
                </TouchableOpacity>
              </View>
              <Text style={themedStyles.taskText}>{task.name}</Text>
              <TouchableOpacity onPress={() => removeTaskFromGroupRoutine(routine.id, task.id)}>
                <Ionicons name="close" size={18} color={themedStyles.subduedText} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </TouchableOpacity>
  );

  const quickActions = [
    {
      key: 'add-habit',
      label: 'Add Habit',
      icon: 'flame-outline',
      background: isDark ? '#26344A' : '#E8F1FF',
      onPress: openGroupHabitCreator,
    },
    {
      key: 'add-routine',
      label: 'Add Routine',
      icon: 'sparkles-outline',
      background: isDark ? '#332C46' : '#F3E8FF',
      onPress: openGroupRoutineCreator,
    },
    {
      key: 'invite',
      label: 'Invite Friends',
      icon: 'person-add-outline',
      background: isDark ? '#243A32' : '#E7FAEE',
      onPress: openInviteModal,
    },
    {
      key: 'stats',
      label: 'View Stats',
      icon: 'analytics-outline',
      background: isDark ? '#3B2F25' : '#FFF2E1',
      onPress: () => navigation.navigate('Insights'),
    },
  ];

  if (!group) {
    return (
      <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
        <View style={themedStyles.header}>
          <TouchableOpacity style={themedStyles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
          </TouchableOpacity>
          <Text style={themedStyles.title}>Group</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={themedStyles.centered}>
          <Text style={themedStyles.emptyText}>Group not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={themedStyles.container}>
      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={activeTab !== 'habits' || !isHabitSwipeActive}
      >
        <View style={[themedStyles.hero, { paddingTop: insets.top || spacing.lg }]}>
          <View style={themedStyles.heroTopRow}>
            <TouchableOpacity style={themedStyles.heroIconButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={22} color={themedStyles.heroIconColor} />
            </TouchableOpacity>
            <View style={themedStyles.heroActions}>
              <TouchableOpacity
                style={themedStyles.heroIconButton}
                onPress={() => navigation.navigate('GroupDetails', { groupId })}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={themedStyles.heroIconColor} />
              </TouchableOpacity>
              {group?.ownerId === authUser?.id ? (
                <TouchableOpacity
                  style={themedStyles.heroIconButton}
                  onPress={handleDeleteGroup}
                  disabled={deletingGroup}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={deletingGroup ? colors.border : themedStyles.heroIconColor}
                  />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={themedStyles.heroIconButton}
                onPress={openGroupHabitCreator}
              >
                <Ionicons name="add" size={22} color={themedStyles.heroIconColor} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={themedStyles.heroContent}>
            <View style={themedStyles.heroBadge}>
              <Ionicons name="people-outline" size={22} color={themedStyles.heroBadgeIcon} />
            </View>
            <View>
              <Text style={themedStyles.heroTitle}>{group.name}</Text>
              <Text style={themedStyles.heroMeta}>{memberCount} members</Text>
            </View>
          </View>
        </View>

        <Card style={themedStyles.progressCard}>
          <View style={themedStyles.progressHeader}>
            <View style={themedStyles.progressTitleWrap}>
              <Ionicons name="flame" size={16} color={themedStyles.progressIcon} />
              <Text style={themedStyles.progressTitle}>Group Progress</Text>
            </View>
          </View>
          <View style={themedStyles.statsGrid}>
            <View style={[themedStyles.statTile, themedStyles.statWarm]}>
              <Text style={themedStyles.statValue}>{activityStreak}</Text>
              <Text style={themedStyles.statLabel}>Day Streak</Text>
            </View>
            <View style={[themedStyles.statTile, themedStyles.statMint]}>
              <Text style={themedStyles.statValue}>{completionPercent}%</Text>
              <Text style={themedStyles.statLabel}>Completion</Text>
            </View>
            <View style={[themedStyles.statTile, themedStyles.statSky]}>
              <Text style={themedStyles.statValue}>{groupHabitsForGroup.length}</Text>
              <Text style={themedStyles.statLabel}>Shared Habits</Text>
            </View>
            <View style={[themedStyles.statTile, themedStyles.statLilac]}>
              <Text style={themedStyles.statValue}>{activeToday}</Text>
              <Text style={themedStyles.statLabel}>Active Today</Text>
            </View>
          </View>
        </Card>

        <View style={themedStyles.segmentWrap}>
          {['overview', 'habits', 'routines'].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[themedStyles.segmentButton, isActive && themedStyles.segmentButtonActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[themedStyles.segmentText, isActive && themedStyles.segmentTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'overview' ? (
          <View>
            <Card style={themedStyles.sectionCard}>
              <View style={themedStyles.sectionHeader}>
                <Text style={themedStyles.sectionTitle}>Members Leaderboard</Text>
                {isAdmin ? (
                  <TouchableOpacity style={themedStyles.iconButton} onPress={openInviteModal}>
                    <Ionicons name="add" size={18} color={themedStyles.iconColor} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {memberLeaderboard.length === 0 ? (
                <Text style={themedStyles.emptyText}>No members loaded.</Text>
              ) : (
                memberLeaderboard.map((member, index) => {
                  const totalHabits = groupHabitsForGroup.length || 0;
                  const progressLabel = totalHabits
                    ? `${member.todayCount}/${totalHabits} today`
                    : 'No habits yet';
                  const isTop = index < 3;
                  const rankColors = ['#F59E0B', '#9CA3AF', '#D97706'];
                  return (
                    <View key={member.id} style={themedStyles.leaderRow}>
                      <View style={themedStyles.rankBadge}>
                        {isTop ? (
                          <Ionicons
                            name="trophy"
                            size={14}
                            color={rankColors[index] || themeColors?.primary || colors.primary}
                          />
                        ) : (
                          <Text style={themedStyles.rankText}>#{index + 1}</Text>
                        )}
                      </View>
                      <View style={themedStyles.leaderAvatar}>
                        <Text style={themedStyles.leaderAvatarText}>
                          {(member.name || member.username || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={themedStyles.leaderText}>
                        <View style={themedStyles.memberNameRow}>
                          <Text style={themedStyles.memberName}>{member.name || 'Member'}</Text>
                          {member.id === group?.ownerId ? (
                            <View style={themedStyles.adminBadge}>
                              <Text style={themedStyles.adminBadgeText}>Admin</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={themedStyles.memberMeta}>
                          {member.username ? `@${member.username}` : 'No username'}
                        </Text>
                      </View>
                      <View style={themedStyles.leaderStats}>
                        <View style={themedStyles.leaderScore}>
                          <Ionicons name="flame" size={14} color={themedStyles.progressIcon} />
                          <Text style={themedStyles.leaderScoreText}>{member.todayCount}</Text>
                        </View>
                        <Text style={themedStyles.leaderMeta}>{progressLabel}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </Card>

            <Card style={themedStyles.sectionCard}>
              <View style={themedStyles.sectionHeader}>
                <Text style={themedStyles.sectionTitle}>Quick Actions</Text>
              </View>
              <View style={themedStyles.quickActionsGrid}>
                {quickActions.map((action) => (
                  <TouchableOpacity
                    key={action.key}
                    style={[themedStyles.quickActionCard, { backgroundColor: action.background }]}
                    onPress={action.onPress}
                    activeOpacity={0.8}
                  >
                    <View style={themedStyles.quickActionIcon}>
                      <Ionicons name={action.icon} size={18} color={themedStyles.quickActionIconColor} />
                    </View>
                    <Text style={themedStyles.quickActionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {activeTab === 'habits' ? (
          <View style={themedStyles.sectionBlock}>
            <View style={themedStyles.sectionHeader}>
              <Text style={themedStyles.sectionTitle}>Group habits</Text>
              <TouchableOpacity style={themedStyles.iconButton} onPress={openGroupHabitCreator}>
                <Ionicons name="add" size={18} color={themedStyles.iconColor} />
              </TouchableOpacity>
            </View>
            {groupHabitsWithDefaults.length === 0 ? (
              <Text style={themedStyles.emptyText}>No group habits yet.</Text>
            ) : (
              groupHabitsWithDefaults.map((habit) => {
                const amount = getGroupHabitProgressAmount(habit);
                const ratio = getCompletionRatio(habit, amount);
                const completed = amount >= getGoalValue(habit);
                return (
                  <SwipeHabitCard
                    key={habit.id}
                    habit={habit}
                    progress={amount}
                    ratio={ratio}
                    completed={completed}
                    completedMembers={completedMembersByHabit[habit.id] || []}
                    isInteractive
                    onTap={(item) => {
                      setActiveHabitId(item.id);
                      setHabitManualAmount(String(Math.round(getGroupHabitProgressAmount(item))));
                      setHabitManualAutoComplete(false);
                      setShowHabitManualModal(true);
                    }}
                    onEdit={(item) => {
                      navigation.navigate('Main', {
                        screen: 'Habits',
                        params: {
                          openGroupHabitDetail: true,
                          openGroupHabitDetailKey: `${groupId}:${item.id}:${Date.now()}`,
                          groupId,
                          groupHabitId: item.id,
                        },
                      });
                    }}
                    onSkip={async (item) => {
                      await applyGroupHabitProgress(item, 0);
                    }}
                    onReset={async (item) => {
                      await applyGroupHabitProgress(item, 0);
                    }}
                    onSwipeAdd={applyGroupHabitProgress}
                    onSwipeInteractionChange={setIsHabitSwipeActive}
                    styles={themedStyles}
                    palette={habitPalette}
                  />
                );
              })
            )}
          </View>
        ) : null}

        {activeTab === 'routines' ? (
          <View style={themedStyles.sectionBlock}>
            <View style={themedStyles.sectionHeader}>
              <Text style={themedStyles.sectionTitle}>Group routines</Text>
              <TouchableOpacity style={themedStyles.iconButton} onPress={openGroupRoutineCreator}>
                <Ionicons name="add" size={18} color={themedStyles.iconColor} />
              </TouchableOpacity>
            </View>
            {groupRoutinesForGroup.length === 0 ? (
              <Text style={themedStyles.emptyText}>No group routines yet.</Text>
            ) : (
              groupRoutinesForGroup.map((routine) => renderRoutine(routine))
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={showHabitManualModal}
        onClose={() => {
          setShowHabitManualModal(false);
          setHabitManualAutoComplete(false);
        }}
        hideHeader
      >
        {selectedHabit ? (
          <View
            style={[
              themedStyles.manualCard,
              {
                backgroundColor: habitPalette.card,
                borderColor: habitPalette.cardBorder,
              },
            ]}
          >
            <Text style={[themedStyles.manualTitle, { color: habitPalette.text }]}>{selectedHabit.title}</Text>
            <Text style={[themedStyles.manualSub, { color: habitPalette.textMuted }]}>Add progress manually</Text>
            <TextInput
              style={[
                themedStyles.manualInput,
                {
                  borderColor: habitPalette.cardBorder,
                  color: habitPalette.text,
                  backgroundColor: habitPalette.mutedSurface,
                },
              ]}
              value={habitManualAmount}
              onChangeText={setHabitManualAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={habitPalette.textLight}
            />
            <Text style={[themedStyles.manualGoal, { color: habitPalette.textMuted }]}>
              Goal: {getGoalValue(selectedHabit)} {selectedHabit.goalUnit || 'times'}
            </Text>
            <View style={themedStyles.manualButtons}>
              <TouchableOpacity
                style={[themedStyles.manualBtn, { backgroundColor: habitPalette.mutedSurface }]}
                onPress={() => {
                  setShowHabitManualModal(false);
                  setHabitManualAutoComplete(false);
                }}
              >
                <Text style={[themedStyles.manualBtnText, { color: habitPalette.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  themedStyles.manualCheckButton,
                  {
                    backgroundColor: habitManualAutoComplete ? '#16A34A' : habitPalette.mutedSurface,
                    borderColor: habitManualAutoComplete ? '#16A34A' : habitPalette.cardBorder,
                  },
                ]}
                onPress={() => {
                  const next = !habitManualAutoComplete;
                  setHabitManualAutoComplete(next);
                  if (next) {
                    setHabitManualAmount(String(getGoalValue(selectedHabit)));
                  }
                }}
                activeOpacity={0.9}
              >
                <Ionicons
                  name={habitManualAutoComplete ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={habitManualAutoComplete ? '#FFFFFF' : '#16A34A'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[themedStyles.manualBtn, { backgroundColor: selectedHabitColor }]}
                onPress={submitHabitManualAmount}
              >
                <Text style={themedStyles.manualBtnTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskName('');
          setSelectedRoutineId(null);
        }}
        title="Add task to routine"
        fullScreen={false}
      >
        <Input
          label="Task name"
          value={taskName}
          onChangeText={setTaskName}
          placeholder="e.g., Share wins"
        />
        <View style={themedStyles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowTaskModal(false);
              setTaskName('');
              setSelectedRoutineId(null);
            }}
            style={themedStyles.modalButton}
          />
          <Button
            title="Add"
            onPress={handleAddTask}
            disabled={!taskName.trim() || !selectedRoutineId}
            style={themedStyles.modalButton}
          />
        </View>
      </Modal>

      <Modal
        visible={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setSelectedInvitees([]);
        }}
        title="Invite members"
        fullScreen={false}
      >
        {friends.length === 0 ? (
          <Text style={themedStyles.emptyText}>No friends to invite yet.</Text>
        ) : (
          friends
            .filter((f) => !memberList.some((m) => m.id === f.id))
            .map((friend) => {
              const selected = selectedInvitees.includes(friend.id);
              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[
                    themedStyles.friendRow,
                    selected && { borderColor: themeColors?.primary || colors.primary },
                  ]}
                  onPress={() => handleToggleInvitee(friend.id)}
                >
                  <Text style={themedStyles.friendName}>{friend.name || friend.username || 'Friend'}</Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={18} color={themedStyles.subduedText} />
                  )}
                </TouchableOpacity>
              );
            })
        )}
        <View style={themedStyles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowInviteModal(false);
              setSelectedInvitees([]);
            }}
            style={themedStyles.modalButton}
          />
          <Button
            title={sendingInvites ? 'Sending...' : 'Send Invites'}
            onPress={handleSendInvites}
            disabled={sendingInvites || selectedInvitees.length === 0}
            style={themedStyles.modalButton}
          />
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColorsParam = colors, isDark = false) => {
  const baseText = themeColorsParam?.text || colors.text;
  const subdued = themeColorsParam?.textSecondary || colors.textSecondary;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColorsParam?.background || colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    iconColor: baseText,
    title: {
      ...typography.h3,
      color: baseText,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    hero: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
      paddingBottom: spacing.xxxl,
      borderBottomLeftRadius: borderRadius.xxl,
      borderBottomRightRadius: borderRadius.xxl,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    heroActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    heroIconButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.3)',
    },
    heroIconColor: '#FFFFFF',
    heroContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    heroBadge: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.22)',
    },
    heroBadgeIcon: '#FFFFFF',
    heroTitle: {
      ...typography.h2,
      color: '#FFFFFF',
    },
    heroMeta: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 4,
    },
    progressCard: {
      marginTop: -spacing.xxl,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    progressHeader: {
      marginBottom: spacing.md,
    },
    progressTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressTitle: {
      ...typography.label,
      color: baseText,
    },
    progressIcon: themeColorsParam?.primary || colors.primary,
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statTile: {
      flexBasis: '48%',
      flexGrow: 1,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: baseText,
    },
    statLabel: {
      ...typography.caption,
      color: subdued,
      marginTop: 4,
    },
    statWarm: {
      backgroundColor: isDark ? '#392F2A' : '#FCEFE2',
    },
    statMint: {
      backgroundColor: isDark ? '#25372F' : '#E7FAEE',
    },
    statSky: {
      backgroundColor: isDark ? '#253347' : '#E8F1FF',
    },
    statLilac: {
      backgroundColor: isDark ? '#332E43' : '#F2E9FF',
    },
    segmentWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColorsParam?.card || colors.card,
      borderRadius: borderRadius.full,
      padding: spacing.xs,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentButtonActive: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
    },
    segmentText: {
      ...typography.bodySmall,
      color: subdued,
      fontWeight: '600',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
    sectionCard: {
      marginBottom: spacing.md,
      marginHorizontal: spacing.lg,
    },
    sectionBlock: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      ...typography.h3,
      color: baseText,
    },
    sectionMeta: {
      ...typography.caption,
      color: subdued,
    },
    iconButton: {
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    emptyText: {
      ...typography.body,
      color: subdued,
    },
    memberName: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    memberMeta: {
      ...typography.bodySmall,
      color: subdued,
    },
    adminBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.primaryLight || colors.primaryLight,
    },
    adminBadgeText: {
      ...typography.caption,
      color: baseText,
      fontWeight: '700',
    },
    leaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.divider || colors.divider,
    },
    rankBadge: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      marginRight: spacing.sm,
    },
    rankText: {
      ...typography.caption,
      color: subdued,
      fontWeight: '700',
    },
    leaderAvatar: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.primaryLight || colors.primaryLight,
      marginRight: spacing.md,
    },
    leaderAvatarText: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '700',
    },
    leaderText: {
      flex: 1,
    },
    leaderStats: {
      alignItems: 'flex-end',
    },
    leaderScore: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    leaderScoreText: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '700',
    },
    leaderMeta: {
      ...typography.caption,
      color: subdued,
      marginTop: 2,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    quickActionCard: {
      flexBasis: '48%',
      flexGrow: 1,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    quickActionIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    quickActionIconColor: themeColorsParam?.primary || colors.primary,
    quickActionLabel: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '600',
      textAlign: 'center',
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    friendName: {
      ...typography.body,
      color: baseText,
    },
    swipeRow: { minHeight: 122, marginBottom: spacing.md, justifyContent: 'center', overflow: 'hidden' },
    swipeTrack: { flexDirection: 'row', alignItems: 'center' },
    actionRailInline: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.sm },
    actionTile: {
      width: 64,
      height: 86,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    actionTileEdit: {
      backgroundColor: isDark ? '#22344A' : '#EAF1FF',
      borderColor: isDark ? '#36557A' : '#D7E5FF',
    },
    actionTileSkip: {
      backgroundColor: isDark ? '#3B3127' : '#FFF3E7',
      borderColor: isDark ? '#5B4935' : '#FFE2C9',
    },
    actionTileReset: {
      backgroundColor: isDark ? '#233830' : '#E9F8F3',
      borderColor: isDark ? '#346150' : '#CDEFE2',
    },
    actionText: { ...typography.caption, fontWeight: '700', marginTop: spacing.xs },
    habitWrapper: {
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      position: 'relative',
      ...shadows.small,
    },
    fillTrack: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      zIndex: 0,
    },
    fillValue: { height: '100%' },
    habitCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.md,
      minHeight: 110,
      backgroundColor: themeColorsParam?.card || colors.card,
      position: 'relative',
      zIndex: 1,
      overflow: 'hidden',
    },
    androidFillOverlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 0,
    },
    habitCardContent: {
      position: 'relative',
      zIndex: 1,
    },
    habitRow: { flexDirection: 'row', alignItems: 'center' },
    habitAvatar: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    habitAvatarText: { ...typography.h3, fontWeight: '700' },
    habitInfo: { flex: 1, marginRight: spacing.md },
    habitTitle: { ...typography.h3, fontWeight: '700', marginBottom: spacing.xs },
    habitMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    habitMeta: { ...typography.caption, fontWeight: '600' },
    completedMembersRow: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm },
    completedMemberAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    completedMemberAvatarOverlap: { marginLeft: -6 },
    completedMemberImage: { width: '100%', height: '100%' },
    completedMemberInitial: { ...typography.caption, fontSize: 9, fontWeight: '700' },
    progressMeta: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 104 },
    progressStreakRow: { flexDirection: 'row', alignItems: 'center' },
    progressMetaStreak: { ...typography.bodySmall, fontWeight: '800', marginLeft: 4 },
    progressMetaPercent: { ...typography.bodySmall, fontWeight: '800', marginTop: 8 },
    habitHint: { ...typography.caption, marginTop: spacing.sm, textAlign: 'center' },
    manualCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg },
    manualTitle: { ...typography.h3, fontWeight: '700' },
    manualSub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.sm },
    manualInput: {
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      ...typography.body,
    },
    manualGoal: { ...typography.caption, marginTop: spacing.sm },
    manualButtons: { flexDirection: 'row', marginTop: spacing.lg },
    manualBtn: {
      flex: 1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginHorizontal: spacing.xs,
    },
    manualBtnText: { ...typography.bodySmall, fontWeight: '700' },
    manualBtnTextWhite: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    manualCheckButton: {
      width: 48,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.xs,
    },
    habitDetailCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg },
    habitDetailTitle: { ...typography.h3, fontWeight: '700' },
    habitDetailMeta: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.md },
    habitDetailStatsRow: { flexDirection: 'row', marginBottom: spacing.md },
    habitDetailStat: {
      flex: 1,
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginHorizontal: spacing.xs,
      alignItems: 'center',
    },
    habitDetailStatValue: { ...typography.h3, fontWeight: '700' },
    habitDetailStatLabel: { ...typography.caption, marginTop: spacing.xs },
    habitDetailAction: { borderRadius: borderRadius.full, paddingVertical: spacing.md, alignItems: 'center' },
    habitDetailActionText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    routineCard: {
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: themeColorsParam?.card || colors.card,
      ...shadows.small,
    },
    routineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    routineTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    routineTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    routineMeta: {
      ...typography.bodySmall,
      color: subdued,
      marginTop: 2,
    },
    routineIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.primaryLight || colors.primaryLight,
    },
    routineIconColor: themeColorsParam?.primary || colors.primary,
    routineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    routineActionButton: {
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    taskOrderControls: {
      width: 28,
      alignItems: 'center',
      gap: spacing.xs,
    },
    taskText: {
      ...typography.body,
      color: baseText,
      flex: 1,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    modalButton: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    emptyTitle: {
      ...typography.body,
      color: subdued,
    },
    subduedText: subdued,
  });
};

export default GroupDetailScreen;
