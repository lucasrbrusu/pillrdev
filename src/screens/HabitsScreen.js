import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, ChipGroup } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
  habitCategories,
  repeatOptions,
} from '../utils/theme';

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HabitsScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    habits,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    isHabitCompletedToday,
    getBestStreak,
    getTodayHabitsCount,
  } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [filterType, setFilterType] = useState('Latest Added');
  
  // Form state
  const [habitTitle, setHabitTitle] = useState('');
  const [habitCategory, setHabitCategory] = useState('Personal');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitRepeat, setHabitRepeat] = useState('Daily');
  const [repeatEveryday, setRepeatEveryday] = useState(true);
  const [selectedDays, setSelectedDays] = useState(daysOfWeek);

  const bestStreak = getBestStreak();
  const todayCount = getTodayHabitsCount();

  const sortedHabits = useMemo(() => {
    const habitsCopy = [...habits];
    switch (filterType) {
      case 'A-Z':
        return habitsCopy.sort((a, b) => a.title.localeCompare(b.title));
      case 'Repeat':
        const repeatOrder = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'];
        return habitsCopy.sort(
          (a, b) => repeatOrder.indexOf(a.repeat) - repeatOrder.indexOf(b.repeat)
        );
      case 'Latest Added':
      default:
        return habitsCopy.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
    }
  }, [habits, filterType]);

  const habitsByCategory = useMemo(() => {
    const grouped = {};
    sortedHabits.forEach((habit) => {
      const category = habit.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(habit);
    });
    return grouped;
  }, [sortedHabits]);

  const resetForm = () => {
    setHabitTitle('');
    setHabitCategory('Personal');
    setHabitDescription('');
    setHabitRepeat('Daily');
    setRepeatEveryday(true);
    setSelectedDays(daysOfWeek);
  };

  const handleCreateHabit = async () => {
    if (!habitTitle.trim()) return;

    await addHabit({
      title: habitTitle.trim(),
      category: habitCategory,
      description: habitDescription.trim(),
      repeat: habitRepeat,
      days: repeatEveryday ? daysOfWeek : selectedDays,
    });

    resetForm();
    setShowAddModal(false);
  };

  const handleHabitPress = (habit) => {
    setSelectedHabit(habit);
    setShowDetailModal(true);
  };

  const handleDeleteHabit = async () => {
    if (selectedHabit) {
      await deleteHabit(selectedHabit.id);
      setShowDetailModal(false);
      setSelectedHabit(null);
    }
  };

  const handleMarkComplete = async () => {
    if (selectedHabit) {
      await toggleHabitCompletion(selectedHabit.id);
      // Update selected habit with new data
      const updatedHabit = habits.find((h) => h.id === selectedHabit.id);
      setSelectedHabit(updatedHabit);
    }
  };

  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
    setRepeatEveryday(false);
  };

  const toggleEveryday = () => {
    if (repeatEveryday) {
      setRepeatEveryday(false);
      setSelectedDays([]);
    } else {
      setRepeatEveryday(true);
      setSelectedDays(daysOfWeek);
    }
  };

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
            <View style={styles.statContent}>
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </View>
            <Text style={styles.statValue}>{bestStreak} days</Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <Feather name="target" size={16} color={colors.habits} />
              <Text style={styles.statLabel}>Today</Text>
            </View>
            <Text style={styles.statValue}>{todayCount}</Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={styles.statContent}>
              <Ionicons name="trending-up" size={16} color={colors.success} />
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <Text style={styles.statValue}>{habits.length}</Text>
          </Card>
        </View>

        {/* Add Habit Button */}
        <Button
          title="Add Habit"
          icon="add"
          onPress={() => setShowAddModal(true)}
          style={styles.addButton}
        />

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <Ionicons name="filter-outline" size={18} color={colors.textLight} />
          {['Latest Added', 'A-Z', 'Repeat'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                filterType === filter && styles.filterChipActive,
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterType === filter && styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Habits List */}
        <Card style={styles.habitsCard}>
          {habits.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="target" size={48} color={colors.primaryLight} />
              <Text style={styles.emptyTitle}>No habits yet. Start building your routines!</Text>
              <TouchableOpacity onPress={() => setShowAddModal(true)}>
                <Text style={styles.emptyAction}>Create Your First Habit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            Object.entries(habitsByCategory).map(([category, categoryHabits]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{category}</Text>
                {categoryHabits.map((habit) => {
                  const isCompleted = isHabitCompletedToday(habit.id);
                  return (
                    <TouchableOpacity
                      key={habit.id}
                      style={styles.habitItem}
                      onPress={() => handleHabitPress(habit)}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          isCompleted && styles.checkboxChecked,
                        ]}
                        onPress={() => toggleHabitCompletion(habit.id)}
                      >
                        {isCompleted && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.habitTitle,
                          isCompleted && styles.habitTitleCompleted,
                        ]}
                      >
                        {habit.title}
                      </Text>
                      {habit.streak > 0 && (
                        <View style={styles.streakBadge}>
                          <Text style={styles.streakText}>🔥 {habit.streak}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      {/* Add Habit Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="New Habit"
      >
        <Input
          label="Habit Title"
          value={habitTitle}
          onChangeText={setHabitTitle}
          placeholder="e.g., Morning meditation"
        />

        <Text style={styles.inputLabel}>Category</Text>
        <ChipGroup
          options={habitCategories}
          selectedValue={habitCategory}
          onSelect={setHabitCategory}
          style={styles.chipGroup}
        />

        <Input
          label="Description (Optional)"
          value={habitDescription}
          onChangeText={setHabitDescription}
          placeholder="Add more details..."
          multiline
          numberOfLines={3}
        />

        <Text style={styles.inputLabel}>Repeat</Text>
        <ChipGroup
          options={repeatOptions}
          selectedValue={habitRepeat}
          onSelect={setHabitRepeat}
          style={styles.chipGroup}
        />

        {habitRepeat === 'Daily' && (
          <View style={styles.daysSection}>
            <TouchableOpacity
              style={styles.everydayToggle}
              onPress={toggleEveryday}
            >
              <Text style={styles.everydayLabel}>Repeat everyday</Text>
              <View
                style={[
                  styles.toggle,
                  repeatEveryday && styles.toggleActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    repeatEveryday && styles.toggleThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.daysRow}>
              {daysOfWeek.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(day) && styles.dayButtonActive,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selectedDays.includes(day) && styles.dayTextActive,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowAddModal(false);
              resetForm();
            }}
            style={styles.modalButton}
          />
          <Button
            title="Create Habit"
            onPress={handleCreateHabit}
            disabled={!habitTitle.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Habit Detail Modal */}
      <Modal
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedHabit(null);
        }}
        title="Habit Details"
      >
        {selectedHabit && (
          <>
            <Text style={styles.detailTitle}>{selectedHabit.title}</Text>
            <Text style={styles.detailCategory}>{selectedHabit.category}</Text>

            {selectedHabit.description && (
              <>
                <Text style={styles.detailLabel}>DESCRIPTION</Text>
                <Text style={styles.detailDescription}>
                  {selectedHabit.description}
                </Text>
              </>
            )}

            <View style={styles.detailRow}>
              <View style={styles.detailBox}>
                <Text style={styles.detailBoxLabel}>REPEAT</Text>
                <Text style={styles.detailBoxValue}>{selectedHabit.repeat}</Text>
              </View>
              <View style={styles.detailBox}>
                <Text style={styles.detailBoxLabel}>DAYS</Text>
                <Text style={styles.detailBoxValue}>
                  {selectedHabit.days?.length === 7
                    ? 'Everyday'
                    : selectedHabit.days?.join(', ') || 'Not set'}
                </Text>
              </View>
            </View>

            <View style={styles.streakDisplay}>
              <Text style={styles.streakIcon}>🔥</Text>
              <Text style={styles.streakNumber}>{selectedHabit.streak || 0}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
            </View>

            <View style={styles.detailButtons}>
              <Button
                title="Edit"
                variant="outline"
                icon="create-outline"
                onPress={() => {
                  // TODO: Implement edit functionality
                }}
                style={styles.detailButton}
              />
              <Button
                title="Delete"
                variant="danger"
                icon="trash-outline"
                onPress={handleDeleteHabit}
                style={styles.detailButton}
              />
            </View>

            <Button
              title="Mark Complete"
              variant="success"
              icon="checkmark"
              onPress={handleMarkComplete}
              style={styles.completeButton}
            />
          </>
        )}
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
    alignItems: 'center',
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    marginLeft: spacing.xs,
  },
  statValue: {
    ...typography.h3,
  },
  addButton: {
    marginBottom: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.inputBackground,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  habitsCard: {
    minHeight: 200,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  emptyAction: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  habitTitle: {
    flex: 1,
    ...typography.body,
  },
  habitTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textLight,
  },
  streakBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
  },
  streakText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  inputLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  chipGroup: {
    marginBottom: spacing.lg,
  },
  daysSection: {
    marginBottom: spacing.lg,
  },
  everydayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  everydayLabel: {
    ...typography.body,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 42,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonActive: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayTextActive: {
    color: '#FFFFFF',
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
  detailTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  detailCategory: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  detailDescription: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  detailBox: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  detailBoxLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  detailBoxValue: {
    ...typography.body,
    fontWeight: '600',
  },
  streakDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  streakIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginRight: spacing.xs,
  },
  streakLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailButtons: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  detailButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  completeButton: {
    marginBottom: spacing.lg,
  },
});

export default HabitsScreen;
