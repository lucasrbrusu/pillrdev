import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, PlatformScrollView, PlatformTimePicker } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} from '../utils/theme';
import { formatTimeFromDate } from '../utils/notifications';
import { lookupFoodByBarcode } from '../utils/foodBarcodeLookup';
import {
  computeWeightManagerPlan,
  WEIGHT_MANAGER_BODY_TYPES,
  DEFAULT_WEIGHT_MANAGER_UNIT,
} from '../utils/weightManager';


const MOOD_OPTIONS = [
  { label: 'Depressed', emoji: '😞' },
  { label: 'Extremely Sad', emoji: '😢' },
  { label: 'Very Sad', emoji: '😔' },
  { label: 'Quite Sad', emoji: '🙁' },
  { label: 'Sad', emoji: '😟' },
  { label: 'Little Sad', emoji: '😕' },
  { label: 'Neutral', emoji: '😐' },
  { label: 'A Bit Happy', emoji: '🙂' },
  { label: 'Happy', emoji: '😊' },
  { label: 'Very Happy', emoji: '😄' },
  { label: 'Extremely Happy', emoji: '😁' },
  { label: 'Overjoyed', emoji: '🤩' },
];

const MOOD_THEMES = [
  {
    accent: '#5B66E8',
    background: '#A9B3FF',
    gradient: ['#7C85FF', '#5B66E8'],
    backgroundGradient: ['#A9B3FF', '#E3E6FF'],
  },
  {
    accent: '#6B74F0',
    background: '#B3B9FF',
    gradient: ['#8B93FF', '#6B74F0'],
    backgroundGradient: ['#B3B9FF', '#E5E7FF'],
  },
  {
    accent: '#7A71F0',
    background: '#BFB4FF',
    gradient: ['#9A8CFF', '#7A71F0'],
    backgroundGradient: ['#BFB4FF', '#EDE7FF'],
  },
  {
    accent: '#8A70F0',
    background: '#C9B4FF',
    gradient: ['#A98DFF', '#8A70F0'],
    backgroundGradient: ['#C9B4FF', '#EEE6FF'],
  },
  {
    accent: '#6F7FEF',
    background: '#AEC2FF',
    gradient: ['#88A0FF', '#6F7FEF'],
    backgroundGradient: ['#AEC2FF', '#E4ECFF'],
  },
  {
    accent: '#7C8DEB',
    background: '#B6C3FF',
    gradient: ['#9FB1FF', '#7C8DEB'],
    backgroundGradient: ['#B6C3FF', '#E6ECFF'],
  },
  {
    accent: '#8E96A8',
    background: '#C9CFDA',
    gradient: ['#B5BCCB', '#8E96A8'],
    backgroundGradient: ['#C9CFDA', '#ECEFF5'],
  },
  {
    accent: '#52C6A8',
    background: '#AEEFD4',
    gradient: ['#7DE6C8', '#52C6A8'],
    backgroundGradient: ['#AEEFD4', '#E5FFF4'],
  },
  {
    accent: '#38C985',
    background: '#A5F0CB',
    gradient: ['#63E3A4', '#38C985'],
    backgroundGradient: ['#A5F0CB', '#E1FFF1'],
  },
  {
    accent: '#FFB24A',
    background: '#FFD19B',
    gradient: ['#FFC76F', '#FFB24A'],
    backgroundGradient: ['#FFD19B', '#FFEFDA'],
  },
  {
    accent: '#FF8A3D',
    background: '#FFC2A0',
    gradient: ['#FFA358', '#FF8A3D'],
    backgroundGradient: ['#FFC2A0', '#FFE5D7'],
  },
  {
    accent: '#FF4FA0',
    background: '#FFADD6',
    gradient: ['#FF6BC0', '#FF4FA0'],
    backgroundGradient: ['#FFADD6', '#FFE1F0'],
  },
];

// Basic offline mapping so scans can populate fields without a network call.
// Replace/extend this with your own lookup or API integration.
const BARCODE_FOOD_MAP = {
  '012345678905': { name: 'Granola Bar', calories: 190, proteinGrams: 6, carbsGrams: 29, fatGrams: 5 },
  '04963406': { name: 'Greek Yogurt', calories: 100, proteinGrams: 17, carbsGrams: 6, fatGrams: 0 },
};

const HealthScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { width: windowWidth } = useWindowDimensions();
  const {
    healthData,
    todayHealth,
    updateTodayHealth,
    addFoodEntry,
    addFoodEntryForDate,
    deleteFoodEntryForDate,
    updateHealthForDate,
    authUser,
    profile,
    isPremium,
    isPremiumUser,
    getAverageWater,
    getAverageSleep,
    themeName,
    themeColors,
    ensureHealthLoaded,
    ensureWeightManagerLogsLoaded,
    weightManagerLogs,
  } = useApp();
  const isDark = themeName === 'dark';
  const isPremiumActive = Boolean(
    isPremiumUser ||
      isPremium ||
      profile?.isPremium ||
      profile?.plan === 'premium' ||
      profile?.plan === 'pro' ||
      profile?.plan === 'paid'
  );
  const isWeightManagerLocked = !isPremiumActive;
  const swipeCardWidth = Math.max(0, windowWidth - spacing.xl * 2);
  const healthTheme = useMemo(() => {
    const baseCard = isDark ? '#1D2236' : '#FFFFFF';
    return {
      background: isDark ? themeColors.background : '#F6F4FF',
      stats: {
        water: {
          card: baseCard,
          border: isDark ? '#1F3148' : '#D6E9FF',
          iconBg: isDark ? '#1D3551' : '#D9ECFF',
          iconColor: isDark ? '#7DD3FC' : themeColors.info,
          label: isDark ? '#C7D2FE' : themeColors.textSecondary,
          value: isDark ? '#7DD3FC' : themeColors.info,
          goal: isDark ? '#A5B4FC' : themeColors.textLight,
        },
        sleep: {
          card: baseCard,
          border: isDark ? '#2F2448' : '#E5D6FF',
          iconBg: isDark ? '#2F2448' : '#E8DCFF',
          iconColor: isDark ? '#C4B5FD' : themeColors.primary,
          label: isDark ? '#C7D2FE' : themeColors.textSecondary,
          value: isDark ? '#C4B5FD' : themeColors.primary,
          goal: isDark ? '#A5B4FC' : themeColors.textLight,
        },
      },
      calorie: {
        card: baseCard,
        border: isDark ? '#263A31' : '#CFEEDD',
        title: isDark ? '#6EE7B7' : '#16A34A',
        label: isDark ? '#C7D2FE' : themeColors.textSecondary,
        goal: isDark ? '#6EE7B7' : '#16A34A',
        consumed: isDark ? '#FDBA74' : '#F97316',
        ring: isDark ? '#34D399' : '#10B981',
        ringBg: baseCard,
      },
      food: {
        card: baseCard,
        border: isDark ? '#3A2C22' : '#F7D8C0',
        title: isDark ? '#FDBA74' : '#F97316',
        itemBg: isDark ? '#33271E' : '#FFF8F2',
        itemBorder: isDark ? '#443426' : '#F4D6C0',
        buttonBorder: isDark ? '#FDBA74' : '#F97316',
        buttonText: isDark ? '#FDBA74' : '#F97316',
      },
      mood: {
        card: baseCard,
        border: isDark ? '#3A2A40' : '#F3C8FF',
        title: isDark ? '#E879F9' : '#C026D3',
        text: isDark ? '#D1C4E9' : themeColors.textSecondary,
      },
      sleep: {
        card: baseCard,
        border: isDark ? '#2C334C' : '#E5E7EB',
        title: isDark ? '#A5B4FC' : '#4F46E5',
        inputBg: isDark ? '#232A42' : '#F9FAFB',
        inputBorder: isDark ? '#323A57' : '#E5E7EB',
        chipBg: isDark ? '#2B314A' : '#F3F4F6',
        chipActiveBg: isDark ? '#4F46E5' : '#6D28D9',
        chipText: isDark ? '#C7D2FE' : themeColors.textSecondary,
        chipActiveText: '#FFFFFF',
        logBg: isDark ? '#242B44' : '#F6F7FF',
        logBorder: isDark ? '#333B5A' : '#E3E8FF',
      },
      water: {
        card: baseCard,
        border: isDark ? '#223A4E' : '#CFE8FF',
        title: isDark ? '#38BDF8' : '#0284C7',
        count: isDark ? '#7DD3FC' : '#0284C7',
        progressBg: isDark ? '#223447' : '#D9ECFF',
        progressFill: isDark ? '#38BDF8' : '#0EA5E9',
        inputBg: isDark ? '#1C3346' : '#FFFFFF',
        inputBorder: isDark ? '#2E465A' : '#D6E9FF',
        buttonBg: isDark ? '#0EA5E9' : '#0284C7',
        buttonGradient: isDark ? ['#38BDF8', '#1D4ED8'] : ['#22D3EE', '#0284C7'],
        buttonText: '#FFFFFF',
      },
    };
  }, [isDark, themeColors]);
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    ensureHealthLoaded();
    ensureWeightManagerLogsLoaded();
  }, [ensureHealthLoaded, ensureWeightManagerLogsLoaded]);

  const weightManagerStorageKey = useMemo(() => {
    const userId = authUser?.id || profile?.id || profile?.user_id || 'default';
    return `weight_manager_state:${userId}`;
  }, [authUser?.id, profile?.id, profile?.user_id]);

  useEffect(() => {
    let isMounted = true;
    const loadWeightManagerState = async () => {
      try {
        const stored = await AsyncStorage.getItem(weightManagerStorageKey);
        if (!stored) {
          const fallback = {
            weightUnit: profile?.weightManagerUnit || DEFAULT_WEIGHT_MANAGER_UNIT,
            currentWeight: profile?.weightManagerCurrentWeight,
            targetWeight: profile?.weightManagerTargetWeight,
            currentBodyType: profile?.weightManagerCurrentBodyType,
            targetBodyType: profile?.weightManagerTargetBodyType,
          };
          const hasFallback = Object.values(fallback).some(
            (value) => value !== null && value !== undefined && value !== ''
          );
          if (isMounted) setWeightManagerState(hasFallback ? fallback : null);
          return;
        }
        const parsed = JSON.parse(stored);
        if (isMounted) setWeightManagerState(parsed || null);
      } catch (err) {
        console.log('Error loading weight manager state:', err);
      }
    };

    loadWeightManagerState();
    const unsubscribe = navigation.addListener('focus', loadWeightManagerState);
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [
    navigation,
    profile?.weightManagerCurrentBodyType,
    profile?.weightManagerCurrentWeight,
    profile?.weightManagerTargetBodyType,
    profile?.weightManagerTargetWeight,
    profile?.weightManagerUnit,
    weightManagerStorageKey,
  ]);

  const [isLookingUpBarcode, setIsLookingUpBarcode] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [calorieGoalInput, setCalorieGoalInput] = useState('');
  const [proteinGoalInput, setProteinGoalInput] = useState('');
  const [carbsGoalInput, setCarbsGoalInput] = useState('');
  const [fatGoalInput, setFatGoalInput] = useState('');
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [healthSwipeIndex, setHealthSwipeIndex] = useState(0);
  const [foodGramsEaten, setFoodGramsEaten] = useState('');
  const [foodBasis, setFoodBasis] = useState(null);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMoodIndex, setSelectedMoodIndex] = useState(null);
  const heroScale = useRef(new Animated.Value(1)).current;
  const moodButtonScalesRef = useRef(
    MOOD_OPTIONS.map(() => new Animated.Value(1))
  );
  const restoreFoodModalRef = useRef(false);
  const lastMoodIndexRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [waterInput, setWaterInput] = useState('');
  const [sleepForm, setSleepForm] = useState({
    sleepTime: null,
    wakeTime: null,
    sleepQuality: null,
  });
  const [isSavingSleep, setIsSavingSleep] = useState(false);
  const [weightManagerState, setWeightManagerState] = useState(null);

  const sleepQualities = ['Excellent', 'Good', 'Fair', 'Poor'];

  const handleLogWater = async () => {
    const amount = parseFloat(waterInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Enter litres', 'Please enter a positive amount in litres (e.g., 0.25).');
      return;
    }

    try {
      await updateTodayHealth({ waterIntakeDelta: amount });
      setWaterInput('');
    } catch (err) {
      console.log('Error logging water', err);
      Alert.alert('Unable to log water', 'Please try again.');
    }
  };

  const handleSleepQualitySelect = (quality) => {
    setSleepForm((prev) => ({ ...prev, sleepQuality: quality }));
  };

  const moodOptions = MOOD_OPTIONS.map((option, idx) => ({
    ...option,
    ...(MOOD_THEMES[idx] || {
      accent: colors.primary,
      background: colors.primaryLight,
      gradient: [colors.primaryLight, colors.primary],
    }),
  }));

  const [showSleepTimePicker, setShowSleepTimePicker] = useState(false);
  const [sleepTimeTarget, setSleepTimeTarget] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions
    ? useCameraPermissions()
    : [null, null];

  const openSleepTimePicker = (target) => {
    setSleepTimeTarget(target);
    setShowSleepTimePicker(true);
  };

  const closeSleepTimePicker = () => {
    setShowSleepTimePicker(false);
    setSleepTimeTarget(null);
  };

  const handleSelectSleepTime = (value) => {
    const normalized =
      value instanceof Date ? formatTimeFromDate(value) : value;
    if (sleepTimeTarget === 'sleep') {
      setSleepForm((prev) => ({ ...prev, sleepTime: normalized }));
    }
    if (sleepTimeTarget === 'wake') {
      setSleepForm((prev) => ({ ...prev, wakeTime: normalized }));
    }
  };

  const handleSubmitSleepLog = async () => {
    if (!sleepForm.sleepTime || !sleepForm.wakeTime || !sleepForm.sleepQuality) {
      return;
    }
    setIsSavingSleep(true);
    try {
      await updateHealthForDate(selectedDateISO, {
        sleepTime: sleepForm.sleepTime,
        wakeTime: sleepForm.wakeTime,
        sleepQuality: sleepForm.sleepQuality,
      });
    } catch (err) {
      console.log('Error saving sleep log', err);
    } finally {
      setIsSavingSleep(false);
    }
  };

  const parseGoalValue = (value, allowFloat = false) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = allowFloat ? parseFloat(trimmed) : parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
    return parsed;
  };

  const handleSaveNutritionGoals = async () => {
    const caloriesGoal = parseGoalValue(calorieGoalInput, false);
    if (Number.isNaN(caloriesGoal)) {
      Alert.alert('Enter calories', 'Please enter a positive number.');
      return;
    }

    const proteinGoal = parseGoalValue(proteinGoalInput, true);
    if (Number.isNaN(proteinGoal)) {
      Alert.alert('Enter protein', 'Please enter a positive number.');
      return;
    }

    const carbsGoal = parseGoalValue(carbsGoalInput, true);
    if (Number.isNaN(carbsGoal)) {
      Alert.alert('Enter carbs', 'Please enter a positive number.');
      return;
    }

    const fatGoal = parseGoalValue(fatGoalInput, true);
    if (Number.isNaN(fatGoal)) {
      Alert.alert('Enter fat', 'Please enter a positive number.');
      return;
    }

    try {
      setIsSavingGoals(true);
      await updateHealthForDate(selectedDateISO, {
        calorieGoal: caloriesGoal,
        proteinGoal,
        carbsGoal,
        fatGoal,
      });
      setShowGoalModal(false);
    } catch (err) {
      console.log('Error updating nutrition goals', err);
      Alert.alert('Unable to update goals', 'Please try again.');
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleClearNutritionGoals = async () => {
    try {
      setIsSavingGoals(true);
      await updateHealthForDate(selectedDateISO, {
        calorieGoal: null,
        proteinGoal: null,
        carbsGoal: null,
        fatGoal: null,
      });
      setShowGoalModal(false);
    } catch (err) {
      console.log('Error resetting nutrition goals', err);
      Alert.alert('Unable to reset goals', 'Please try again.');
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleCancelNutritionGoals = () => {
    const goal = Number.isFinite(selectedHealth.calorieGoal)
      ? selectedHealth.calorieGoal
      : defaultCalorieGoal;
    const proteinGoal = Number.isFinite(selectedHealth.proteinGoal)
      ? selectedHealth.proteinGoal
      : null;
    const carbsGoal = Number.isFinite(selectedHealth.carbsGoal)
      ? selectedHealth.carbsGoal
      : null;
    const fatGoal = Number.isFinite(selectedHealth.fatGoal)
      ? selectedHealth.fatGoal
      : null;
    setCalorieGoalInput(goal ? String(goal) : '');
    setProteinGoalInput(proteinGoal !== null ? String(proteinGoal) : '');
    setCarbsGoalInput(carbsGoal !== null ? String(carbsGoal) : '');
    setFatGoalInput(fatGoal !== null ? String(fatGoal) : '');
    setShowGoalModal(false);
  };

  const handleSwipeEnd = (event) => {
    if (!swipeCardWidth) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / swipeCardWidth);
    setHealthSwipeIndex(nextIndex);
  };

  const handleLogFood = async () => {
    if (!foodName.trim()) return;

    const toNumberOrNull = (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = value.toString().trim();
      if (trimmed === '') return null;
      const parsed = parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const gramsEaten = toNumberOrNull(foodGramsEaten);
    const caloriesValue = toNumberOrNull(foodCalories);
    const proteinValue = toNumberOrNull(foodProtein);
    const carbsValue = toNumberOrNull(foodCarbs);
    const fatValue = toNumberOrNull(foodFat);

    const shouldScale =
      foodBasis === '100g' && Number.isFinite(gramsEaten) && gramsEaten > 0;
    const scale = shouldScale ? gramsEaten / 100 : 1;

    const scaleMacro = (value) => {
      if (value === null || value === undefined) return null;
      if (!shouldScale) return value;
      const scaled = value * scale;
      return Number.isFinite(scaled) ? Math.round(scaled * 10) / 10 : null;
    };

    const caloriesNumber = caloriesValue ?? 0;
    const scaledCalories = shouldScale
      ? Math.round(caloriesNumber * scale)
      : caloriesNumber;

    await addFoodEntryForDate(selectedDateISO, {
      name: foodName.trim(),
      calories: scaledCalories,
      proteinGrams: scaleMacro(proteinValue),
      carbsGrams: scaleMacro(carbsValue),
      fatGrams: scaleMacro(fatValue),
    });

    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
    setFoodGramsEaten('');
    setFoodBasis(null);
    setShowFoodModal(false);
  };

  const applyScannedFood = (payload) => {
    if (!payload) return;
    setFoodBasis(payload.basis || null);
    setFoodGramsEaten('');
    if (payload.name) setFoodName(payload.name);
    if (payload.calories !== undefined && payload.calories !== null) {
      setFoodCalories(String(payload.calories));
    }
    if (payload.proteinGrams !== undefined && payload.proteinGrams !== null) {
      setFoodProtein(String(payload.proteinGrams));
    }
    if (payload.carbsGrams !== undefined && payload.carbsGrams !== null) {
      setFoodCarbs(String(payload.carbsGrams));
    }
    if (payload.fatGrams !== undefined && payload.fatGrams !== null) {
      setFoodFat(String(payload.fatGrams));
    }
  };

  const handleBarCodeScanned = async ({ data, type }) => {
  if (isLookingUpBarcode) return;

  setHasScanned(true);
  setIsLookingUpBarcode(true);
  setScannerMessage('Looking up product…');

  try {
    const match = await lookupFoodByBarcode(data, { localMap: BARCODE_FOOD_MAP });

    if (match) {
      applyScannedFood(match);

      // Optional: show whether values are per serving or per 100g
      const basisNote =
        match.source === 'openfoodfacts'
          ? ` (per ${match.basis}${match.servingSize ? ` • ${match.servingSize}` : ''})`
          : '';

      setScannerMessage(`Food details added${basisNote}.`);
      setShowScannerModal(false);
      if (restoreFoodModalRef.current) {
        restoreFoodModalRef.current = false;
        setTimeout(() => setShowFoodModal(true), 0);
      }

      // reset scan lock for next time
      setHasScanned(false);
      return;
    }

    setScannerMessage(
      'No product found for that barcode. Try another item or fill manually.'
    );
    setTimeout(() => setHasScanned(false), 1200);
  } catch (err) {
    console.log('Barcode lookup error:', err);
    setScannerMessage('Lookup failed (network/API). Please try again.');
    setTimeout(() => setHasScanned(false), 1200);
  } finally {
    setIsLookingUpBarcode(false);
  }
};


  const handleOpenScanner = async () => {
    setScannerMessage('');
    setHasScanned(false);
    restoreFoodModalRef.current = showFoodModal;
    if (showFoodModal) {
      setShowFoodModal(false);
      setTimeout(() => setShowScannerModal(true), 0);
    } else {
      setShowScannerModal(true);
    }
    if (!CameraView) {
      Alert.alert(
        'Scanner unavailable',
        'Camera module is missing. Please install expo-camera with "npx expo install expo-camera" and restart.'
      );
      return;
    }
    try {
      let permission = cameraPermission;
      if (permission?.granted !== true) {
        if (typeof requestCameraPermission === 'function') {
          permission = await requestCameraPermission();
        } else if (typeof Camera?.requestCameraPermissionsAsync === 'function') {
          permission = await Camera.requestCameraPermissionsAsync();
        }
      }

      if (!permission || permission.granted !== true) {
        Alert.alert('Camera permission needed', 'Please enable camera access to scan barcodes.');
        setScannerMessage('Camera permission is required to scan barcodes.');
        return;
      }
    } catch (err) {
      setScannerMessage('Unable to access camera for scanning.');
    }
  };

  const handleCloseScanner = () => {
    setShowScannerModal(false);
    setHasScanned(false);
    setScannerMessage('');
    if (restoreFoodModalRef.current) {
      restoreFoodModalRef.current = false;
      setTimeout(() => setShowFoodModal(true), 0);
    }
  };

  const selectedDateISO = selectedDate.toISOString().slice(0, 10);
  const selectedDateKey = selectedDateISO;
  const emptyDay = {
    mood: null,
    waterIntake: 0,
    sleepTime: null,
    wakeTime: null,
    sleepQuality: null,
    calorieGoal: null,
    proteinGoal: null,
    carbsGoal: null,
    fatGoal: null,
    calories: 0,
    foods: [],
  };
  const selectedHealthRaw = healthData[selectedDateKey] || {};
  const selectedHealth = {
    ...emptyDay,
    ...selectedHealthRaw,
    foods: Array.isArray(selectedHealthRaw.foods) ? selectedHealthRaw.foods : [],
  };
  const defaultCalorieGoal = Math.max(0, Number(profile.dailyCalorieGoal) || 0);
  const dailyCalorieGoal = Number.isFinite(selectedHealth.calorieGoal)
    ? selectedHealth.calorieGoal
    : defaultCalorieGoal;

  useEffect(() => {
    setSleepForm({
      sleepTime: selectedHealth.sleepTime,
      wakeTime: selectedHealth.wakeTime,
      sleepQuality: selectedHealth.sleepQuality,
    });
  }, [
    selectedDateKey,
    selectedHealth.sleepTime,
    selectedHealth.wakeTime,
    selectedHealth.sleepQuality,
  ]);

  useEffect(() => {
    const goal = Number.isFinite(selectedHealth.calorieGoal)
      ? selectedHealth.calorieGoal
      : defaultCalorieGoal;
    setCalorieGoalInput(goal ? String(goal) : '');
    const proteinGoal = Number.isFinite(selectedHealth.proteinGoal)
      ? selectedHealth.proteinGoal
      : null;
    const carbsGoal = Number.isFinite(selectedHealth.carbsGoal)
      ? selectedHealth.carbsGoal
      : null;
    const fatGoal = Number.isFinite(selectedHealth.fatGoal)
      ? selectedHealth.fatGoal
      : null;
    setProteinGoalInput(proteinGoal !== null ? String(proteinGoal) : '');
    setCarbsGoalInput(carbsGoal !== null ? String(carbsGoal) : '');
    setFatGoalInput(fatGoal !== null ? String(fatGoal) : '');
  }, [
    selectedDateKey,
    selectedHealth.calorieGoal,
    selectedHealth.proteinGoal,
    selectedHealth.carbsGoal,
    selectedHealth.fatGoal,
    defaultCalorieGoal,
  ]);

  useEffect(() => {
    setShowGoalModal(false);
  }, [selectedDateKey]);

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

  const sleepDurationHours = getSleepDurationHours(
    selectedHealth.sleepTime,
    selectedHealth.wakeTime
  );

  const todayWaterLitres = Number(todayHealth.waterIntake) || 0;
  const normalizedWaterGoal = Math.max(0, Number(profile.dailyWaterGoal) || 0);
  const waterProgress = normalizedWaterGoal
    ? Math.min(1, todayWaterLitres / normalizedWaterGoal)
    : 0;
  const waterValueColor = healthTheme.stats.water.value;
  const sleepValueColor = healthTheme.stats.sleep.value;
  const caloriesConsumed = selectedHealth.calories || 0;
  const caloriesRemaining = dailyCalorieGoal - caloriesConsumed;
  const weightManagerUnit = weightManagerState?.weightUnit || DEFAULT_WEIGHT_MANAGER_UNIT;
  const weightManagerPlan = useMemo(
    () =>
      computeWeightManagerPlan({
        currentWeight: weightManagerState?.currentWeight,
        targetWeight: weightManagerState?.targetWeight,
        unit: weightManagerUnit,
        currentBodyTypeKey: weightManagerState?.currentBodyType,
        targetBodyTypeKey: weightManagerState?.targetBodyType,
      }),
    [
      weightManagerState?.currentBodyType,
      weightManagerState?.currentWeight,
      weightManagerState?.targetBodyType,
      weightManagerState?.targetWeight,
      weightManagerUnit,
    ]
  );
  const weightManagerTargetBody = useMemo(
    () =>
      WEIGHT_MANAGER_BODY_TYPES.find(
        (type) => type.key === weightManagerState?.targetBodyType
      ),
    [weightManagerState?.targetBodyType]
  );
  const weightManagerLatestLog = useMemo(
    () => (weightManagerLogs?.length ? weightManagerLogs[0] : null),
    [weightManagerLogs]
  );
  const weightManagerEarliestLog = useMemo(() => {
    if (!weightManagerLogs?.length) return null;
    return weightManagerLogs[weightManagerLogs.length - 1];
  }, [weightManagerLogs]);
  const startingWeightValue = Number(weightManagerState?.currentWeight);
  const weightManagerStartingValue = Number.isFinite(startingWeightValue)
    ? { value: startingWeightValue, unit: weightManagerUnit }
    : Number.isFinite(weightManagerEarliestLog?.weight)
      ? {
          value: weightManagerEarliestLog.weight,
          unit: weightManagerEarliestLog.unit || weightManagerUnit,
        }
      : null;
  const weightManagerCurrentValue = Number.isFinite(weightManagerLatestLog?.weight)
    ? { value: weightManagerLatestLog.weight, unit: weightManagerLatestLog.unit || weightManagerUnit }
    : weightManagerStartingValue;
  const weightManagerStartingDisplay = weightManagerStartingValue
    ? `${weightManagerStartingValue.value} ${weightManagerStartingValue.unit}`
    : '--';
  const weightManagerCurrentDisplay = weightManagerCurrentValue
    ? `${weightManagerCurrentValue.value} ${weightManagerCurrentValue.unit}`
    : '--';
  const weightManagerTargetDisplay = weightManagerState?.targetWeight
    ? `${weightManagerState.targetWeight} ${weightManagerUnit}`
    : '--';
  const macroTotals = (selectedHealth.foods || []).reduce(
    (totals, food) => ({
      protein: totals.protein + (Number(food.proteinGrams) || 0),
      carbs: totals.carbs + (Number(food.carbsGrams) || 0),
      fat: totals.fat + (Number(food.fatGrams) || 0),
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );
  const macroGoals = {
    protein: Number.isFinite(selectedHealth.proteinGoal) ? selectedHealth.proteinGoal : null,
    carbs: Number.isFinite(selectedHealth.carbsGoal) ? selectedHealth.carbsGoal : null,
    fat: Number.isFinite(selectedHealth.fatGoal) ? selectedHealth.fatGoal : null,
  };
  const macroRemaining = {
    protein:
      macroGoals.protein !== null ? Math.max(macroGoals.protein - macroTotals.protein, 0) : null,
    carbs:
      macroGoals.carbs !== null ? Math.max(macroGoals.carbs - macroTotals.carbs, 0) : null,
    fat: macroGoals.fat !== null ? Math.max(macroGoals.fat - macroTotals.fat, 0) : null,
  };
  const hasMacroGoals = Object.values(macroGoals).some((value) => value !== null);
  const remainingRatio = dailyCalorieGoal
    ? Math.max(0, caloriesRemaining) / dailyCalorieGoal
    : 1;
  const calorieCircleSize = 120;
  const getRemainingColor = () => {
    if (remainingRatio > 0.6) return colors.success;
    if (remainingRatio > 0.3) return colors.warning;
    return colors.danger;
  };

  const currentMoodIndex = () => {
    if (typeof selectedHealth.mood === 'number') {
      return Math.min(moodOptions.length - 1, Math.max(0, selectedHealth.mood - 1));
    }
    return 6;
  };

  const activeMoodIndex = selectedMoodIndex ?? currentMoodIndex();
  const activeMood =
    moodOptions[activeMoodIndex] || moodOptions[6] || moodOptions[0];
  const moodAccent = activeMood.accent;
  const moodGradient = activeMood.gradient;
  const moodBackgroundGradient =
    activeMood.backgroundGradient || [activeMood.background, '#FFFFFF'];
  const moodBackground = moodBackgroundGradient[0];

  useEffect(() => {
    heroScale.setValue(1);
    Animated.sequence([
      Animated.timing(heroScale, {
        toValue: 1.06,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(heroScale, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeMoodIndex, heroScale]);

  const openMoodPicker = () => {
    const initialIndex = currentMoodIndex();
    setSelectedMoodIndex(initialIndex);
    lastMoodIndexRef.current = initialIndex;
    setShowMoodModal(true);
  };

  const handleMoodSelect = (idx) => {
    setSelectedMoodIndex(idx);
    const scale = moodButtonScalesRef.current[idx];
    if (scale) {
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
    if (
      lastMoodIndexRef.current !== null &&
      lastMoodIndexRef.current !== idx
    ) {
      const previousScale =
        moodButtonScalesRef.current[lastMoodIndexRef.current];
      if (previousScale) {
        Animated.timing(previousScale, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }
    }
    lastMoodIndexRef.current = idx;
  };

  useEffect(() => {
    if (route.params?.openMoodPicker) {
      openMoodPicker();
      navigation.setParams({ openMoodPicker: false });
    }
  }, [navigation, route.params?.openMoodPicker]);

  const handleMoodSave = async () => {
    const idx = typeof selectedMoodIndex === 'number' ? selectedMoodIndex : currentMoodIndex();
    await updateHealthForDate(selectedDateISO, { mood: idx + 1 });
    setShowMoodModal(false);
  };

  const formatMacroValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value}g`;
  };

  const formatMacroRemainingValue = (value) => {
    if (value === null || value === undefined) return '--';
    const rounded = Math.round(Number(value));
    if (!Number.isFinite(rounded)) return '--';
    return `${Math.max(0, rounded)}g`;
  };

  const formatMacroGoals = (health) => {
    const proteinGoal = Number.isFinite(health.proteinGoal) ? health.proteinGoal : null;
    const carbsGoal = Number.isFinite(health.carbsGoal) ? health.carbsGoal : null;
    const fatGoal = Number.isFinite(health.fatGoal) ? health.fatGoal : null;
    const hasAnyGoal = [proteinGoal, carbsGoal, fatGoal].some((g) => g !== null);
    if (!hasAnyGoal) return 'Not set';

    const formatGoal = (value, label) =>
      `${label} ${Number.isFinite(value) ? `${value}g` : '--'}`;
    return [
      formatGoal(proteinGoal, 'P'),
      formatGoal(carbsGoal, 'C'),
      formatGoal(fatGoal, 'F'),
    ].join(' • ');
  };

  const getDailyHealthTip = ({ caloriesRemainingValue, dailyGoal, macroRemainders, dateKey }) => {
    if (!dailyGoal) {
      return 'Set a calorie goal to get a daily tip.';
    }
    if (caloriesRemainingValue <= 0) {
      return 'You are at your calorie goal. Keep it light and hydrate.';
    }
    if (caloriesRemainingValue < 200) {
      return 'Keep the rest of the day light: lean protein and veggies.';
    }

    const macroPriority = [
      { key: 'protein', value: macroRemainders.protein, label: 'protein' },
      { key: 'carbs', value: macroRemainders.carbs, label: 'carbs' },
      { key: 'fat', value: macroRemainders.fat, label: 'healthy fats' },
    ].filter((item) => item.value !== null);

    if (macroPriority.length > 0) {
      const top = macroPriority.reduce((best, item) =>
        best.value >= item.value ? best : item
      );
      if (top.value > 0) {
        return `Focus on ${top.label} to stay on track today.`;
      }
    }

    const tips = [
      'Plan your next meal with whole foods to stay on target.',
      'Add color to your plate with veggies or fruit.',
      'Keep a steady pace with smaller, balanced meals.',
      'Pair carbs with protein for steady energy.',
      'Prep a simple snack so you do not overshoot later.',
    ];
    const seed = (dateKey || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const index = tips.length ? seed % tips.length : 0;
    return tips[index] || tips[0];
  };

  const formatWeightManagerMacro = (value) => {
    if (!Number.isFinite(value)) return '--';
    return `${value} g`;
  };

  const renderWeightManagerBodyType = () => {
    const accent = healthTheme.calorie.title;
    if (!weightManagerTargetBody) {
      return (
        <View style={[styles.weightManagerBodyPlaceholder, { borderColor: accent }]}>
          <Text style={[styles.weightManagerBodyPlaceholderText, { color: accent }]}>?</Text>
        </View>
      );
    }

    const silhouette = weightManagerTargetBody.silhouette || {};
    const scale = 0.6;
    const widthFor = (value, fallback) => Math.max(18, Math.round((value || fallback) * scale));

    return (
      <View style={styles.weightManagerBodyPreview}>
        <View style={[styles.weightManagerBodyHead, { backgroundColor: accent }]} />
        <View
          style={[
            styles.weightManagerBodyShoulders,
            { backgroundColor: accent, width: widthFor(silhouette.shoulders, 40) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyTorso,
            { backgroundColor: accent, width: widthFor(silhouette.torso, 32) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyWaist,
            { backgroundColor: accent, width: widthFor(silhouette.waist, 28) },
          ]}
        />
        <View
          style={[
            styles.weightManagerBodyLegs,
            { backgroundColor: accent, width: widthFor(silhouette.waist, 28) },
          ]}
        />
      </View>
    );
  };

  const formatWaterLitres = (value) => {
    const num = Math.round((Number(value) || 0) * 100) / 100;
    return `${num}`;
  };

  const macroRemainingText = hasMacroGoals
    ? `P ${formatMacroRemainingValue(macroRemaining.protein)} | C ${formatMacroRemainingValue(macroRemaining.carbs)} | F ${formatMacroRemainingValue(macroRemaining.fat)}`
    : 'Set macro goals to see what is left.';

  const healthTip = getDailyHealthTip({
    caloriesRemainingValue: caloriesRemaining,
    dailyGoal: dailyCalorieGoal,
    macroRemainders: macroRemaining,
    dateKey: selectedDateISO,
  });

  const cardWidthStyle = swipeCardWidth ? { width: swipeCardWidth } : null;
  const swipeCardStyle = swipeCardWidth ? styles.swipeCard : null;
  const upgradeBadgeColor = themeColors.warning || colors.warning;

  const handleWeightManagerPress = () => {
    if (isWeightManagerLocked) {
      navigation.navigate('Paywall', { source: 'weight-manager' });
      return;
    }
    navigation.navigate('WeightManager');
  };

  const calorieTrackerCard = (
    <Card
      style={[
        styles.sectionCard,
        styles.calorieCard,
        swipeCardStyle,
        cardWidthStyle,
        {
          backgroundColor: healthTheme.calorie.card,
          borderColor: healthTheme.calorie.border,
        },
      ]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: healthTheme.calorie.title }]}>
          Calorie Tracker
        </Text>
        <TouchableOpacity
          onPress={() => setShowGoalModal(true)}
          style={[
            styles.calorieEditButton,
            { backgroundColor: healthTheme.calorie.ringBg },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={healthTheme.calorie.title}
            style={styles.calorieEditIcon}
          />
          <Text style={[styles.calorieEditText, { color: healthTheme.calorie.title }]}>
            Edit
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.calorieRow}>
        <View style={styles.calorieLeft}>
          <View style={styles.calorieStat}>
            <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
              Daily Goal
            </Text>
            <Text style={[styles.calorieValue, { color: healthTheme.calorie.goal }]}>
              {dailyCalorieGoal} cal
            </Text>
          </View>
          <View style={styles.calorieStat}>
            <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
              Consumed
            </Text>
            <Text style={[styles.calorieValue, { color: healthTheme.calorie.consumed }]}>
              {caloriesConsumed} cal
            </Text>
          </View>
        </View>
        <View style={styles.calorieRight}>
          <View
            style={[
              styles.remainingCircle,
              {
                width: calorieCircleSize,
                height: calorieCircleSize,
                borderColor: healthTheme.calorie.ring,
                backgroundColor: healthTheme.calorie.ringBg,
              },
            ]}
          >
            <Text
              style={[
                styles.remainingText,
                { color: healthTheme.calorie.ring },
              ]}
            >
              {Math.max(caloriesRemaining, 0)} cal
            </Text>
            <Text style={[styles.remainingSub, { color: healthTheme.calorie.ring }]}>
              Remaining
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.macroGoalSummary}>
        <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
          Macro goals
        </Text>
        <Text style={[styles.calorieValue, { color: healthTheme.calorie.goal }]}>
          {formatMacroGoals(selectedHealth)}
        </Text>
      </View>
      <View style={styles.macroRemainingSummary}>
        <Text style={[styles.calorieLabel, { color: healthTheme.calorie.label }]}>
          Macros left
        </Text>
        <Text style={[styles.calorieValue, { color: healthTheme.calorie.goal }]}>
          {macroRemainingText}
        </Text>
      </View>
      <View
        style={[
          styles.healthTip,
          { backgroundColor: healthTheme.calorie.ringBg },
        ]}
      >
        <Text style={[styles.healthTipLabel, { color: healthTheme.calorie.label }]}>
          Tip
        </Text>
        <Text style={[styles.healthTipText, { color: healthTheme.calorie.title }]}>
          {healthTip}
        </Text>
      </View>
    </Card>
  );

  const weightManagerCard = (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleWeightManagerPress}
    >
      <Card
        style={[
          styles.sectionCard,
          styles.weightManagerCard,
          styles.swipeCard,
          cardWidthStyle,
          {
            backgroundColor: healthTheme.calorie.card,
            borderColor: healthTheme.calorie.border,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: healthTheme.calorie.title }]}>
            Weight Manager
          </Text>
          <View
            style={[
              styles.weightManagerBadge,
              isWeightManagerLocked && { backgroundColor: upgradeBadgeColor },
            ]}
          >
            <Ionicons
              name={isWeightManagerLocked ? 'lock-closed' : 'star'}
              size={12}
              color="#FFFFFF"
              style={styles.weightManagerBadgeIcon}
            />
            <Text style={styles.weightManagerBadgeText}>
              {isWeightManagerLocked ? 'Upgrade to Premium' : 'Premium'}
            </Text>
          </View>
        </View>
        <Text style={[styles.weightManagerSubtitle, { color: healthTheme.calorie.label }]}>
          {weightManagerTargetBody?.label
            ? `Target: ${weightManagerTargetBody.label}`
            : 'Set your target body type'}
        </Text>

        {!weightManagerPlan && (
          <Text style={[styles.weightManagerEmpty, { color: healthTheme.calorie.label }]}>
            Add your current and target weights to unlock daily targets.
          </Text>
        )}

        <View style={styles.weightManagerRow}>
          <View style={styles.weightManagerWeights}>
            <View style={styles.weightManagerTypeRow}>
              {renderWeightManagerBodyType()}
              <View style={styles.weightManagerTypeText}>
                <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                  Target type
                </Text>
                <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                  {weightManagerTargetBody?.label || '--'}
                </Text>
              </View>
            </View>
            <View style={styles.weightManagerStat}>
              <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                Starting
              </Text>
              <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                {weightManagerStartingDisplay}
              </Text>
            </View>
            <View style={styles.weightManagerStat}>
              <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                Current
              </Text>
              <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                {weightManagerCurrentDisplay}
              </Text>
            </View>
            <View style={styles.weightManagerStat}>
              <Text style={[styles.weightManagerLabel, { color: healthTheme.calorie.label }]}>
                Target
              </Text>
              <Text style={[styles.weightManagerValue, { color: healthTheme.calorie.title }]}>
                {weightManagerTargetDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.weightManagerTarget}>
            <View
              style={[
                styles.weightManagerTargetRing,
                {
                  borderColor: healthTheme.calorie.ring,
                  backgroundColor: healthTheme.calorie.ringBg,
                },
              ]}
            >
              <Text style={[styles.weightManagerTargetValue, { color: healthTheme.calorie.ring }]}>
                {weightManagerPlan?.targetCalories ?? '--'}
              </Text>
              <Text style={[styles.weightManagerTargetLabel, { color: healthTheme.calorie.label }]}>
                cal/day
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.weightManagerMacroRow,
            { backgroundColor: healthTheme.calorie.ringBg },
          ]}
        >
          <View style={styles.weightManagerMacroItem}>
            <Text style={[styles.weightManagerMacroLabel, { color: healthTheme.calorie.label }]}>
              Protein
            </Text>
            <Text style={[styles.weightManagerMacroValue, { color: healthTheme.calorie.title }]}>
              {formatWeightManagerMacro(weightManagerPlan?.proteinGrams)}
            </Text>
          </View>
          <View style={styles.weightManagerMacroItem}>
            <Text style={[styles.weightManagerMacroLabel, { color: healthTheme.calorie.label }]}>
              Carbs
            </Text>
            <Text style={[styles.weightManagerMacroValue, { color: healthTheme.calorie.title }]}>
              {formatWeightManagerMacro(weightManagerPlan?.carbsGrams)}
            </Text>
          </View>
          <View style={styles.weightManagerMacroItem}>
            <Text style={[styles.weightManagerMacroLabel, { color: healthTheme.calorie.label }]}>
              Fat
            </Text>
            <Text style={[styles.weightManagerMacroValue, { color: healthTheme.calorie.title }]}>
              {formatWeightManagerMacro(weightManagerPlan?.fatGrams)}
            </Text>
          </View>
        </View>

        <View style={styles.weightManagerFooter}>
          <Text style={[styles.weightManagerAction, { color: healthTheme.calorie.title }]}>
            Tap to update your plan
          </Text>
          <Ionicons name="chevron-forward" size={18} color={healthTheme.calorie.title} />
        </View>
        {isWeightManagerLocked && (
          <View pointerEvents="none" style={styles.weightManagerLockOverlay}>
            <View style={styles.weightManagerLockScrim} />
            <View style={styles.weightManagerLockContent}>
              <Ionicons name="lock-closed" size={22} color={healthTheme.calorie.title} />
              <Text style={[styles.weightManagerLockTitle, { color: healthTheme.calorie.title }]}>
                Upgrade to Premium
              </Text>
              <Text style={[styles.weightManagerLockSubtitle, { color: healthTheme.calorie.label }]}>
                Unlock weight targets and daily macro goals.
              </Text>
            </View>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: healthTheme.background },
      ]}
    >
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showSleepTimePicker}
      >
        <View style={styles.dateSwitcher}>
          <TouchableOpacity
            style={styles.dateSwitchButton}
            onPress={() => setSelectedDate((prev) => {
              const d = new Date(prev);
              d.setDate(prev.getDate() - 1);
              return d;
            })}
          >
            <Ionicons name="chevron-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>
            {selectedDate.toDateString() === new Date().toDateString()
              ? 'Today'
              : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.dateSwitchButton}
            onPress={() => setSelectedDate((prev) => {
              const d = new Date(prev);
              d.setDate(prev.getDate() + 1);
              return d;
            })}
          >
            <Ionicons name="chevron-forward" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card
            style={[
              styles.statCard,
              {
                backgroundColor: healthTheme.stats.water.card,
                borderColor: healthTheme.stats.water.border,
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: healthTheme.stats.water.iconBg },
              ]}
            >
              <Ionicons name="water" size={18} color={healthTheme.stats.water.iconColor} />
            </View>
            <Text style={[styles.statLabel, { color: healthTheme.stats.water.label }]}>
              Avg Water
            </Text>
            <Text style={[styles.statValue, { color: waterValueColor }]}>
              {formatWaterLitres(getAverageWater())} L
            </Text>
            <Text style={[styles.statGoal, { color: healthTheme.stats.water.goal }]}>
              Over 7 days
            </Text>
          </Card>
          <Card
            style={[
              styles.statCard,
              {
                backgroundColor: healthTheme.stats.sleep.card,
                borderColor: healthTheme.stats.sleep.border,
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: healthTheme.stats.sleep.iconBg },
              ]}
            >
              <Ionicons name="moon" size={18} color={healthTheme.stats.sleep.iconColor} />
            </View>
            <Text style={[styles.statLabel, { color: healthTheme.stats.sleep.label }]}>
              Avg Sleep
            </Text>
            <Text style={[styles.statValue, { color: sleepValueColor }]}>
              {getAverageSleep()} hours
            </Text>
            <Text style={[styles.statGoal, { color: healthTheme.stats.sleep.goal }]}>
              Goal: {profile.dailySleepGoal} hours/night
            </Text>
          </Card>
        </View>

        {/* Calorie Tracker Section */}
        <View style={[styles.swipeSection, { width: swipeCardWidth }]}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleSwipeEnd}
            scrollEventThrottle={16}
            style={{ width: swipeCardWidth }}
          >
            {calorieTrackerCard}
            {weightManagerCard}
          </Animated.ScrollView>
          <View style={styles.swipeDots}>
            <View
              style={[
                styles.swipeDot,
                healthSwipeIndex === 0 && styles.swipeDotActive,
              ]}
            />
            <View
              style={[
                styles.swipeDot,
                healthSwipeIndex === 1 && styles.swipeDotActive,
              ]}
            />
          </View>
        </View>

        {/* Food Section */}
        <Card
          style={[
            styles.sectionCard,
            {
              backgroundColor: healthTheme.food.card,
              borderColor: healthTheme.food.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: healthTheme.food.title }]}>
            Food for{' '}
            {selectedDate.toDateString() === new Date().toDateString()
              ? 'Today'
              : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
          {selectedHealth.foods && selectedHealth.foods.length > 0 ? (
            <View style={styles.foodList}>
              {selectedHealth.foods.map((food, idx) => (
                <View
                  key={food.id || food.timestamp || `${food.name}-${idx}`}
                  style={[
                    styles.foodItem,
                    {
                      backgroundColor: healthTheme.food.itemBg,
                      borderColor: healthTheme.food.itemBorder,
                    },
                  ]}
                >
                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName}>{food.name}</Text>
                    <Text style={[styles.foodCal, { color: healthTheme.food.title }]}>
                      {food.calories} cal
                    </Text>
                    <Text style={styles.foodMacros}>
                      Protein: {formatMacroValue(food.proteinGrams)} | Carbs: {formatMacroValue(food.carbsGrams)} | Fat: {formatMacroValue(food.fatGrams)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const updatedFoods = (selectedHealth.foods || []).filter(
                        (f) => f.id !== food.id
                      );
                      const totalCalories = updatedFoods.reduce(
                        (sum, f) => sum + (f.calories || 0),
                        0
                      );
                      deleteFoodEntryForDate(selectedDateISO, food.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.foodEmpty}>No food logged yet.</Text>
          )}

          <TouchableOpacity
            style={[
              styles.logFoodButton,
              { borderColor: healthTheme.food.buttonBorder },
            ]}
            onPress={() => setShowFoodModal(true)}
          >
            <Ionicons name="add" size={18} color={healthTheme.food.buttonText} />
            <Text style={[styles.logFoodText, { color: healthTheme.food.buttonText }]}>
              Log Food
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Mood Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: healthTheme.mood.card, borderColor: healthTheme.mood.border },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openMoodPicker}
            style={styles.moodTouchable}
          >
            <Text style={[styles.sectionTitle, { color: healthTheme.mood.title }]}>
              How are you feeling?
            </Text>
            {selectedHealth.mood ? (
              <View style={styles.moodSummary}>
                <Text style={styles.moodSummaryEmoji}>
                  {moodOptions[currentMoodIndex()].emoji}
                </Text>
                <Text style={styles.moodSummaryLabel}>
                  Today's mood
                </Text>
                <Text style={styles.moodHint}>Tap to change</Text>
              </View>
            ) : (
              <Text style={[styles.moodPlaceholder, { color: healthTheme.mood.text }]}>
                Check in your mood with us!
              </Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Sleep Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: healthTheme.sleep.card, borderColor: healthTheme.sleep.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: healthTheme.sleep.title }]}>Sleep</Text>
          <View style={styles.sleepInputRow}>
            <View style={styles.sleepInput}>
              <Text style={styles.sleepLabel}>Sleep Time</Text>
              <TouchableOpacity
                style={[
                  styles.timeButton,
                  {
                    backgroundColor: healthTheme.sleep.inputBg,
                    borderColor: healthTheme.sleep.inputBorder,
                  },
                ]}
                onPress={() => openSleepTimePicker('sleep')}
              >
                <Text style={styles.timeButtonText}>
                  {sleepForm.sleepTime || '--:--'}
                </Text>
                <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
              </TouchableOpacity>
            </View>
            <View style={styles.sleepInput}>
              <Text style={styles.sleepLabel}>Wake Time</Text>
              <TouchableOpacity
                style={[
                  styles.timeButton,
                  {
                    backgroundColor: healthTheme.sleep.inputBg,
                    borderColor: healthTheme.sleep.inputBorder,
                  },
                ]}
                onPress={() => openSleepTimePicker('wake')}
              >
                <Text style={styles.timeButtonText}>
                  {sleepForm.wakeTime || '--:--'}
                </Text>
                <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.sleepQualityRow}>
            {sleepQualities.map((quality) => (
              <TouchableOpacity
                key={quality}
                style={[
                  styles.qualityOption,
                  { backgroundColor: healthTheme.sleep.chipBg },
                  sleepForm.sleepQuality === quality && [
                    styles.qualityOptionActive,
                    { backgroundColor: healthTheme.sleep.chipActiveBg },
                  ],
                ]}
                onPress={() => handleSleepQualitySelect(quality)}
              >
                <Text
                  style={[
                    styles.qualityText,
                    { color: healthTheme.sleep.chipText },
                    sleepForm.sleepQuality === quality && [
                      styles.qualityTextActive,
                      { color: healthTheme.sleep.chipActiveText },
                    ],
                  ]}
                >
                  {quality}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button
            title={isSavingSleep ? 'Saving...' : 'Submit'}
            onPress={handleSubmitSleepLog}
            disabled={isSavingSleep || !sleepForm.sleepTime || !sleepForm.wakeTime || !sleepForm.sleepQuality}
            style={[
              styles.sleepSubmitButton,
              { backgroundColor: healthTheme.sleep.chipActiveBg },
            ]}
            textStyle={styles.sleepSubmitText}
          />
          {selectedHealth.sleepTime && selectedHealth.wakeTime && (
            <View style={styles.sleepLogContainer}>
              <Text style={styles.sleepLogTitle}>Logged Sleep</Text>
              <View
                style={[
                  styles.sleepLogCard,
                  {
                    backgroundColor: healthTheme.sleep.logBg,
                    borderColor: healthTheme.sleep.logBorder,
                  },
                ]}
              >
                <View style={styles.sleepLogRow}>
                  <Text style={styles.sleepLogLabel}>Sleep</Text>
                  <Text style={styles.sleepLogValue}>{selectedHealth.sleepTime}</Text>
                </View>
                <View style={styles.sleepLogRow}>
                  <Text style={styles.sleepLogLabel}>Wake</Text>
                  <Text style={styles.sleepLogValue}>{selectedHealth.wakeTime}</Text>
                </View>
                <View style={styles.sleepLogRow}>
                  <Text style={styles.sleepLogLabel}>Duration</Text>
                  <Text style={styles.sleepLogValue}>
                    {sleepDurationHours !== null ? `${sleepDurationHours} hrs` : '--'}
                  </Text>
                </View>
                <View style={styles.sleepLogRow}>
                  <Text style={styles.sleepLogLabel}>Quality</Text>
                  <Text style={styles.sleepLogValue}>{selectedHealth.sleepQuality || '--'}</Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        <PlatformTimePicker
          visible={showSleepTimePicker}
          value={sleepTimeTarget === 'sleep' ? sleepForm.sleepTime : sleepTimeTarget === 'wake' ? sleepForm.wakeTime : null}
          onChange={handleSelectSleepTime}
          onClose={closeSleepTimePicker}
          title="Select Time"
        />

        {/* Water Intake Section */}
        <Card
          style={[
            styles.sectionCard,
            styles.lastCard,
            { backgroundColor: healthTheme.water.card, borderColor: healthTheme.water.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: healthTheme.water.title }]}>Water Intake</Text>
            <Text style={[styles.waterCount, { color: healthTheme.water.count }]}>
              {formatWaterLitres(todayWaterLitres)} / {formatWaterLitres(normalizedWaterGoal)} L
            </Text>
          </View>
          <View style={styles.waterSummaryRow}>
            <Text style={styles.waterSummaryLabel}>Today's total</Text>
            <Text style={[styles.waterSummaryValue, { color: healthTheme.water.count }]}>
              {formatWaterLitres(todayWaterLitres)} L
            </Text>
          </View>
          <View style={[styles.waterProgressBar, { backgroundColor: healthTheme.water.progressBg }]}>
            <View
              style={[
                styles.waterProgressFill,
                { backgroundColor: healthTheme.water.progressFill },
                { width: `${Math.min(100, Math.max(0, waterProgress * 100))}%` },
              ]}
            />
          </View>
          <View style={styles.waterActions}>
            <Input
              label="Amount to log (L)"
              value={waterInput}
              onChangeText={setWaterInput}
              placeholder="e.g., 0.25"
              keyboardType="decimal-pad"
              style={{
                backgroundColor: healthTheme.water.inputBg,
                borderColor: healthTheme.water.inputBorder,
              }}
              containerStyle={styles.waterInput}
            />
            <TouchableOpacity
              onPress={handleLogWater}
              activeOpacity={0.85}
              style={styles.addWaterButton}
            >
              <LinearGradient
                colors={healthTheme.water.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.waterButtonGradient}
              >
                <Ionicons name="add" size={18} color={healthTheme.water.buttonText} />
                <Text style={[styles.addWaterButtonText, { color: healthTheme.water.buttonText }]}>
                  Log Water
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Card>
      </PlatformScrollView>

      {/* Daily Goals Modal */}
      <Modal
        visible={showGoalModal}
        onClose={handleCancelNutritionGoals}
        title="Daily Goals"
        fullScreen
      >
        <Input
          label="Calories (cal)"
          value={calorieGoalInput}
          onChangeText={setCalorieGoalInput}
          placeholder={`${defaultCalorieGoal}`}
          keyboardType="numeric"
          containerStyle={styles.goalModalInput}
        />
        <Input
          label="Protein (g)"
          value={proteinGoalInput}
          onChangeText={setProteinGoalInput}
          placeholder="e.g., 120"
          keyboardType="decimal-pad"
          containerStyle={styles.goalModalInput}
        />
        <Input
          label="Carbs (g)"
          value={carbsGoalInput}
          onChangeText={setCarbsGoalInput}
          placeholder="e.g., 200"
          keyboardType="decimal-pad"
          containerStyle={styles.goalModalInput}
        />
        <Input
          label="Fat (g)"
          value={fatGoalInput}
          onChangeText={setFatGoalInput}
          placeholder="e.g., 60"
          keyboardType="decimal-pad"
          containerStyle={styles.goalModalInput}
        />
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={handleCancelNutritionGoals}
            disabled={isSavingGoals}
            style={styles.modalButton}
          />
          <Button
            title="Save Goals"
            onPress={handleSaveNutritionGoals}
            disabled={isSavingGoals}
            style={styles.modalButton}
          />
        </View>
        <TouchableOpacity
          onPress={handleClearNutritionGoals}
          disabled={isSavingGoals}
          style={styles.goalClearButton}
        >
          <Text style={[styles.goalClearText, { color: themeColors.textSecondary }]}>
            Clear goals
          </Text>
        </TouchableOpacity>
      </Modal>

      {/* Log Food Modal */}
      <Modal
        visible={showFoodModal}
        onClose={() => {
          setShowFoodModal(false);
          setFoodName('');
          setFoodCalories('');
          setFoodProtein('');
          setFoodCarbs('');
          setFoodFat('');
          setFoodGramsEaten('');
          setFoodBasis(null);
        }}
        title="Log Food"
      >
        <Input
          label="Food Name"
          value={foodName}
          onChangeText={setFoodName}
          placeholder="e.g., Grilled Chicken Salad"
        />

        <Input
          label="Calories"
          value={foodCalories}
          onChangeText={setFoodCalories}
          placeholder="e.g., 350"
          keyboardType="numeric"
        />

        <Input
          label="Grams eaten (optional)"
          value={foodGramsEaten}
          onChangeText={setFoodGramsEaten}
          placeholder="e.g., 75"
          keyboardType="numeric"
        />

        <View style={styles.macrosRow}>
          <Input
            label="Protein (g)"
            value={foodProtein}
            onChangeText={setFoodProtein}
            placeholder="Optional"
            keyboardType="numeric"
            containerStyle={styles.macroInput}
          />

          <Input
            label="Carbs (g)"
            value={foodCarbs}
            onChangeText={setFoodCarbs}
            placeholder="Optional"
            keyboardType="numeric"
            containerStyle={styles.macroInput}
          />

          <Input
            label="Fat (g)"
            value={foodFat}
            onChangeText={setFoodFat}
          placeholder="Optional"
          keyboardType="numeric"
          containerStyle={[styles.macroInput, styles.macroInputLast]}
        />
      </View>

        <Button
          title="Scan Barcode"
          icon="barcode-outline"
          onPress={handleOpenScanner}
          style={styles.scanButton}
          variant="secondary"
        />

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowFoodModal(false);
              setFoodName('');
              setFoodCalories('');
              setFoodProtein('');
              setFoodCarbs('');
              setFoodFat('');
              setFoodGramsEaten('');
              setFoodBasis(null);
            }}
            style={styles.modalButton}
          />
          <Button
            title="Log Food"
            onPress={handleLogFood}
            disabled={!foodName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showScannerModal}
        onClose={handleCloseScanner}
        title="Scan Barcode"
        fullScreen
      >
        {!CameraView ? (
          <View style={styles.scannerState}>
            <Text style={styles.scannerMessageText}>
              Barcode scanner module not available. Install expo-camera and restart the app.
            </Text>
            <Button
              title="Close"
              variant="secondary"
              onPress={handleCloseScanner}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : cameraPermission?.granted !== true ? (
          <View style={styles.scannerState}>
            <Text style={styles.scannerMessageText}>Camera permission is required to scan barcodes.</Text>
            <Button
              title="Grant Permission"
              onPress={handleOpenScanner}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Close"
              variant="secondary"
              onPress={handleCloseScanner}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.scannerContainer}>
            <View style={styles.scannerFrame}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={(hasScanned || isLookingUpBarcode) ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128'],
                }}
              />
              <View style={styles.scannerOverlayTop} />
              <View style={styles.scannerOverlayMiddle}>
                <View style={styles.scannerOverlaySide} />
                <View style={styles.scannerGuide} />
                <View style={styles.scannerOverlaySide} />
              </View>
              <View style={styles.scannerOverlayBottom} />
            </View>
            <Text style={styles.scannerHint}>Align the barcode within the square to auto-fill the food fields.</Text>
            {!!scannerMessage && <Text style={styles.scannerMessageText}>{scannerMessage}</Text>}
            <Button
              title="Close Scanner"
              variant="secondary"
              onPress={handleCloseScanner}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </Modal>

      {/* Mood Picker Modal */}
      <Modal
        visible={showMoodModal}
        onClose={() => setShowMoodModal(false)}
        title="How are you feeling?"
        fullScreen
        containerStyle={{ backgroundColor: moodBackground }}
      >
        <View style={styles.moodModalContent} pointerEvents="box-none">
          <LinearGradient
            colors={moodBackgroundGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.moodBackground}
            pointerEvents="none"
          />
          <View style={styles.moodHero}>
            <Animated.View
              style={[
                styles.moodPreviewHalo,
                { transform: [{ scale: heroScale }] },
              ]}
            >
              <LinearGradient
                colors={moodGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moodPreviewHaloGradient}
              >
                <Text style={styles.moodPreviewEmoji}>{activeMood.emoji}</Text>
              </LinearGradient>
            </Animated.View>
            <Text style={[styles.moodPreviewLabel, { color: moodAccent }]}>
              {activeMood.label}
            </Text>
          </View>

          <View style={styles.moodGrid}>
            {moodOptions.map((option, idx) => {
              const isActive = activeMoodIndex === idx;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.moodEmojiButton,
                    isActive && styles.moodEmojiButtonActive,
                    isActive && { borderColor: option.accent, shadowColor: option.accent },
                  ]}
                  onPress={() => handleMoodSelect(idx)}
                  activeOpacity={0.85}
                >
                  <Animated.View
                    style={[
                      styles.moodEmojiButtonFill,
                      {
                        transform: [
                          { scale: moodButtonScalesRef.current[idx] || 1 },
                        ],
                      },
                    ]}
                  >
                    <LinearGradient
                    colors={isActive ? option.gradient : [themeColors.card, themeColors.card]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.moodEmojiButtonGradient}
                    >
                      <Text
                        style={[
                          styles.moodEmoji,
                          isActive && styles.moodEmojiActive,
                        ]}
                      >
                        {option.emoji}
                      </Text>
                    </LinearGradient>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setShowMoodModal(false)}
              style={styles.modalButton}
            />
            <Button
              title="Save Mood"
              onPress={handleMoodSave}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>

    </View>
  );
};

const createStyles = (themeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    marginHorizontal: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.caption,
  },
  statValue: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  statGoal: {
    ...typography.caption,
    color: themeColors.textLight,
  },
  sectionCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lastCard: {
    marginBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: themeColors.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calorieEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  calorieEditIcon: {
    marginRight: spacing.xs,
  },
  calorieEditText: {
    ...typography.caption,
    fontWeight: '600',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodOption: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  moodOptionActive: {
    backgroundColor: themeColors.primaryLight,
  },
  moodEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  moodLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  moodLabelActive: {
    color: themeColors.primary,
    fontWeight: '600',
  },
  waterCount: {
    ...typography.body,
    fontWeight: '600',
  },
  waterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  waterSummaryLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  waterSummaryValue: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  waterProgressBar: {
    height: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: themeColors.inputBackground,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  waterProgressFill: {
    height: '100%',
    backgroundColor: themeColors.info,
  },
  waterActions: {
    marginTop: spacing.sm,
  },
  waterInput: {
    marginBottom: spacing.sm,
  },
  addWaterButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  waterButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  addWaterButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  sleepInputRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  sleepInput: {
    flex: 1,
    marginRight: spacing.md,
  },
  sleepLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
    color: themeColors.textSecondary,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
  },
  timeButtonText: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
  sleepQualityRow: {
    flexDirection: 'row',
  },
  sleepLogContainer: {
    marginTop: spacing.lg,
  },
  sleepLogTitle: {
    ...typography.label,
    marginBottom: spacing.sm,
    color: themeColors.text,
  },
  sleepLogCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
    padding: spacing.md,
  },
  sleepLogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  sleepLogLabel: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
  },
  sleepLogValue: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  sleepSubmitButton: {
    marginTop: spacing.md,
  },
  sleepSubmitText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  qualityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.inputBackground,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  qualityOptionActive: {
    backgroundColor: themeColors.primary,
  },
  qualityText: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
  },
  qualityTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  calorieStats: {
    marginBottom: spacing.lg,
  },
  calorieStat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  calorieLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
    color: themeColors.textSecondary,
  },
  calorieValue: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  calorieOverLimit: {
    color: themeColors.danger,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  macroGoalSummary: {
    marginTop: spacing.sm,
  },
  macroRemainingSummary: {
    marginTop: spacing.sm,
  },
  healthTip: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  healthTipLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  healthTipText: {
    ...typography.bodySmall,
    lineHeight: 18,
  },
  goalModalInput: {
    marginBottom: spacing.md,
  },
  goalClearButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  goalClearText: {
    ...typography.caption,
  },
  calorieLeft: {
    flex: 1,
  },
  calorieRight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingCircle: {
    borderWidth: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: themeColors.inputBackground,
    padding: spacing.sm,
  },
  remainingText: {
    ...typography.body,
    fontWeight: '700',
  },
  remainingSub: {
    ...typography.caption,
    marginTop: 2,
  },
  calorieCard: {
    paddingVertical: spacing.xl,
  },
  swipeSection: {
    alignSelf: 'center',
  },
  swipeCard: {
    marginBottom: spacing.md,
  },
  swipeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  swipeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: spacing.xs,
    backgroundColor: themeColors.border,
    opacity: 0.6,
  },
  swipeDotActive: {
    backgroundColor: themeColors.primary,
    opacity: 1,
  },
  weightManagerCard: {
    paddingVertical: spacing.lg,
  },
  weightManagerSubtitle: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  weightManagerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: themeColors.primary,
  },
  weightManagerBadgeIcon: {
    marginRight: spacing.xs,
  },
  weightManagerBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  weightManagerEmpty: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  weightManagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  weightManagerWeights: {
    flex: 1,
  },
  weightManagerTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  weightManagerTypeText: {
    marginLeft: spacing.sm,
  },
  weightManagerStat: {
    marginBottom: spacing.sm,
  },
  weightManagerLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  weightManagerValue: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  weightManagerTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  weightManagerTargetRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightManagerTargetValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  weightManagerTargetLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  weightManagerBodyPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightManagerBodyPlaceholder: {
    width: 48,
    height: 64,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  weightManagerBodyPlaceholderText: {
    ...typography.body,
    fontWeight: '700',
  },
  weightManagerBodyHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 2,
  },
  weightManagerBodyShoulders: {
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  weightManagerBodyTorso: {
    height: 12,
    borderRadius: 5,
    marginBottom: 2,
  },
  weightManagerBodyWaist: {
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  weightManagerBodyLegs: {
    height: 12,
    borderRadius: 5,
  },
  weightManagerMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  weightManagerMacroItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  weightManagerMacroLabel: {
    ...typography.caption,
  },
  weightManagerMacroValue: {
    ...typography.bodySmall,
    fontWeight: '700',
  },
  weightManagerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weightManagerAction: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  weightManagerLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightManagerLockScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  weightManagerLockContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  weightManagerLockTitle: {
    ...typography.body,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  weightManagerLockSubtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  foodList: {
    marginBottom: spacing.md,
    paddingTop: 0,
  },
  foodListTitle: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  foodEmpty: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginBottom: spacing.md,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    ...typography.body,
    color: themeColors.text,
  },
  foodCal: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
  },
  foodMacros: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  logFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: themeColors.border,
    borderStyle: 'dashed',
  },
  logFoodText: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginLeft: spacing.sm,
  },
  dateSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dateSwitchButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
  },
  dateLabel: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  moodTouchable: {
    paddingVertical: spacing.sm,
  },
  moodSummary: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moodSummaryEmoji: {
    fontSize: 42,
  },
  moodSummaryLabel: {
    ...typography.body,
    marginTop: spacing.xs,
    fontWeight: '600',
    color: themeColors.text,
  },
  moodHint: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
  },
  moodPlaceholder: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginTop: spacing.sm,
  },
  moodModalContent: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flex: 1,
    position: 'relative',
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  moodBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  moodHero: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  moodPreviewHalo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    ...shadows.large,
  },
  moodPreviewHaloGradient: {
    flex: 1,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodPreviewEmoji: {
    fontSize: 52,
  },
  moodPreviewLabel: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  moodGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  moodEmojiButton: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  moodEmojiButtonActive: {
    borderWidth: 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  moodEmojiButtonFill: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  moodEmojiButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  moodEmoji: {
    fontSize: 30,
  },
  moodEmojiActive: {
    fontSize: 32,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  macroInput: {
    flex: 1,
    marginRight: spacing.sm,
    marginBottom: 0,
  },
  macroInputLast: {
    marginRight: 0,
  },
  scanButton: {
    marginBottom: spacing.md,
  },
  scannerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  scannerFrame: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 320,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
  },
  scannerOverlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerOverlayMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '50%',
  },
  scannerOverlaySide: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerGuide: {
    width: '60%',
    height: '100%',
    borderWidth: 2,
    borderColor: themeColors.primary,
    borderRadius: borderRadius.md,
  },
  scannerHint: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  scannerMessageText: {
    ...typography.bodySmall,
    color: themeColors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  scannerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
});

export default HealthScreen;
