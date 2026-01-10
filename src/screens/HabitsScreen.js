import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, ChipGroup, PlatformScrollView } from '../components';
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
const repeatChoices = repeatOptions.filter(
  (option) => option !== 'Custom' && option !== 'Yearly'
);
const defaultMonthlyDay = new Date().getDate();
const monthDays = Array.from({ length: 31 }, (_, idx) => idx + 1);
const formatOrdinal = (day) => {
  const value = parseInt(day, 10) || 0;
  const j = value % 10;
  const k = value % 100;
  if (j === 1 && k !== 11) return `${value}st`;
  if (j === 2 && k !== 12) return `${value}nd`;
  if (j === 3 && k !== 13) return `${value}rd`;
  return `${value}th`;
};

const HabitsScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    habits,
    addHabit,
    addGroupHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    toggleGroupHabitCompletion,
    isHabitCompletedToday,
    getBestStreak,
    getTodayHabitsCount,
    groups,
    groupHabits,
    groupHabitCompletions,
    authUser,
    isPremiumUser,
    themeName,
    themeColors,
    streakFrozen,
    ensureHabitsLoaded,
  } = useApp();
  const isDark = themeName === 'dark';
  const habitTheme = useMemo(() => {
    const streakAccent = streakFrozen ? '#4DA6FF' : '#FF7A2F';
    return {
      background: isDark ? themeColors.background : '#F7F2FF',
      addGradient: ['#A855F7', '#EC4899'],
      stats: {
        streak: {
          card: isDark ? '#1F1B2A' : '#FFF3E7',
          border: isDark ? '#2E2938' : '#FFE3CC',
          iconBg: isDark ? '#3A2A1F' : '#FFE2CC',
          iconColor: streakAccent,
          label: isDark ? '#C8C4D8' : themeColors.textSecondary,
          value: streakAccent,
        },
        today: {
          card: isDark ? '#1F1B2F' : '#F3EDFF',
          border: isDark ? '#2E2940' : '#E2D3FF',
          iconBg: isDark ? '#3B2B55' : '#E7D8FF',
          iconColor: isDark ? '#C084FC' : themeColors.primary,
          label: isDark ? '#C8C4D8' : themeColors.textSecondary,
          value: isDark ? '#E9D5FF' : themeColors.primary,
        },
        total: {
          card: isDark ? '#1A2422' : '#ECFBF3',
          border: isDark ? '#263634' : '#CFF3E0',
          iconBg: isDark ? '#243832' : '#D6F6E6',
          iconColor: isDark ? '#34D399' : themeColors.success,
          label: isDark ? '#C1D5CE' : themeColors.textSecondary,
          value: isDark ? '#6EE7B7' : themeColors.success,
        },
      },
      filterIconBg: isDark ? '#1B1A24' : '#FFFFFF',
      filterIconBorder: isDark ? '#2F2C3C' : '#E6D9FF',
      filterIconColor: isDark ? '#C8C4D8' : themeColors.textSecondary,
      filterChipBg: isDark ? '#1B1A24' : '#FFFFFF',
      filterChipBorder: isDark ? '#2F2C3C' : '#E6D9FF',
      filterChipActiveBg: isDark ? '#3A2B4F' : '#F4E9FF',
      filterChipActiveBorder: isDark ? '#6B46C1' : '#CDB3FF',
      filterChipText: isDark ? '#C8C4D8' : themeColors.textSecondary,
      filterChipTextActive: isDark ? '#F1E8FF' : themeColors.primary,
      cardBg: isDark ? '#1A1722' : '#FFFFFF',
      cardBorder: isDark ? '#2B2735' : '#EFE4FF',
      categoryTitle: isDark ? '#D8B4FE' : themeColors.primary,
      itemBg: isDark ? '#241F2E' : '#F9F2FF',
      itemBorder: isDark ? '#3A3446' : '#EAD9FF',
      itemText: isDark ? '#E9E5F4' : themeColors.text,
      itemMuted: isDark ? '#9C97B2' : themeColors.textLight,
      streakBadgeBg: isDark ? '#3B2B20' : '#FFE7D1',
      streakBadgeBorder: isDark ? '#6B3F2A' : '#FFC7A1',
      streakBadgeText: isDark ? '#FFB37A' : '#FF7A2F',
      groupCardBg: isDark ? '#1C1E28' : '#FFFFFF',
      groupCardBorder: isDark ? '#2E3040' : '#E7E1FF',
      groupRowBg: isDark ? '#232638' : '#F6F0FF',
      groupRowBorder: isDark ? '#3A3E52' : '#E2D7FF',
      groupMeta: isDark ? '#B0B2C4' : themeColors.textSecondary,
    };
  }, [isDark, themeColors, streakFrozen]);
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    ensureHabitsLoaded();
  }, [ensureHabitsLoaded]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [filterType, setFilterType] = useState('Latest Added');
  const [isEditingHabit, setIsEditingHabit] = useState(false);
  
  // Form state
  const [habitTitle, setHabitTitle] = useState('');
  const [habitCategory, setHabitCategory] = useState('Personal');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitRepeat, setHabitRepeat] = useState('Daily');
  const [repeatEveryday, setRepeatEveryday] = useState(true);
  const [selectedDays, setSelectedDays] = useState(daysOfWeek);
  const [monthlyDay, setMonthlyDay] = useState(defaultMonthlyDay);
  const [showMonthlyDatePicker, setShowMonthlyDatePicker] = useState(false);
  const [habitGroupId, setHabitGroupId] = useState(null);

  const bestStreak = getBestStreak();
  const todayCount = getTodayHabitsCount();
  const streakFlameColor = streakFrozen ? '#4da6ff' : '#ff4d4f';
  const streakFlameBackground = streakFrozen ? 'rgba(77, 166, 255, 0.12)' : 'rgba(255, 77, 79, 0.12)';
  const streakValueColor = habitTheme.stats.streak.value;
  const todayValueColor = habitTheme.stats.today.value;
  const totalValueColor = habitTheme.stats.total.value;
  const selectedCompleted = selectedHabit ? isHabitCompletedToday(selectedHabit.id) : false;
  const todayKey = new Date().toISOString().slice(0, 10);

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

  const groupHabitsByGroup = useMemo(() => {
    const map = {};
    (groupHabits || []).forEach((habit) => {
      if (!map[habit.groupId]) map[habit.groupId] = [];
      map[habit.groupId].push(habit);
    });
    return map;
  }, [groupHabits]);

  const resetForm = () => {
    setHabitTitle('');
    setHabitCategory('Personal');
    setHabitDescription('');
    setHabitRepeat('Daily');
    setRepeatEveryday(true);
    setSelectedDays(daysOfWeek);
    setMonthlyDay(defaultMonthlyDay);
    setShowMonthlyDatePicker(false);
    setHabitGroupId(null);
    setIsEditingHabit(false);
    setSelectedHabit(null);
  };

  const handleSubmitHabit = async () => {
    if (!habitTitle.trim()) return;

    const getRepeatDays = () => {
      if (habitRepeat === 'Daily') {
        return repeatEveryday ? daysOfWeek : selectedDays;
      }
      if (habitRepeat === 'Weekly') {
        if (!selectedDays.length) return [daysOfWeek[0]];
        return [selectedDays[0]];
      }
      if (habitRepeat === 'Monthly') {
        const parsedDay = parseInt(monthlyDay, 10);
        const safeDay = Math.min(Math.max(parsedDay || defaultMonthlyDay, 1), 31);
        return [String(safeDay)];
      }
      return selectedDays;
    };

    const payload = {
      title: habitTitle.trim(),
      category: habitCategory,
      description: habitDescription.trim(),
      repeat: habitRepeat,
      days: getRepeatDays(),
    };

    if (isEditingHabit && selectedHabit) {
      await updateHabit(selectedHabit.id, payload);
    } else if (habitGroupId) {
      await addGroupHabit({ groupId: habitGroupId, ...payload });
    } else {
      await addHabit(payload);
    }

    resetForm();
    setShowAddModal(false);
  };

  const handleHabitPress = (habit) => {
    setSelectedHabit(habit);
    setShowDetailModal(true);
  };

  const handleEditHabit = () => {
    if (!selectedHabit) return;

    setHabitTitle(selectedHabit.title || '');
    setHabitCategory(selectedHabit.category || 'Personal');
    setHabitDescription(selectedHabit.description || '');
    const repeatValue = selectedHabit.repeat || 'Daily';
    const days = selectedHabit.days?.length ? selectedHabit.days : daysOfWeek;
    setHabitRepeat(repeatValue);
    setShowMonthlyDatePicker(false);

    if (repeatValue === 'Monthly') {
      const parsedDay = parseInt(days[0], 10);
      const safeDay = Math.min(Math.max(parsedDay || defaultMonthlyDay, 1), 31);
      setMonthlyDay(safeDay);
      setSelectedDays([]);
      setRepeatEveryday(false);
    } else if (repeatValue === 'Weekly') {
      const firstDay = days[0] || daysOfWeek[0];
      setSelectedDays([firstDay]);
      setRepeatEveryday(false);
    } else {
      setSelectedDays(days);
      setRepeatEveryday(days.length === daysOfWeek.length);
    }

    setIsEditingHabit(true);
    setHabitGroupId(null);
    setShowDetailModal(false);
    setShowAddModal(true);
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
      setSelectedHabit((prev) => {
        const updatedHabit = habits.find((h) => h.id === selectedHabit.id);
        return updatedHabit || prev;
      });
    }
  };

  const toggleDay = (day) => {
    if (habitRepeat === 'Weekly') {
      setSelectedDays([day]);
      setRepeatEveryday(false);
      return;
    }

    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
    setRepeatEveryday(false);
  };

  const toggleEveryday = () => {
    if (habitRepeat !== 'Daily') return;
    if (repeatEveryday) {
      setRepeatEveryday(false);
      setSelectedDays([]);
    } else {
      setRepeatEveryday(true);
      setSelectedDays(daysOfWeek);
    }
  };

  const handleSelectRepeat = (value) => {
    setHabitRepeat(value);
    setShowMonthlyDatePicker(false);

    if (value === 'Daily') {
      setRepeatEveryday(true);
      setSelectedDays(daysOfWeek);
      return;
    }

    if (value === 'Weekly') {
      setRepeatEveryday(false);
      setSelectedDays([selectedDays[0] || daysOfWeek[0]]);
      return;
    }

    if (value === 'Monthly') {
      setRepeatEveryday(false);
      setSelectedDays([]);
      if (!monthlyDay) {
        setMonthlyDay(defaultMonthlyDay);
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: habitTheme.background }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card
            style={[
              styles.statCard,
              {
                backgroundColor: habitTheme.stats.streak.card,
                borderColor: habitTheme.stats.streak.border,
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: habitTheme.stats.streak.iconBg },
              ]}
            >
              <Ionicons name="flame" size={16} color={habitTheme.stats.streak.iconColor} />
            </View>
            <Text style={[styles.statLabel, { color: habitTheme.stats.streak.label }]}>
              Best Streak
            </Text>
            <Text style={[styles.statValue, { color: streakValueColor }]}>
              {bestStreak} days
            </Text>
          </Card>
          <Card
            style={[
              styles.statCard,
              {
                backgroundColor: habitTheme.stats.today.card,
                borderColor: habitTheme.stats.today.border,
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: habitTheme.stats.today.iconBg },
              ]}
            >
              <Feather name="target" size={16} color={habitTheme.stats.today.iconColor} />
            </View>
            <Text style={[styles.statLabel, { color: habitTheme.stats.today.label }]}>
              Today
            </Text>
            <Text style={[styles.statValue, { color: todayValueColor }]}>
              {todayCount}
            </Text>
          </Card>
          <Card
            style={[
              styles.statCard,
              {
                backgroundColor: habitTheme.stats.total.card,
                borderColor: habitTheme.stats.total.border,
              },
            ]}
          >
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: habitTheme.stats.total.iconBg },
              ]}
            >
              <Ionicons name="trending-up" size={16} color={habitTheme.stats.total.iconColor} />
            </View>
            <Text style={[styles.statLabel, { color: habitTheme.stats.total.label }]}>
              Total
            </Text>
            <Text style={[styles.statValue, { color: totalValueColor }]}>
              {habits.length}
            </Text>
          </Card>
        </View>

        {/* Add Habit Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={habitTheme.addGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addHabitGradient}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addHabitText}>Add Habit</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <View
            style={[
              styles.filterIcon,
              {
                backgroundColor: habitTheme.filterIconBg,
                borderColor: habitTheme.filterIconBorder,
              },
            ]}
          >
            <Ionicons name="options-outline" size={18} color={habitTheme.filterIconColor} />
          </View>
          {['Latest Added', 'A-Z', 'Repeat'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                {
                  backgroundColor: habitTheme.filterChipBg,
                  borderColor: habitTheme.filterChipBorder,
                },
                filterType === filter && [
                  styles.filterChipActive,
                  {
                    backgroundColor: habitTheme.filterChipActiveBg,
                    borderColor: habitTheme.filterChipActiveBorder,
                  },
                ],
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: habitTheme.filterChipText },
                  filterType === filter && [
                    styles.filterTextActive,
                    { color: habitTheme.filterChipTextActive },
                  ],
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Habits List */}
        <Card
          style={[
            styles.habitsCard,
            {
              backgroundColor: habitTheme.cardBg,
              borderColor: habitTheme.cardBorder,
            },
          ]}
        >
          {habits.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="target" size={48} color={habitTheme.categoryTitle} />
              <Text style={styles.emptyTitle}>No habits yet. Start building your routines!</Text>
              <TouchableOpacity onPress={() => setShowAddModal(true)}>
                <Text style={styles.emptyAction}>Create Your First Habit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            Object.entries(habitsByCategory).map(([category, categoryHabits]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={[styles.categoryTitle, { color: habitTheme.categoryTitle }]}>
                  {category}
                </Text>
                {categoryHabits.map((habit) => {
                  const isCompleted = isHabitCompletedToday(habit.id);
                  return (
                    <TouchableOpacity
                      key={habit.id}
                      style={[
                        styles.habitItem,
                        {
                          backgroundColor: habitTheme.itemBg,
                          borderColor: habitTheme.itemBorder,
                        },
                      ]}
                      onPress={() => handleHabitPress(habit)}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        style={[
                          styles.checkbox,
                          { borderColor: habitTheme.itemBorder },
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
                          { color: habitTheme.itemText },
                          isCompleted && styles.habitTitleCompleted,
                        ]}
                      >
                        {habit.title}
                      </Text>
                      {habit.streak > 0 && (
                        <View
                          style={[
                            styles.streakBadge,
                            streakFrozen && styles.streakBadgeFrozen,
                            {
                              backgroundColor: streakFrozen
                                ? streakFlameBackground
                                : habitTheme.streakBadgeBg,
                              borderColor: habitTheme.streakBadgeBorder,
                            },
                          ]}
                        >
                          <Ionicons
                            name="flame"
                            size={14}
                            color={streakFrozen ? streakFlameColor : habitTheme.streakBadgeText}
                            style={styles.streakBadgeIcon}
                          />
                          <Text
                            style={[
                              styles.streakText,
                              streakFrozen && styles.streakTextFrozen,
                              !streakFrozen && { color: habitTheme.streakBadgeText },
                            ]}
                          >
                            {habit.streak}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </Card>

        {groups.length > 0 ? (
          <Card
            style={[
              styles.groupCard,
              { backgroundColor: habitTheme.groupCardBg, borderColor: habitTheme.groupCardBorder },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: habitTheme.categoryTitle }]}>
                Group habits
              </Text>
              <Text style={[styles.sectionMeta, { color: habitTheme.groupMeta }]}>
                {groupHabits.length} total
              </Text>
            </View>
            {groupHabits.length === 0 ? (
              <Text style={styles.emptyText}>No group habits yet. Share one when creating a habit.</Text>
            ) : (
              groups.map((group) => {
                const groupList = groupHabitsByGroup[group.id] || [];
                if (!groupList.length) return null;
                const memberCount = group.members?.length || 1;
                return (
                  <View key={group.id} style={styles.groupSection}>
                    <Text style={[styles.groupName, { color: habitTheme.itemText }]}>
                      {group.name}
                    </Text>
                    {groupList.map((habit) => {
                      const completions = groupHabitCompletions[habit.id] || [];
                      const todayCompletions = completions.filter((c) => c.date === todayKey);
                      const completedByMe = todayCompletions.some((c) => c.userId === authUser?.id);

                      return (
                        <View
                          key={habit.id}
                          style={[
                            styles.groupHabitRow,
                            {
                              backgroundColor: habitTheme.groupRowBg,
                              borderColor: habitTheme.groupRowBorder,
                            },
                          ]}
                        >
                          <View style={styles.groupHabitText}>
                            <Text style={[styles.groupHabitTitle, { color: habitTheme.itemText }]}>
                              {habit.title}
                            </Text>
                            {habit.description ? (
                              <Text style={[styles.groupHabitMeta, { color: habitTheme.groupMeta }]}>
                                {habit.description}
                              </Text>
                            ) : null}
                            <Text style={[styles.groupHabitMeta, { color: habitTheme.groupMeta }]}>
                              {todayCompletions.length}/{memberCount} completed today
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.checkbox,
                              { borderColor: habitTheme.groupRowBorder },
                              completedByMe && styles.checkboxChecked,
                            ]}
                            onPress={() => toggleGroupHabitCompletion(habit.id)}
                          >
                            {completedByMe ? (
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            ) : null}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </Card>
        ) : null}
      </PlatformScrollView>

      {/* Add Habit Modal */}
      <Modal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title={isEditingHabit ? 'Edit Habit' : 'New Habit'}
        fullScreen
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

        {groups.length > 0 ? (
          <>
            <Text style={styles.inputLabel}>Share with group</Text>
            <ChipGroup
              options={[
                { label: 'Personal', value: null },
                ...groups.map((g) => ({ label: g.name, value: g.id })),
              ]}
              selectedValue={habitGroupId}
              onSelect={setHabitGroupId}
              style={styles.chipGroup}
            />
          </>
        ) : null}

        <Text style={styles.inputLabel}>Repeat</Text>
        <ChipGroup
          options={repeatChoices}
          selectedValue={habitRepeat}
          onSelect={handleSelectRepeat}
          style={styles.chipGroup}
        />

        {(habitRepeat === 'Daily' || habitRepeat === 'Weekly') && (
          <View style={styles.daysSection}>
            {habitRepeat === 'Daily' ? (
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
            ) : (
              <Text style={styles.inputLabel}>Repeat on</Text>
            )}

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

            {habitRepeat === 'Weekly' ? (
              <Text style={styles.helperText}>Choose one day for this weekly habit.</Text>
            ) : null}
          </View>
        )}

        {habitRepeat === 'Monthly' && (
          <View style={styles.monthlySection}>
            <Text style={styles.inputLabel}>Day of the month</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowMonthlyDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.dateButtonText}>
                Repeats on {formatOrdinal(monthlyDay)} of every month
              </Text>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.textLight}
              />
            </TouchableOpacity>
          </View>
        )}

        {showMonthlyDatePicker ? (
          <View style={styles.dayPickerOverlay}>
            <TouchableOpacity
              style={styles.dayPickerBackdrop}
              onPress={() => setShowMonthlyDatePicker(false)}
              activeOpacity={1}
            />
            <View style={styles.dayPickerSheet}>
              <Text style={styles.dayPickerTitle}>Select day</Text>
              <View style={styles.dayPickerGrid}>
                {monthDays.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayOption,
                      monthlyDay === day && styles.dayOptionActive,
                    ]}
                    onPress={() => {
                      setMonthlyDay(day);
                      setShowMonthlyDatePicker(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.dayOptionText,
                        monthlyDay === day && styles.dayOptionTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ) : null}

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
            title={isEditingHabit ? 'Save Changes' : 'Create Habit'}
            onPress={handleSubmitHabit}
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
        fullScreen
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

            <View
              style={[
                styles.streakDisplay,
                streakFrozen && styles.streakDisplayFrozen,
                {
                  backgroundColor: streakFrozen
                    ? streakFlameBackground
                    : colors.inputBackground,
                },
              ]}
            >
              <Ionicons name="flame" size={24} color={streakFlameColor} style={styles.streakIcon} />
              <Text
                style={[
                  styles.streakNumber,
                  streakFrozen && styles.streakNumberFrozen,
                ]}
              >
                {selectedHabit.streak || 0}
              </Text>
              <Text
                style={[
                  styles.streakLabel,
                  streakFrozen && styles.streakLabelFrozen,
                ]}
              >
                day streak
              </Text>
            </View>

            <View style={styles.detailButtons}>
              <Button
                title="Edit"
                variant="outline"
                icon="create-outline"
                onPress={handleEditHabit}
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
              title={selectedCompleted ? 'Mark as Undone' : 'Mark Complete'}
              variant={selectedCompleted ? 'danger' : 'success'}
              icon={selectedCompleted ? 'close' : 'checkmark'}
              onPress={handleMarkComplete}
              style={styles.completeButton}
            />
          </>
        )}
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
    alignItems: 'flex-start',
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
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  addButton: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  addHabitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  addHabitText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  filterIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
  },
  sectionMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterChipActive: {
    borderWidth: 1,
  },
  filterText: {
    ...typography.bodySmall,
  },
  filterTextActive: {
    fontWeight: '600',
  },
  habitsCard: {
    minHeight: 200,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  groupCard: {
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  groupSection: {
    marginBottom: spacing.md,
  },
  groupName: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  groupHabitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  groupHabitText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  groupHabitTitle: {
    ...typography.body,
  },
  groupHabitMeta: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  emptyAction: {
    ...typography.body,
    color: themeColors.primary,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    ...typography.label,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: themeColors.success,
    borderColor: themeColors.success,
  },
  habitTitle: {
    flex: 1,
    ...typography.body,
  },
  habitTitleCompleted: {
    textDecorationLine: 'line-through',
    color: themeColors.textLight,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  streakBadgeFrozen: {
    backgroundColor: 'rgba(77, 166, 255, 0.12)',
    borderWidth: 1,
    borderColor: '#4da6ff',
  },
  streakBadgeIcon: {
    marginRight: spacing.xs,
  },
  streakText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  streakTextFrozen: {
    color: '#4da6ff',
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
  helperText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  monthlySection: {
    marginBottom: spacing.lg,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
  },
  dateButtonText: {
    ...typography.body,
  },
  dayPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    zIndex: 40,
  },
  dayPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  dayPickerSheet: {
    width: '92%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.medium,
  },
  dayPickerTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  dayPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayOption: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dayOptionActive: {
    backgroundColor: colors.primary,
  },
  dayOptionText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayOptionTextActive: {
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
  streakDisplayFrozen: {
    backgroundColor: 'rgba(77, 166, 255, 0.08)',
    borderWidth: 1,
    borderColor: '#4da6ff',
  },
  streakIcon: {
    marginRight: spacing.sm,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginRight: spacing.xs,
  },
  streakNumberFrozen: {
    color: '#4da6ff',
  },
  streakLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  streakLabelFrozen: {
    color: '#4da6ff',
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

