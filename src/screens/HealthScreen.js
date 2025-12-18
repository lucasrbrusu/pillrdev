import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const HealthScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    healthData,
    todayHealth,
    updateTodayHealth,
    addFoodEntry,
    addFoodEntryForDate,
    deleteFoodEntryForDate,
    updateHealthForDate,
    profile,
    getAverageWater,
    getAverageSleep,
    themeColors,
  } = useApp();
  const styles = useMemo(() => createStyles(), [themeColors]);

  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMoodIndex, setSelectedMoodIndex] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sleepForm, setSleepForm] = useState({
    sleepTime: null,
    wakeTime: null,
    sleepQuality: null,
  });
  const [isSavingSleep, setIsSavingSleep] = useState(false);

  const sleepQualities = ['Excellent', 'Good', 'Fair', 'Poor'];

  const handleAddWater = () => {
    updateTodayHealth({ waterIntake: (todayHealth.waterIntake || 0) + 1 });
  };

  const handleSleepQualitySelect = (quality) => {
    setSleepForm((prev) => ({ ...prev, sleepQuality: quality }));
  };

  const moodOptions = MOOD_OPTIONS;

  const [showSleepTimePicker, setShowSleepTimePicker] = useState(false);
  const [sleepTimeTarget, setSleepTimeTarget] = useState(null);

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

  const handleLogFood = async () => {
    if (!foodName.trim()) return;

    const toNumberOrNull = (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = value.toString().trim();
      if (trimmed === '') return null;
      const parsed = parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    };

    await addFoodEntryForDate(selectedDateISO, {
      name: foodName.trim(),
      calories: parseInt(foodCalories) || 0,
      proteinGrams: toNumberOrNull(foodProtein),
      carbsGrams: toNumberOrNull(foodCarbs),
      fatGrams: toNumberOrNull(foodFat),
    });

    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
    setShowFoodModal(false);
  };

  const selectedDateISO = selectedDate.toISOString().slice(0, 10);
  const selectedDateKey = selectedDateISO;
  const emptyDay = {
    mood: null,
    waterIntake: 0,
    sleepTime: null,
    wakeTime: null,
    sleepQuality: null,
    calories: 0,
    foods: [],
  };
  const selectedHealthRaw = healthData[selectedDateKey] || {};
  const selectedHealth = {
    ...emptyDay,
    ...selectedHealthRaw,
    foods: Array.isArray(selectedHealthRaw.foods) ? selectedHealthRaw.foods : [],
  };

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

  const waterProgress = (todayHealth.waterIntake || 0) / profile.dailyWaterGoal;
  const caloriesConsumed = selectedHealth.calories || 0;
  const caloriesRemaining = profile.dailyCalorieGoal - caloriesConsumed;
  const remainingRatio = profile.dailyCalorieGoal
    ? Math.max(0, caloriesRemaining) / profile.dailyCalorieGoal
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

  const openMoodPicker = () => {
    setSelectedMoodIndex(currentMoodIndex());
    setShowMoodModal(true);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
            <Ionicons name="chevron-back" size={18} color={colors.text} />
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
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="water" size={18} color={colors.info} />
              <Text style={styles.statLabel}>Avg Water</Text>
            </View>
            <Text style={styles.statValue}>{getAverageWater()} cups</Text>
            <Text style={styles.statGoal}>Goal: {profile.dailyWaterGoal} cups/day</Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={styles.statHeader}>
              <Ionicons name="moon" size={18} color={colors.primary} />
              <Text style={styles.statLabel}>Avg Sleep</Text>
            </View>
            <Text style={styles.statValue}>{getAverageSleep()} hours</Text>
            <Text style={styles.statGoal}>Goal: {profile.dailySleepGoal} hours/night</Text>
          </Card>
        </View>

        {/* Calorie Tracker Section */}
        <Card style={[styles.sectionCard, styles.calorieCard]}>
          <Text style={styles.sectionTitle}>Calorie Tracker</Text>
          <View style={styles.calorieRow}>
            <View style={styles.calorieLeft}>
              <View style={styles.calorieStat}>
                <Text style={styles.calorieLabel}>Daily Goal</Text>
                <Text style={styles.calorieValue}>{profile.dailyCalorieGoal} cal</Text>
              </View>
              <View style={styles.calorieStat}>
                <Text style={styles.calorieLabel}>Consumed</Text>
                <Text style={styles.calorieValue}>{caloriesConsumed} cal</Text>
              </View>
            </View>
            <View style={styles.calorieRight}>
              <View
                style={[
                  styles.remainingCircle,
                  {
                    width: calorieCircleSize,
                    height: calorieCircleSize,
                    borderColor: getRemainingColor(),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.remainingText,
                    { color: getRemainingColor() },
                  ]}
                >
                  {Math.max(caloriesRemaining, 0)} cal
                </Text>
                <Text style={[styles.remainingSub, { color: getRemainingColor() }]}>
                  Remaining
                </Text>
              </View>
            </View>
          </View>

          {selectedHealth.foods && selectedHealth.foods.length > 0 && (
            <View style={styles.foodList}>
              <Text style={styles.foodListTitle}>
                Food for{' '}
                {selectedDate.toDateString() === new Date().toDateString()
                  ? 'Today'
                  : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
              {selectedHealth.foods.map((food, idx) => (
                <View
                  key={food.id || food.timestamp || `${food.name}-${idx}`}
                  style={styles.foodItem}
                >
                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName}>{food.name}</Text>
                    <Text style={styles.foodCal}>{food.calories} cal</Text>
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
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.logFoodButton}
            onPress={() => setShowFoodModal(true)}
          >
            <Ionicons name="add" size={18} color={colors.textSecondary} />
            <Text style={styles.logFoodText}>Log Food</Text>
          </TouchableOpacity>
        </Card>

        {/* Mood Section */}
        <Card style={styles.sectionCard}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openMoodPicker}
            style={styles.moodTouchable}
          >
            <Text style={styles.sectionTitle}>How are you feeling?</Text>
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
              <Text style={styles.moodPlaceholder}>
                Check in your mood with us!
              </Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Sleep Section */}
        <Card style={[styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Sleep</Text>
          <View style={styles.sleepInputRow}>
            <View style={styles.sleepInput}>
              <Text style={styles.sleepLabel}>Sleep Time</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => openSleepTimePicker('sleep')}
              >
                <Text style={styles.timeButtonText}>
                  {sleepForm.sleepTime || '--:--'}
                </Text>
                <Ionicons name="time-outline" size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            <View style={styles.sleepInput}>
              <Text style={styles.sleepLabel}>Wake Time</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => openSleepTimePicker('wake')}
              >
                <Text style={styles.timeButtonText}>
                  {sleepForm.wakeTime || '--:--'}
                </Text>
                <Ionicons name="time-outline" size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.sleepQualityRow}>
            {sleepQualities.map((quality) => (
              <TouchableOpacity
                key={quality}
                style={[
                  styles.qualityOption,
                  sleepForm.sleepQuality === quality && styles.qualityOptionActive,
                ]}
                onPress={() => handleSleepQualitySelect(quality)}
              >
                <Text
                  style={[
                    styles.qualityText,
                    sleepForm.sleepQuality === quality && styles.qualityTextActive,
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
            style={{ marginTop: spacing.md }}
          />
          {selectedHealth.sleepTime && selectedHealth.wakeTime && (
            <View style={styles.sleepLogContainer}>
              <Text style={styles.sleepLogTitle}>Logged Sleep</Text>
              <View style={styles.sleepLogCard}>
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
        <Card style={[styles.sectionCard, styles.lastCard]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Water Intake</Text>
            <Text style={styles.waterCount}>
              {todayHealth.waterIntake || 0} / {profile.dailyWaterGoal} cups
            </Text>
          </View>
          <View style={styles.waterProgressContainer}>
            {Array.from({ length: profile.dailyWaterGoal }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.waterDot,
                  index < (todayHealth.waterIntake || 0) && styles.waterDotFilled,
                ]}
              />
            ))}
          </View>
          <Button
            title="Add Cup"
            icon="add"
            onPress={handleAddWater}
            style={styles.addWaterButton}
          />
        </Card>
      </PlatformScrollView>

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
          label="Protein (g)"
          value={foodProtein}
          onChangeText={setFoodProtein}
          placeholder="Optional"
          keyboardType="numeric"
        />

        <Input
          label="Carbs (g)"
          value={foodCarbs}
          onChangeText={setFoodCarbs}
          placeholder="Optional"
          keyboardType="numeric"
        />

        <Input
          label="Fat (g)"
          value={foodFat}
          onChangeText={setFoodFat}
          placeholder="Optional"
          keyboardType="numeric"
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

      {/* Mood Picker Modal */}
      <Modal
        visible={showMoodModal}
        onClose={() => setShowMoodModal(false)}
        title="Select Your Mood"
        fullScreen
      >
        <View style={styles.moodModalContent} pointerEvents="box-none">
          <Text style={styles.moodPreviewEmoji}>
            {moodOptions[selectedMoodIndex ?? currentMoodIndex()].emoji}
          </Text>
          <Text style={styles.moodPreviewLabel}>
            {moodOptions[selectedMoodIndex ?? currentMoodIndex()].label}
          </Text>

          <View style={styles.moodGrid}>
            {moodOptions.map((option, idx) => {
              const isActive = (selectedMoodIndex ?? currentMoodIndex()) === idx;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.moodEmojiButton, isActive && styles.moodEmojiButtonActive]}
                  onPress={() => setSelectedMoodIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.moodEmoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.moodEmojiLabel,
                      isActive && styles.moodEmojiLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
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

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    marginLeft: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  statGoal: {
    ...typography.caption,
    color: colors.textLight,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  lastCard: {
    marginBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    backgroundColor: colors.primaryLight,
  },
  moodEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  moodLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  moodLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  waterCount: {
    ...typography.body,
    color: colors.info,
    fontWeight: '600',
  },
  waterProgressContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  waterDot: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
    margin: spacing.xs,
  },
  waterDotFilled: {
    backgroundColor: colors.info,
  },
  addWaterButton: {
    marginTop: spacing.sm,
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
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  timeButtonText: {
    ...typography.body,
    color: colors.textSecondary,
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
  },
  sleepLogCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    padding: spacing.md,
  },
  sleepLogRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  sleepLogLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  sleepLogValue: {
    ...typography.body,
    fontWeight: '600',
  },
  qualityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    marginHorizontal: spacing.xs,
  },
  qualityOptionActive: {
    backgroundColor: colors.primary,
  },
  qualityText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
    alignItems: 'center',
  },
  calorieLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  calorieValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.success,
  },
  calorieOverLimit: {
    color: colors.danger,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
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
    backgroundColor: colors.inputBackground,
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
  foodList: {
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  foodListTitle: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    ...typography.body,
  },
  foodCal: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  foodMacros: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  logFoodText: {
    ...typography.body,
    color: colors.textSecondary,
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
  },
  dateLabel: {
    ...typography.body,
    fontWeight: '600',
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
  },
  moodHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  moodPlaceholder: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  moodModalContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  moodPreviewEmoji: {
    fontSize: 64,
  },
  moodPreviewLabel: {
    ...typography.h3,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  moodGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  moodEmojiButton: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  moodEmojiButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  moodEmoji: {
    fontSize: 36,
  },
  moodEmojiLabel: {
    display: 'none',
  },
  moodEmojiLabelActive: {
    display: 'none',
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
});

export default HealthScreen;
