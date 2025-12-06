import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
  moodEmojis,
} from '../utils/theme';

const HealthScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    todayHealth,
    updateTodayHealth,
    addFoodEntry,
    profile,
    getAverageWater,
    getAverageSleep,
  } = useApp();

  const [showFoodModal, setShowFoodModal] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');

  const sleepQualities = ['Excellent', 'Good', 'Fair', 'Poor'];
  const energyLevels = [1, 2, 3, 4, 5];

  const handleMoodSelect = (value) => {
    updateTodayHealth({ mood: value });
  };

  const handleEnergySelect = (value) => {
    updateTodayHealth({ energy: value });
  };

  const handleAddWater = () => {
    updateTodayHealth({ waterIntake: (todayHealth.waterIntake || 0) + 1 });
  };

  const handleSleepQualitySelect = (quality) => {
    updateTodayHealth({ sleepQuality: quality });
  };

  const handleLogFood = async () => {
    if (!foodName.trim()) return;

    await addFoodEntry({
      name: foodName.trim(),
      calories: parseInt(foodCalories) || 0,
    });

    setFoodName('');
    setFoodCalories('');
    setShowFoodModal(false);
  };

  const waterProgress = (todayHealth.waterIntake || 0) / profile.dailyWaterGoal;
  const caloriesRemaining =
    profile.dailyCalorieGoal - (todayHealth.calories || 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Mood Section */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {moodEmojis.map((mood) => (
              <TouchableOpacity
                key={mood.value}
                style={[
                  styles.moodOption,
                  todayHealth.mood === mood.value && styles.moodOptionActive,
                ]}
                onPress={() => handleMoodSelect(mood.value)}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text
                  style={[
                    styles.moodLabel,
                    todayHealth.mood === mood.value && styles.moodLabelActive,
                  ]}
                >
                  {mood.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Energy Level Section */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Energy Level</Text>
          <View style={styles.energyRow}>
            {energyLevels.map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.energyOption,
                  todayHealth.energy === level && styles.energyOptionActive,
                ]}
                onPress={() => handleEnergySelect(level)}
              >
                <Text
                  style={[
                    styles.energyText,
                    todayHealth.energy === level && styles.energyTextActive,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.energyHint}>1 = Low, 5 = High</Text>
        </Card>

        {/* Water Intake Section */}
        <Card style={styles.sectionCard}>
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

        {/* Sleep Section */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sleep</Text>
          <View style={styles.sleepInputRow}>
            <View style={styles.sleepInput}>
              <Text style={styles.sleepLabel}>Sleep Time</Text>
              <TouchableOpacity style={styles.timeButton}>
                <Text style={styles.timeButtonText}>
                  {todayHealth.sleepTime || '--:--'}
                </Text>
                <Ionicons name="time-outline" size={18} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            <View style={styles.sleepInput}>
              <Text style={styles.sleepLabel}>Wake Time</Text>
              <TouchableOpacity style={styles.timeButton}>
                <Text style={styles.timeButtonText}>
                  {todayHealth.wakeTime || '--:--'}
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
                  todayHealth.sleepQuality === quality && styles.qualityOptionActive,
                ]}
                onPress={() => handleSleepQualitySelect(quality)}
              >
                <Text
                  style={[
                    styles.qualityText,
                    todayHealth.sleepQuality === quality && styles.qualityTextActive,
                  ]}
                >
                  {quality}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Calorie Tracker Section */}
        <Card style={[styles.sectionCard, styles.lastCard]}>
          <Text style={styles.sectionTitle}>Calorie Tracker</Text>
          <View style={styles.calorieStats}>
            <View style={styles.calorieStat}>
              <Text style={styles.calorieLabel}>Daily Goal</Text>
              <Text style={styles.calorieValue}>{profile.dailyCalorieGoal} cal</Text>
            </View>
            <View style={styles.calorieStat}>
              <Text style={styles.calorieLabel}>Consumed</Text>
              <Text style={styles.calorieValue}>{todayHealth.calories || 0} cal</Text>
            </View>
            <View style={styles.calorieStat}>
              <Text style={styles.calorieLabel}>Remaining</Text>
              <Text
                style={[
                  styles.calorieValue,
                  caloriesRemaining < 0 && styles.calorieOverLimit,
                ]}
              >
                {caloriesRemaining} cal
              </Text>
            </View>
          </View>

          {todayHealth.foods && todayHealth.foods.length > 0 && (
            <View style={styles.foodList}>
              <Text style={styles.foodListTitle}>Today's Food</Text>
              {todayHealth.foods.map((food) => (
                <View key={food.id} style={styles.foodItem}>
                  <Text style={styles.foodName}>{food.name}</Text>
                  <Text style={styles.foodCal}>{food.calories} cal</Text>
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
      </ScrollView>

      {/* Log Food Modal */}
      <Modal
        visible={showFoodModal}
        onClose={() => {
          setShowFoodModal(false);
          setFoodName('');
          setFoodCalories('');
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

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowFoodModal(false);
              setFoodName('');
              setFoodCalories('');
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
    </View>
  );
};

const styles = StyleSheet.create({
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
  energyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  energyOption: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  energyOptionActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  energyText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  energyTextActive: {
    color: '#FFFFFF',
  },
  energyHint: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textLight,
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
    flexDirection: 'row',
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
  foodName: {
    ...typography.body,
  },
  foodCal: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
