import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { Card, Button, Input, PlatformDatePicker, PlatformScrollView } from '../components';
import { borderRadius, spacing, typography, shadows } from '../utils/theme';
import {
  WEIGHT_MANAGER_BODY_TYPES,
  WEIGHT_MANAGER_BODY_TYPE_MAP,
  WEIGHT_MANAGER_WEIGHT_UNITS,
  DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  DEFAULT_WEIGHT_MANAGER_UNIT,
  computeWeightManagerPlan,
} from '../utils/weightManager';
import {
  appendJourneyHistoryEntry,
  createCompletedJourneyEntry,
  getWeightJourneyHistoryStorageKey,
  getWeightManagerStateStorageKey,
  parseWeightJourneyHistoryPayload,
} from '../utils/weightJourneyHistory';

const JOURNEY_MODE_DURATION = 'duration';
const JOURNEY_MODE_DATE = 'date';
const JOURNEY_DURATION_PRESETS = [8, 12, 16];

const normalizeDateKey = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const addDaysToDateKey = (baseDate, daysToAdd) => {
  const parsedBase = baseDate instanceof Date ? baseDate : new Date(baseDate || Date.now());
  if (Number.isNaN(parsedBase.getTime())) return '';
  const date = new Date(
    parsedBase.getFullYear(),
    parsedBase.getMonth(),
    parsedBase.getDate() + Math.round(daysToAdd || 0)
  );
  return date.toISOString().slice(0, 10);
};

const formatDateLabel = (value) => {
  const key = normalizeDateKey(value);
  if (!key) return '--';
  const parsed = new Date(`${key}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const WeightManagerUpdatePlanScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    themeName,
    profile,
    authUser,
    isPremium,
    isPremiumUser,
    updateProfile,
    updateTodayHealth,
    weightManagerLogs,
    ensureWeightManagerLogsLoaded,
    addWeightManagerLog,
    clearWeightManagerLogs,
    todayHealth,
    healthData,
    ensureHealthLoaded,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const isDark = themeName === 'dark';
  const managerTheme = useMemo(
    () => ({
      gradient: isDark ? ['#0EA35B', '#06733F'] : ['#19D377', '#00B563'],
      border: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
      text: '#FFFFFF',
      meta: 'rgba(255,255,255,0.82)',
      panel: isDark ? 'rgba(8, 32, 22, 0.35)' : 'rgba(255,255,255,0.2)',
    }),
    [isDark]
  );

  const isPremiumActive = Boolean(
    isPremiumUser ||
      isPremium ||
      profile?.isPremium ||
      profile?.plan === 'premium' ||
      profile?.plan === 'pro' ||
      profile?.plan === 'paid'
  );

  const [weightUnit, setWeightUnit] = useState(DEFAULT_WEIGHT_MANAGER_UNIT);
  const [startingWeight, setStartingWeight] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [currentBodyType, setCurrentBodyType] = useState(DEFAULT_WEIGHT_MANAGER_BODY_TYPE);
  const [targetBodyType, setTargetBodyType] = useState(DEFAULT_WEIGHT_MANAGER_BODY_TYPE);
  const [journeyGoalMode, setJourneyGoalMode] = useState(JOURNEY_MODE_DURATION);
  const [journeyDurationWeeks, setJourneyDurationWeeks] = useState('12');
  const [journeyGoalDate, setJourneyGoalDate] = useState(addDaysToDateKey(new Date(), 84));
  const [showJourneyDatePicker, setShowJourneyDatePicker] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isCompletingJourney, setIsCompletingJourney] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [dailyWeight, setDailyWeight] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [logMessage, setLogMessage] = useState('');
  const hasLoadedRef = useRef(false);

  const storageKey = useMemo(
    () =>
      getWeightManagerStateStorageKey({
        authUserId: authUser?.id,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
      }),
    [authUser?.id, profile?.id, profile?.user_id]
  );
  const historyStorageKey = useMemo(
    () =>
      getWeightJourneyHistoryStorageKey({
        authUserId: authUser?.id,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
      }),
    [authUser?.id, profile?.id, profile?.user_id]
  );

  const journeyDurationDays = useMemo(() => {
    const parsedWeeks = Number(journeyDurationWeeks);
    if (journeyGoalMode !== JOURNEY_MODE_DURATION) return null;
    if (!Number.isFinite(parsedWeeks) || parsedWeeks <= 0) return null;
    return Math.round(parsedWeeks * 7);
  }, [journeyDurationWeeks, journeyGoalMode]);

  const normalizedJourneyGoalDate = useMemo(
    () => (journeyGoalMode === JOURNEY_MODE_DATE ? normalizeDateKey(journeyGoalDate) : ''),
    [journeyGoalDate, journeyGoalMode]
  );
  const journeyGoalPickerDateValue = useMemo(() => {
    const key = normalizeDateKey(journeyGoalDate) || addDaysToDateKey(new Date(), 84);
    const parsed = new Date(`${key}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [journeyGoalDate]);

  const plan = useMemo(() => {
    return computeWeightManagerPlan({
      startingWeight,
      currentWeight,
      targetWeight,
      unit: weightUnit,
      currentBodyTypeKey: currentBodyType,
      targetBodyTypeKey: targetBodyType,
      journeyDurationDays,
      journeyEndDate: normalizedJourneyGoalDate || null,
    });
  }, [
    currentBodyType,
    currentWeight,
    journeyDurationDays,
    normalizedJourneyGoalDate,
    startingWeight,
    targetBodyType,
    targetWeight,
    weightUnit,
  ]);

  const latestWeightLog = useMemo(
    () => (weightManagerLogs?.length ? weightManagerLogs[0] : null),
    [weightManagerLogs]
  );
  const preferredHealthCalories = useMemo(() => {
    let latestDate = '';
    let latestGoal = null;
    Object.entries(healthData || {}).forEach(([dateKey, day]) => {
      const goalValue = Number(day?.calorieGoal);
      if (!Number.isFinite(goalValue) || goalValue <= 0) return;
      if (!latestDate || dateKey > latestDate) {
        latestDate = dateKey;
        latestGoal = goalValue;
      }
    });
    return latestGoal;
  }, [healthData]);

  useEffect(() => {
    let isMounted = true;
    const normalizeUnit = (value) =>
      WEIGHT_MANAGER_WEIGHT_UNITS.some((unit) => unit.key === value) ? value : null;
    const normalizeBodyType = (value) =>
      typeof value === 'string' && WEIGHT_MANAGER_BODY_TYPE_MAP[value] ? value : null;
    const normalizeWeightValue = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      return parsed > 0 ? parsed : null;
    };
    const normalizeJourneyMode = (value) =>
      value === JOURNEY_MODE_DATE || value === JOURNEY_MODE_DURATION
        ? value
        : JOURNEY_MODE_DURATION;
    const normalizeJourneyWeeks = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      return Math.round(parsed);
    };
    const todayDate = new Date();
    const defaultJourneyDate = addDaysToDateKey(todayDate, 84);

    const hydrateFromProfile = () => {
      const hasProfileData =
        profile?.weightManagerCurrentWeight !== null ||
        profile?.weightManagerTargetWeight !== null ||
        profile?.weightManagerCurrentBodyType ||
        profile?.weightManagerTargetBodyType ||
        profile?.weightManagerUnit;
      if (!hasProfileData) return false;
      const nextUnit = normalizeUnit(profile?.weightManagerUnit) || DEFAULT_WEIGHT_MANAGER_UNIT;
      setWeightUnit(nextUnit);
      if (profile?.weightManagerCurrentWeight !== null && profile?.weightManagerCurrentWeight !== undefined) {
        setStartingWeight(String(profile.weightManagerCurrentWeight));
        setCurrentWeight(String(profile.weightManagerCurrentWeight));
      }
      if (profile?.weightManagerTargetWeight !== null && profile?.weightManagerTargetWeight !== undefined) {
        setTargetWeight(String(profile.weightManagerTargetWeight));
      }
      if (profile?.weightManagerCurrentBodyType) {
        setCurrentBodyType(profile.weightManagerCurrentBodyType);
      }
      if (profile?.weightManagerTargetBodyType) {
        setTargetBodyType(profile.weightManagerTargetBodyType);
      }
      setJourneyGoalMode(JOURNEY_MODE_DURATION);
      setJourneyDurationWeeks('12');
      setJourneyGoalDate(defaultJourneyDate);
      return true;
    };

    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (!stored) {
          hydrateFromProfile();
          return;
        }
        const parsed = JSON.parse(stored);
        if (!isMounted) return;
        if (!parsed) {
          hydrateFromProfile();
          return;
        }

        const mergedUnit =
          normalizeUnit(parsed?.weightUnit) ||
          normalizeUnit(profile?.weightManagerUnit) ||
          DEFAULT_WEIGHT_MANAGER_UNIT;
        const mergedCurrentWeight =
          normalizeWeightValue(parsed?.currentWeight) ??
          normalizeWeightValue(profile?.weightManagerCurrentWeight);
        const mergedStartingWeight =
          normalizeWeightValue(parsed?.startingWeight) ??
          mergedCurrentWeight ??
          normalizeWeightValue(profile?.weightManagerCurrentWeight);
        const mergedTargetWeight =
          normalizeWeightValue(parsed?.targetWeight) ??
          normalizeWeightValue(profile?.weightManagerTargetWeight);
        const mergedCurrentBodyType =
          normalizeBodyType(parsed?.currentBodyType) ||
          normalizeBodyType(profile?.weightManagerCurrentBodyType) ||
          DEFAULT_WEIGHT_MANAGER_BODY_TYPE;
        const mergedTargetBodyType =
          normalizeBodyType(parsed?.targetBodyType) ||
          normalizeBodyType(profile?.weightManagerTargetBodyType) ||
          DEFAULT_WEIGHT_MANAGER_BODY_TYPE;
        const mergedJourneyMode = normalizeJourneyMode(parsed?.journeyGoalMode);
        const mergedJourneyWeeks = normalizeJourneyWeeks(parsed?.journeyDurationWeeks) || 12;
        const mergedJourneyDate = normalizeDateKey(parsed?.journeyGoalDate) || defaultJourneyDate;

        setWeightUnit(mergedUnit);
        setStartingWeight(mergedStartingWeight === null ? '' : String(mergedStartingWeight));
        setCurrentWeight(mergedCurrentWeight === null ? '' : String(mergedCurrentWeight));
        setTargetWeight(mergedTargetWeight === null ? '' : String(mergedTargetWeight));
        setCurrentBodyType(mergedCurrentBodyType);
        setTargetBodyType(mergedTargetBodyType);
        setJourneyGoalMode(mergedJourneyMode);
        setJourneyDurationWeeks(String(mergedJourneyWeeks));
        setJourneyGoalDate(mergedJourneyDate);
      } catch (err) {
        console.log('Error loading weight manager state:', err);
      }
    };

    loadState().finally(() => {
      if (isMounted) {
        hasLoadedRef.current = true;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    storageKey,
    profile?.weightManagerCurrentWeight,
    profile?.weightManagerTargetWeight,
    profile?.weightManagerCurrentBodyType,
    profile?.weightManagerTargetBodyType,
    profile?.weightManagerUnit,
  ]);

  useEffect(() => {
    ensureWeightManagerLogsLoaded();
    ensureHealthLoaded();
  }, [ensureHealthLoaded, ensureWeightManagerLogsLoaded]);

  const formatLogDate = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimelineEstimate = (days) => {
    if (!Number.isFinite(days)) return '--';
    if (days <= 0) return 'Now';
    const weeks = Math.max(1, Math.round(days / 7));
    if (weeks >= 8) {
      const months = Math.max(1, Math.round(days / 30));
      return `${months} months`;
    }
    return `${weeks} weeks`;
  };

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const payload = {
      weightUnit,
      startingWeight,
      currentWeight,
      targetWeight,
      currentBodyType,
      targetBodyType,
      journeyGoalMode,
      journeyDurationWeeks,
      journeyGoalDate,
      savedAt: new Date().toISOString(),
    };
    AsyncStorage.setItem(storageKey, JSON.stringify(payload)).catch((err) => {
      console.log('Error saving weight manager state:', err);
    });
  }, [
    currentBodyType,
    currentWeight,
    journeyDurationWeeks,
    journeyGoalDate,
    journeyGoalMode,
    startingWeight,
    storageKey,
    targetBodyType,
    targetWeight,
    weightUnit,
  ]);

  useEffect(() => {
    if (journeyGoalMode !== JOURNEY_MODE_DATE && showJourneyDatePicker) {
      setShowJourneyDatePicker(false);
    }
  }, [journeyGoalMode, showJourneyDatePicker]);

  const handleJourneyPresetPress = (weeks) => {
    const normalizedWeeks = Math.max(1, Math.round(Number(weeks) || 1));
    setJourneyDurationWeeks(String(normalizedWeeks));
    if (journeyGoalMode === JOURNEY_MODE_DATE) {
      setJourneyGoalDate(addDaysToDateKey(new Date(), normalizedWeeks * 7));
    }
  };

  const handleJourneyDatePicked = (nextDate) => {
    const key = addDaysToDateKey(nextDate, 0);
    if (!key) return;
    setJourneyGoalDate(key);
  };

  const targetEndDateLabel = useMemo(() => {
    if (journeyGoalMode === JOURNEY_MODE_DATE) {
      return formatDateLabel(normalizedJourneyGoalDate || journeyGoalDate);
    }
    if (Number.isFinite(journeyDurationDays) && journeyDurationDays > 0) {
      return formatDateLabel(addDaysToDateKey(new Date(), journeyDurationDays));
    }
    return '--';
  }, [journeyDurationDays, journeyGoalDate, journeyGoalMode, normalizedJourneyGoalDate]);

  const isJourneyInputInvalid = useMemo(() => {
    if (journeyGoalMode === JOURNEY_MODE_DATE) {
      return !normalizedJourneyGoalDate;
    }
    return !Number.isFinite(journeyDurationDays) || journeyDurationDays <= 0;
  }, [journeyDurationDays, journeyGoalMode, normalizedJourneyGoalDate]);

  const dailyDeltaLabel = useMemo(() => {
    if (!plan || !Number.isFinite(plan.dailyCalorieDelta)) return '--';
    if (plan.dailyCalorieDelta > 0) return `+${plan.dailyCalorieDelta} cal`;
    if (plan.dailyCalorieDelta < 0) return `${plan.dailyCalorieDelta} cal`;
    return '0 cal';
  }, [plan]);

  const weeklyWeightChangeLabel = useMemo(() => {
    if (!plan || !Number.isFinite(plan.weeklyWeightChangeKg)) return '--';
    const magnitude = Math.abs(plan.weeklyWeightChangeKg).toFixed(2);
    const sign = plan.weeklyWeightChangeKg > 0 ? '+' : plan.weeklyWeightChangeKg < 0 ? '-' : '';
    return `${sign}${magnitude} kg/week`;
  }, [plan]);

  const buildJourneyStateSnapshot = () => ({
    weightUnit,
    startingWeight,
    currentWeight,
    targetWeight,
    currentBodyType,
    targetBodyType,
    journeyGoalMode,
    journeyDurationWeeks,
    journeyGoalDate,
    savedAt: new Date().toISOString(),
  });

  const resolveFallbackCalorieGoal = () => {
    const preferredCalories = Number(profile?.preferredDailyCalorieGoal);
    if (Number.isFinite(preferredCalories) && preferredCalories > 0) {
      return preferredCalories;
    }
    const profileDailyCalories = Number(profile?.dailyCalorieGoal);
    const healthPreferredCalories = Number(preferredHealthCalories);
    const todayCalories = Number(todayHealth?.calorieGoal);
    const targetCalories = Number(profile?.weightManagerTargetCalories);
    if (
      Number.isFinite(profileDailyCalories) &&
      profileDailyCalories > 0 &&
      profileDailyCalories !== targetCalories
    ) {
      return profileDailyCalories;
    }
    if (
      Number.isFinite(todayCalories) &&
      todayCalories > 0 &&
      todayCalories !== targetCalories
    ) {
      return todayCalories;
    }
    if (
      Number.isFinite(healthPreferredCalories) &&
      healthPreferredCalories > 0 &&
      healthPreferredCalories !== targetCalories
    ) {
      return healthPreferredCalories;
    }
    return 2000;
  };

  const clearJourneyPlanState = async (nextCalorieGoal) => {
    await updateProfile({
      dailyCalorieGoal: nextCalorieGoal,
      weightManagerUnit: DEFAULT_WEIGHT_MANAGER_UNIT,
      weightManagerCurrentWeight: null,
      weightManagerTargetWeight: null,
      weightManagerCurrentBodyType: DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
      weightManagerTargetBodyType: DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
      weightManagerTargetCalories: null,
      weightManagerProteinGrams: null,
      weightManagerCarbsGrams: null,
      weightManagerFatGrams: null,
    });
    await updateTodayHealth({
      calorieGoal: nextCalorieGoal,
      proteinGoal: null,
      carbsGoal: null,
      fatGoal: null,
    });
    await clearWeightManagerLogs();
    await AsyncStorage.removeItem(storageKey);

    setWeightUnit(DEFAULT_WEIGHT_MANAGER_UNIT);
    setStartingWeight('');
    setCurrentWeight('');
    setTargetWeight('');
    setCurrentBodyType(DEFAULT_WEIGHT_MANAGER_BODY_TYPE);
    setTargetBodyType(DEFAULT_WEIGHT_MANAGER_BODY_TYPE);
    setJourneyGoalMode(JOURNEY_MODE_DURATION);
    setJourneyDurationWeeks('12');
    setJourneyGoalDate(addDaysToDateKey(new Date(), 84));
    setDailyWeight('');
    setLogMessage('');
  };

  const renderBodyTypeChip = (bodyType, isActive, onPress) => {
    const silhouette = bodyType.silhouette || {};
    const fillColor = isActive ? themeColors.primary : themeColors.textLight;
    const borderColor = isActive ? themeColors.primary : themeColors.border;
    return (
      <TouchableOpacity
        key={bodyType.key}
        style={[styles.typeChip, isActive && styles.typeChipActive, { borderColor }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={bodyType.label}
      >
        <View style={styles.bodyTypeIllustration}>
          <View style={[styles.bodyTypeHead, { backgroundColor: fillColor }]} />
          <View
            style={[
              styles.bodyTypeShoulders,
              { backgroundColor: fillColor, width: silhouette.shoulders || 40 },
            ]}
          />
          <View
            style={[
              styles.bodyTypeTorso,
              { backgroundColor: fillColor, width: silhouette.torso || 32 },
            ]}
          />
          <View
            style={[
              styles.bodyTypeWaist,
              { backgroundColor: fillColor, width: silhouette.waist || 28 },
            ]}
          />
          <View
            style={[
              styles.bodyTypeLegs,
              { backgroundColor: fillColor, width: silhouette.waist || 28 },
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const handleSavePlan = async () => {
    if (!plan || isSavingPlan) return;
    setIsSavingPlan(true);
    setSaveMessage('');
    const calorieGoal = plan.targetCalories;
    const proteinGoal = plan.proteinGrams;
    const carbsGoal = plan.carbsGrams;
    const fatGoal = plan.fatGrams;
    const startingWeightValue = Number(startingWeight);
    const currentWeightValue = Number(currentWeight);
    const targetWeightValue = Number(targetWeight);

    try {
      const updatedProfile = await updateProfile({
        weightManagerUnit: weightUnit,
        weightManagerCurrentWeight: Number.isFinite(currentWeightValue)
          ? currentWeightValue
          : Number.isFinite(startingWeightValue)
          ? startingWeightValue
          : null,
        weightManagerTargetWeight: Number.isFinite(targetWeightValue) ? targetWeightValue : null,
        weightManagerCurrentBodyType: currentBodyType,
        weightManagerTargetBodyType: targetBodyType,
        weightManagerTargetCalories: calorieGoal,
        weightManagerProteinGrams: proteinGoal,
        weightManagerCarbsGrams: carbsGoal,
        weightManagerFatGrams: fatGoal,
      });
      if (!updatedProfile) {
        throw new Error('Profile update failed.');
      }
      await updateTodayHealth({
        calorieGoal,
        proteinGoal,
        carbsGoal,
        fatGoal,
      });
      setSaveMessage(
        'Journey plan saved. Calorie and macro targets will stay active until you complete this journey.'
      );
    } catch (err) {
      console.log('Error saving weight manager targets:', err);
      Alert.alert('Unable to save targets', 'Please try again.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleCompleteJourney = () => {
    if (!plan || isJourneyInputInvalid || isCompletingJourney) {
      Alert.alert(
        'Journey not ready',
        'Set a valid journey timeline and weights before marking this journey complete.'
      );
      return;
    }

    Alert.alert(
      'Complete this journey?',
      'This marks your goal as achieved, archives this journey in history, and resets the active journey plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Journey',
          onPress: async () => {
            setIsCompletingJourney(true);
            setSaveMessage('');
            try {
              const stateSnapshot = buildJourneyStateSnapshot();
              const completedEntry = createCompletedJourneyEntry({
                state: stateSnapshot,
                plan,
                logs: weightManagerLogs,
              });
              if (!completedEntry) {
                throw new Error('Unable to build a completed journey record.');
              }

              const existingRaw = await AsyncStorage.getItem(historyStorageKey);
              let existingEntries = [];
              if (existingRaw) {
                try {
                  existingEntries = parseWeightJourneyHistoryPayload(JSON.parse(existingRaw));
                } catch (err) {
                  console.log('Error parsing stored journey history:', err);
                }
              }

              const nextHistory = appendJourneyHistoryEntry(existingEntries, completedEntry);
              await AsyncStorage.setItem(
                historyStorageKey,
                JSON.stringify({
                  journeys: nextHistory,
                })
              );

              const nextCalorieGoal = resolveFallbackCalorieGoal();
              await clearJourneyPlanState(nextCalorieGoal);
              setSaveMessage('Journey completed and added to history.');

              Alert.alert('Journey completed', 'Your journey has been saved in Weight Loss History.', [
                { text: 'Done' },
                {
                  text: 'View history',
                  onPress: () => navigation.navigate('WeightJourneyHistory'),
                },
              ]);
            } catch (err) {
              console.log('Error completing weight journey:', err);
              Alert.alert('Unable to complete journey', 'Please try again.');
            } finally {
              setIsCompletingJourney(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveLog = async () => {
    if (!plan || isSavingLog) return;
    const parsedWeight = Number(dailyWeight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      Alert.alert('Enter weight', 'Please enter a valid weight for today.');
      return;
    }
    setIsSavingLog(true);
    setLogMessage('');
    try {
      await addWeightManagerLog({
        weight: parsedWeight,
        unit: weightUnit,
        logDate: new Date(),
      });
      setDailyWeight('');
      setLogMessage('Logged for today.');
    } catch (err) {
      console.log('Error saving weight log:', err);
      Alert.alert('Unable to save', 'Please try again.');
    } finally {
      setIsSavingLog(false);
    }
  };

  const handleResetGoal = () => {
    Alert.alert(
      'Reset weight loss journey?',
      'This clears your journey targets and daily check-ins.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextCalorieGoal = resolveFallbackCalorieGoal();
              await clearJourneyPlanState(nextCalorieGoal);
              setSaveMessage('');
            } catch (err) {
              console.log('Error resetting weight manager:', err);
              Alert.alert('Unable to reset', 'Please try again.');
            }
          },
        },
      ]
    );
  };

  if (!isPremiumActive) {
    return (
      <View style={[styles.lockedContainer, { paddingTop: insets.top }]}>
        <Card style={styles.lockedCard}>
          <Ionicons name="star" size={28} color={themeColors.primary} />
          <Text style={styles.lockedTitle}>Premium feature</Text>
          <Text style={styles.lockedText}>
            Upgrade to access the Weight Loss Journey planner and adaptive calorie targets.
          </Text>
          <Button
            title="Upgrade to Premium"
            onPress={() => navigation.navigate('Paywall', { source: 'weight-manager-update-plan' })}
            style={styles.lockedButton}
          />
          <Button
            title="Go back"
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Weight Loss Journey</Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('WeightJourneyHistory')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Open weight loss history"
          >
            <Ionicons name="time-outline" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Build a timeline-based journey with starting, current, and goal weight targets.
        </Text>

        <Card style={styles.heroCard}>
          <LinearGradient
            colors={managerTheme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroGradient, { borderColor: managerTheme.border }]}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroTitleRow}>
                <View style={[styles.heroIcon, { backgroundColor: managerTheme.panel }]}>
                  <Ionicons name="barbell" size={18} color={managerTheme.text} />
                </View>
                <View>
                  <Text style={[styles.heroTitle, { color: managerTheme.text }]}>
                    Journey Plan
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: managerTheme.meta }]}>
                    {WEIGHT_MANAGER_BODY_TYPE_MAP[targetBodyType]?.label || 'Target body type'} body goal
                  </Text>
                </View>
              </View>
              <View style={[styles.heroTag, { backgroundColor: managerTheme.panel }]}>
                <Text style={[styles.heroTagText, { color: managerTheme.text }]}>
                  Weight loss journey
                </Text>
              </View>
            </View>

            {plan ? (
              <>
                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStat}>
                    <Text style={[styles.heroStatLabel, { color: managerTheme.meta }]}>
                      Daily intake
                    </Text>
                    <Text style={[styles.heroStatValue, { color: managerTheme.text }]}>
                      {plan.targetCalories} cal
                    </Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={styles.heroStat}>
                    <Text style={[styles.heroStatLabel, { color: managerTheme.meta }]}>
                      Daily change
                    </Text>
                    <Text style={[styles.heroStatValue, { color: managerTheme.text }]}>
                      {dailyDeltaLabel}
                    </Text>
                  </View>
                </View>
                <View style={[styles.heroMacroRow, { backgroundColor: managerTheme.panel }]}>
                  <View style={styles.heroMacroItem}>
                    <Text style={[styles.heroMacroLabel, { color: managerTheme.meta }]}>Protein</Text>
                    <Text style={[styles.heroMacroValue, { color: managerTheme.text }]}>
                      {plan.proteinGrams} g
                    </Text>
                  </View>
                  <View style={styles.heroMacroItem}>
                    <Text style={[styles.heroMacroLabel, { color: managerTheme.meta }]}>Carbs</Text>
                    <Text style={[styles.heroMacroValue, { color: managerTheme.text }]}>
                      {plan.carbsGrams} g
                    </Text>
                  </View>
                  <View style={styles.heroMacroItem}>
                    <Text style={[styles.heroMacroLabel, { color: managerTheme.meta }]}>Fat</Text>
                    <Text style={[styles.heroMacroValue, { color: managerTheme.text }]}>
                      {plan.fatGrams} g
                    </Text>
                  </View>
                </View>
                <View style={styles.heroTimelineRow}>
                  <Text style={[styles.heroTimelineLabel, { color: managerTheme.meta }]}>
                    Estimated finish
                  </Text>
                  <Text style={[styles.heroTimelineValue, { color: managerTheme.text }]}>
                    {formatDateLabel(plan.projectedEndDateISO)}
                  </Text>
                </View>
                <View style={styles.heroTimelineRow}>
                  <Text style={[styles.heroTimelineLabel, { color: managerTheme.meta }]}>
                    Weekly trend
                  </Text>
                  <Text style={[styles.heroTimelineValue, { color: managerTheme.text }]}>
                    {weeklyWeightChangeLabel}
                  </Text>
                </View>
                <View style={styles.heroTimelineRow}>
                  <Text style={[styles.heroTimelineLabel, { color: managerTheme.meta }]}>
                    Goal window
                  </Text>
                  <Text style={[styles.heroTimelineValue, { color: managerTheme.text }]}>
                    {plan.timelineTargetDays
                      ? `${formatTimelineEstimate(plan.timelineTargetDays)} (until ${targetEndDateLabel})`
                      : formatTimelineEstimate(plan.estimatedDays)}
                  </Text>
                </View>
                {plan.timelineTargetDays && !plan.timelineGoalMet ? (
                  <Text style={[styles.heroWarning, { color: '#FFE9A8' }]}>
                    This timeline is aggressive. Consider a longer journey window.
                  </Text>
                ) : null}
                <Text style={[styles.heroDisclaimer, { color: managerTheme.meta }]}>
                  Calories and macros adapt to your timeline and remaining journey distance.
                </Text>
              </>
            ) : (
              <Text style={[styles.heroEmpty, { color: managerTheme.meta }]}>
                Enter starting, current, goal, and timeline to build your journey plan.
              </Text>
            )}

            <Button
              title="Save Journey Plan"
              onPress={handleSavePlan}
              loading={isSavingPlan}
              disabled={!plan || isSavingPlan || isJourneyInputInvalid}
              style={[styles.heroButton, { backgroundColor: managerTheme.panel }]}
              textStyle={{ color: managerTheme.text }}
            />
            <Button
              title="Complete Journey"
              onPress={handleCompleteJourney}
              loading={isCompletingJourney}
              disabled={!plan || isJourneyInputInvalid || isCompletingJourney || isSavingPlan}
              style={[styles.completeJourneyButton, { borderColor: managerTheme.border }]}
              textStyle={styles.completeJourneyButtonText}
            />
            {!!saveMessage && (
              <Text style={[styles.heroSaveMessage, { color: managerTheme.text }]}>
                {saveMessage}
              </Text>
            )}
          </LinearGradient>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: themeColors.primaryLight }]}>
                <Ionicons name="calendar-outline" size={16} color={themeColors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Journey timeline</Text>
                <Text style={styles.cardSubtitle}>Choose how long this plan should run.</Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineModeToggle}>
            <TouchableOpacity
              style={[
                styles.timelineModeOption,
                journeyGoalMode === JOURNEY_MODE_DURATION && styles.timelineModeOptionActive,
              ]}
              onPress={() => setJourneyGoalMode(JOURNEY_MODE_DURATION)}
            >
              <Text
                style={[
                  styles.timelineModeText,
                  journeyGoalMode === JOURNEY_MODE_DURATION && styles.timelineModeTextActive,
                ]}
              >
                Duration
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.timelineModeOption,
                journeyGoalMode === JOURNEY_MODE_DATE && styles.timelineModeOptionActive,
              ]}
              onPress={() => setJourneyGoalMode(JOURNEY_MODE_DATE)}
            >
              <Text
                style={[
                  styles.timelineModeText,
                  journeyGoalMode === JOURNEY_MODE_DATE && styles.timelineModeTextActive,
                ]}
              >
                End Date
              </Text>
            </TouchableOpacity>
          </View>

          {journeyGoalMode === JOURNEY_MODE_DURATION ? (
            <Input
              label="How long should the journey last? (weeks)"
              value={journeyDurationWeeks}
              onChangeText={setJourneyDurationWeeks}
              keyboardType="numeric"
              containerStyle={styles.timelineInput}
              style={styles.weightInputField}
              placeholder="e.g., 12"
            />
          ) : (
            <View style={styles.timelineDateSelector}>
              <Text style={styles.timelineDateLabel}>When should the journey finish?</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.timelineDateButton}
                onPress={() => setShowJourneyDatePicker(true)}
              >
                <Text style={styles.timelineDateValue}>
                  {formatDateLabel(normalizedJourneyGoalDate || journeyGoalDate)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={themeColors.primary} />
              </TouchableOpacity>
            </View>
          )}

          <PlatformDatePicker
            visible={showJourneyDatePicker}
            value={journeyGoalPickerDateValue}
            minimumDate={new Date()}
            onChange={handleJourneyDatePicked}
            onClose={() => setShowJourneyDatePicker(false)}
            title="Select Journey End Date"
          />

          <View style={styles.timelinePresetRow}>
            {JOURNEY_DURATION_PRESETS.map((preset) => (
              <TouchableOpacity
                key={`journey-preset-${preset}`}
                style={styles.timelinePresetChip}
                onPress={() => handleJourneyPresetPress(preset)}
              >
                <Text style={styles.timelinePresetText}>{preset} weeks</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.timelineHint}>
            Target end date: {targetEndDateLabel}
          </Text>
          {isJourneyInputInvalid ? (
            <Text style={styles.timelineWarning}>
              {journeyGoalMode === JOURNEY_MODE_DATE
                ? 'Select a valid end date.'
                : 'Enter a valid duration in weeks.'}
            </Text>
          ) : null}
          {plan?.timelineTargetDays && !plan.timelineGoalMet ? (
            <Text style={styles.timelineWarning}>
              This goal may require an unsafe pace. Increase the timeline for a steadier plan.
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: themeColors.primaryLight }]}>
                <Ionicons name="speedometer" size={16} color={themeColors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Weights</Text>
                <Text style={styles.cardSubtitle}>Set starting, current, and goal weight for your journey.</Text>
              </View>
            </View>
          </View>

          <View style={styles.weightUnitRow}>
            <Text style={styles.sectionLabel}>Unit</Text>
            <View style={styles.unitToggle}>
              {WEIGHT_MANAGER_WEIGHT_UNITS.map((option) => {
                const isActive = weightUnit === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.unitOption, isActive && styles.unitOptionActive]}
                    onPress={() => setWeightUnit(option.key)}
                  >
                    <Text style={[styles.unitOptionText, isActive && styles.unitOptionTextActive]}>
                      {option.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Input
            label={`Starting weight (${weightUnit})`}
            value={startingWeight}
            onChangeText={setStartingWeight}
            keyboardType="numeric"
            containerStyle={styles.weightInputFull}
            style={styles.weightInputField}
            placeholder={`e.g., ${weightUnit === 'kg' ? '92' : '203'}`}
          />

          <View style={styles.weightInputsRow}>
            <Input
              label={`Current weight (${weightUnit})`}
              value={currentWeight}
              onChangeText={setCurrentWeight}
              keyboardType="numeric"
              containerStyle={[styles.weightInput, styles.weightInputLeft]}
              style={styles.weightInputField}
              placeholder={`e.g., ${weightUnit === 'kg' ? '86' : '189'}`}
            />
            <Input
              label={`Goal weight (${weightUnit})`}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="numeric"
              containerStyle={[styles.weightInput, styles.weightInputRight]}
              style={styles.weightInputField}
              placeholder={`e.g., ${weightUnit === 'kg' ? '78' : '172'}`}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: themeColors.primaryLight }]}>
                <Ionicons name="body" size={16} color={themeColors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Body type</Text>
                <Text style={styles.cardSubtitle}>Choose your current and target body profile.</Text>
              </View>
            </View>
          </View>

          <View style={styles.bodyTypeSection}>
            <View style={styles.bodyTypeHeader}>
              <Text style={styles.sectionLabel}>Current</Text>
              <View style={styles.bodyTypeBadge}>
                <Text style={styles.bodyTypeBadgeText}>
                  {WEIGHT_MANAGER_BODY_TYPE_MAP[currentBodyType]?.label || 'Current'}
                </Text>
              </View>
            </View>
            <View style={styles.chipRow}>
              {WEIGHT_MANAGER_BODY_TYPES.map((bodyType) =>
                renderBodyTypeChip(bodyType, currentBodyType === bodyType.key, () =>
                  setCurrentBodyType(bodyType.key)
                )
              )}
            </View>
          </View>

          <View style={styles.bodyTypeSection}>
            <View style={styles.bodyTypeHeader}>
              <Text style={styles.sectionLabel}>Target</Text>
              <View style={styles.bodyTypeBadge}>
                <Text style={styles.bodyTypeBadgeText}>
                  {WEIGHT_MANAGER_BODY_TYPE_MAP[targetBodyType]?.label || 'Target'}
                </Text>
              </View>
            </View>
            <View style={styles.chipRow}>
              {WEIGHT_MANAGER_BODY_TYPES.map((bodyType) =>
                renderBodyTypeChip(bodyType, targetBodyType === bodyType.key, () =>
                  setTargetBodyType(bodyType.key)
                )
              )}
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: themeColors.primaryLight }]}>
                <Ionicons name="trending-up" size={16} color={themeColors.primary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Daily check-in</Text>
                <Text style={styles.cardSubtitle}>Log current weight to keep your journey adaptive.</Text>
              </View>
            </View>
          </View>

          <Input
            label={`Today's weight (${weightUnit})`}
            value={dailyWeight}
            onChangeText={setDailyWeight}
            keyboardType="numeric"
            containerStyle={styles.dailyWeightInput}
            style={styles.weightInputField}
            placeholder={`e.g., ${weightUnit === 'kg' ? '78' : '172'}`}
          />

          <View style={styles.logFooter}>
            <Text style={styles.logHint}>
              {latestWeightLog?.weight
                ? `Last check-in: ${latestWeightLog.weight} ${latestWeightLog.unit || weightUnit} - ${formatLogDate(latestWeightLog.logDate)}`
                : 'No check-ins yet.'}
            </Text>
            <Button
              title="Save"
              onPress={handleSaveLog}
              loading={isSavingLog}
              disabled={!plan || isSavingLog}
              style={styles.logButton}
            />
          </View>

          {!!logMessage && <Text style={styles.logMessage}>{logMessage}</Text>}
          {!plan && (
            <Text style={styles.logLockedText}>
              Set a goal above to start logging your daily weight.
            </Text>
          )}
        </Card>

        <Card style={styles.resetCard}>
          <View style={styles.resetRow}>
            <View style={styles.resetTextBlock}>
              <Text style={styles.resetTitle}>Reset goal</Text>
              <Text style={styles.resetSubtitle}>
                Clear your journey plan and return to your preferred daily calories.
              </Text>
            </View>
            <Button
              title="Reset Goal"
              variant="danger"
              onPress={handleResetGoal}
              style={styles.resetButton}
            />
          </View>
        </Card>
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.card,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    title: {
      ...typography.h2,
      color: themeColors.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.sm,
    },
    historyButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.card,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    subtitle: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      marginBottom: spacing.lg,
    },
    card: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    cardTitle: {
      ...typography.h3,
      color: themeColors.text,
    },
    cardSubtitle: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    weightUnitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    unitToggle: {
      flexDirection: 'row',
      backgroundColor: themeColors.inputBackground,
      borderRadius: borderRadius.full,
      padding: spacing.xs,
      minWidth: 140,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    unitOption: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    unitOptionActive: {
      backgroundColor: themeColors.primary,
    },
    unitOptionText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    unitOptionTextActive: {
      color: '#FFFFFF',
    },
    weightInputsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    weightInput: {
      flex: 1,
      marginBottom: 0,
    },
    weightInputLeft: {
      marginRight: spacing.md,
    },
    weightInputRight: {
      marginLeft: 0,
    },
    weightInputFull: {
      marginBottom: spacing.md,
    },
    weightInputField: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.inputBackground,
    },
    timelineModeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.inputBackground,
      borderRadius: borderRadius.full,
      padding: spacing.xs,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginBottom: spacing.md,
    },
    timelineModeOption: {
      flex: 1,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    timelineModeOptionActive: {
      backgroundColor: themeColors.primary,
    },
    timelineModeText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    timelineModeTextActive: {
      color: '#FFFFFF',
    },
    timelineInput: {
      marginBottom: spacing.md,
    },
    timelineDateSelector: {
      marginBottom: spacing.md,
    },
    timelineDateLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginBottom: spacing.xs,
    },
    timelineDateButton: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.inputBackground,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timelineDateValue: {
      ...typography.bodySmall,
      color: themeColors.text,
      fontWeight: '600',
    },
    timelinePresetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    timelinePresetChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.inputBackground,
    },
    timelinePresetText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    timelineHint: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    timelineWarning: {
      ...typography.caption,
      color: themeColors.warning || '#EA580C',
      marginTop: spacing.xs,
    },
    dailyWeightInput: {
      marginBottom: spacing.md,
    },
    logFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logHint: {
      ...typography.caption,
      color: themeColors.textSecondary,
      flex: 1,
      marginRight: spacing.md,
    },
    logButton: {
      paddingHorizontal: spacing.lg,
    },
    logMessage: {
      ...typography.caption,
      color: themeColors.primary,
      marginTop: spacing.sm,
    },
    logLockedText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: spacing.xs,
    },
    resetCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    resetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    resetTextBlock: {
      flex: 1,
      marginRight: spacing.md,
    },
    resetTitle: {
      ...typography.h3,
      color: themeColors.text,
      marginBottom: spacing.xs,
    },
    resetSubtitle: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    resetButton: {
      minWidth: 140,
    },
    sectionLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    bodyTypeSection: {
      marginBottom: spacing.md,
    },
    bodyTypeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    bodyTypeBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: themeColors.inputBackground,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    bodyTypeBadgeText: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.md,
    },
    typeChip: {
      width: 100,
      height: 120,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: themeColors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeChipActive: {
      backgroundColor: themeColors.primaryLight,
      borderColor: themeColors.primary,
      borderWidth: 2,
      ...shadows.small,
    },
    bodyTypeIllustration: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    bodyTypeHead: {
      width: 18,
      height: 18,
      borderRadius: 9,
      marginBottom: spacing.xs,
    },
    bodyTypeShoulders: {
      height: 8,
      borderRadius: 4,
      marginBottom: 2,
    },
    bodyTypeTorso: {
      height: 16,
      borderRadius: 6,
      marginBottom: 2,
    },
    bodyTypeWaist: {
      height: 10,
      borderRadius: 5,
      marginBottom: 2,
    },
    bodyTypeLegs: {
      height: 14,
      borderRadius: 6,
    },
    heroCard: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      overflow: 'hidden',
      padding: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    heroGradient: {
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
    },
    heroHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    heroTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    heroTitle: {
      ...typography.h3,
      fontWeight: '700',
    },
    heroSubtitle: {
      ...typography.caption,
      marginTop: 2,
    },
    heroTag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    heroTagText: {
      ...typography.caption,
      fontWeight: '600',
    },
    heroStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    heroStat: {
      flex: 1,
    },
    heroStatLabel: {
      ...typography.caption,
      marginBottom: spacing.xs,
    },
    heroStatValue: {
      ...typography.h3,
      fontWeight: '700',
    },
    heroDivider: {
      width: 1,
      height: 32,
      backgroundColor: 'rgba(255,255,255,0.35)',
      marginHorizontal: spacing.md,
    },
    heroMacroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.sm,
    },
    heroMacroItem: {
      flex: 1,
      alignItems: 'flex-start',
    },
    heroMacroLabel: {
      ...typography.caption,
    },
    heroMacroValue: {
      ...typography.body,
      fontWeight: '600',
    },
    heroTimelineRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    heroTimelineLabel: {
      ...typography.caption,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    heroTimelineValue: {
      ...typography.bodySmall,
      fontWeight: '700',
    },
    heroDisclaimer: {
      ...typography.caption,
      marginBottom: spacing.sm,
    },
    heroWarning: {
      ...typography.caption,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      fontWeight: '600',
    },
    heroEmpty: {
      ...typography.bodySmall,
      marginBottom: spacing.md,
    },
    heroButton: {
      marginTop: spacing.sm,
    },
    completeJourneyButton: {
      marginTop: spacing.sm,
      backgroundColor: 'transparent',
      borderWidth: 1,
    },
    completeJourneyButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    heroSaveMessage: {
      ...typography.caption,
      marginTop: spacing.sm,
    },
    lockedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      backgroundColor: themeColors.background,
    },
    lockedCard: {
      width: '100%',
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.xl,
      alignItems: 'center',
    },
    lockedTitle: {
      ...typography.h3,
      color: themeColors.text,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    lockedText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    lockedButton: {
      marginBottom: spacing.sm,
      alignSelf: 'stretch',
    },
  });

export default WeightManagerUpdatePlanScreen;
