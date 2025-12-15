import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import { colors, shadows, borderRadius, spacing, typography } from '../utils/theme';

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

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    profile,
    habits,
    tasks,
    todayHealth,
    chores,
    reminders,
    groceries,
    getTodayTasks,
  } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const todayTasks = getTodayTasks();
  const recentHabits = habits.slice(-5).reverse();
  const upcomingChores = chores.filter((c) => !c.completed).slice(0, 3);
  const getReminderDate = (reminder) => {
    if (!reminder?.date) return new Date(reminder?.createdAt || Date.now());
    const dateString = reminder.time
      ? `${reminder.date}T${reminder.time}`
      : reminder.date;
    return new Date(dateString);
  };

  const upcomingReminders = reminders
    .slice()
    .sort((a, b) => getReminderDate(a) - getReminderDate(b))
    .slice(0, 3);
  const groceryPreview = groceries.filter((g) => !g.completed).slice(0, 3);

  const currentMood = todayHealth.mood
    ? MOOD_OPTIONS[Math.max(0, Math.min(MOOD_OPTIONS.length - 1, todayHealth.mood - 1))]
    : null;

  const sectionButtons = [
    {
      id: 'habits',
      label: 'Habits',
      icon: 'target',
      iconType: 'feather',
      color: colors.habits,
      screen: 'Habits',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: 'edit-3',
      iconType: 'feather',
      color: colors.tasks,
      screen: 'Tasks',
    },
    {
      id: 'health',
      label: 'Health',
      icon: 'heart',
      iconType: 'ionicons',
      color: colors.health,
      screen: 'Health',
    },
    {
      id: 'routine',
      label: 'Routine',
      icon: 'history',
      iconType: 'material',
      color: colors.routine,
      screen: 'Routine',
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: 'trending-up',
      iconType: 'feather',
      color: colors.finance,
      screen: 'Finance',
    },
  ];

  const renderIcon = (icon, iconType, size, color) => {
    switch (iconType) {
      case 'feather':
        return <Feather name={icon} size={size} color={color} />;
      case 'material':
        return <MaterialCommunityIcons name={icon} size={size} color={color} />;
      default:
        return <Ionicons name={icon} size={size} color={color} />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <View style={[styles.logoDot, { backgroundColor: colors.habits }]} />
              <View style={[styles.logoDot, { backgroundColor: colors.tasks }]} />
              <View style={[styles.logoDot, { backgroundColor: colors.health }]} />
              <View style={[styles.logoDot, { backgroundColor: colors.routine }]} />
            </View>
            <Text style={styles.logoText}>Pillr</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            {profile.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Section Shortcuts */}
        <View style={styles.sectionButtonsContainer}>
          {sectionButtons.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={styles.sectionButton}
              onPress={() => navigation.navigate(section.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.sectionIconContainer, { backgroundColor: `${section.color}15` }]}>
                {renderIcon(section.icon, section.iconType, 24, section.color)}
              </View>
              <Text style={styles.sectionLabel}>{section.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Reminders */}
        <Card
          style={[styles.sectionCard, styles.remindersCard]}
          onPress={() => navigation.navigate('Routine')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.remindersTitle]}>Reminders</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {upcomingReminders.length === 0 ? (
            <Text style={[styles.emptyText, styles.remindersText]}>No reminders available</Text>
          ) : (
            <View style={styles.reminderList}>
              {upcomingReminders.map((reminder) => (
                <View key={reminder.id} style={styles.reminderItem}>
                  <View style={styles.reminderIcon}>
                    <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.reminderContent}>
                    <Text style={[styles.reminderTitle, styles.remindersText]} numberOfLines={1}>
                      {reminder.title}
                    </Text>
                    {(reminder.date || reminder.time) && (
                      <Text style={[styles.reminderMeta, styles.remindersMeta]}>
                        {reminder.date}
                        {reminder.time ? ` • ${reminder.time}` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Today's Overview */}
        <Card
          style={[styles.sectionCard, styles.tasksOverviewCard]}
          onPress={() => navigation.navigate('Tasks')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.tasksOverviewTitle]}>Today's Overview</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          <Text style={[styles.dateText, styles.tasksOverviewMeta]}>{formattedDate}</Text>
          {todayTasks.length > 0 ? (
            <View style={styles.tasksList}>
              {todayTasks.slice(0, 3).map((task) => (
                <View key={task.id} style={styles.taskItem}>
                  <View style={[styles.taskDot, styles.tasksOverviewDot]} />
                  <Text style={[styles.taskText, styles.tasksOverviewText]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.time && (
                    <Text style={[styles.taskTime, styles.tasksOverviewMeta]}>{task.time}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, styles.tasksOverviewText]}>No tasks scheduled for today</Text>
          )}
        </Card>

        {/* Today's Health */}
        <Card
          style={[styles.sectionCard, styles.healthCard]}
          onPress={() => navigation.navigate('Health')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.healthTitle]}>Today's Health</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {currentMood ? (
            <View style={styles.healthContent}>
              <Text style={styles.moodEmoji}>{currentMood.emoji}</Text>
              <Text style={[styles.moodLabel, styles.healthText]}>Feeling {currentMood.label.toLowerCase()}</Text>
            </View>
          ) : (
            <View style={styles.healthPrompt}>
              <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.healthPromptText, styles.healthText]}>
                Check in with your health and mood today
              </Text>
            </View>
          )}
        </Card>

        {!currentMood && (
          <Card
            style={[styles.sectionCard, styles.moodPromptCard]}
            onPress={() => navigation.navigate('Health', { openMoodPicker: true })}
          >
            <Text style={styles.cardTitle}>Check in with your mood today!</Text>
          </Card>
        )}

        {/* Your Habits */}
        <Card
          style={[styles.sectionCard, styles.habitsCard]}
          onPress={() => navigation.navigate('Habits')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.habitsTitle]}>Your Habits</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {recentHabits.length > 0 ? (
            <View style={styles.habitsList}>
              {recentHabits.map((habit) => (
                <View key={habit.id} style={styles.habitItem}>
                  <View style={[styles.habitDot, { backgroundColor: '#FFFFFF' }]} />
                  <Text style={[styles.habitText, styles.habitsText]} numberOfLines={1}>
                    {habit.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, styles.habitsText]}>No habits yet</Text>
          )}
        </Card>

        {/* Home & Chores */}
        <Card
          style={[styles.sectionCard, styles.lastCard, styles.choresCard]}
          onPress={() => navigation.navigate('Routine')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.choresTitle]}>Home & Chores</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {upcomingChores.length > 0 || groceryPreview.length > 0 ? (
            <View>
              {upcomingChores.map((chore) => (
                <View key={chore.id} style={styles.choreItem}>
                  <Ionicons name="checkbox-outline" size={18} color="#FFFFFF" />
                  <Text style={[styles.choreText, styles.choresText]} numberOfLines={1}>
                    {chore.title}
                  </Text>
                </View>
              ))}
              {groceryPreview.length > 0 && (
                <View style={styles.groceryPreview}>
                  <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                  <Text style={[styles.groceryText, styles.choresText]}>
                    {groceryPreview.length} item{groceryPreview.length !== 1 ? 's' : ''} on grocery list
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={[styles.emptyText, styles.choresText]}>No upcoming chores or grocery items</Text>
          )}
        </Card>

        {/* Premium Upsell for free users */}
        {!profile?.isPremium && (
          <View style={styles.premiumUpsell}>
            <View style={styles.premiumIconWrap}>
              <Ionicons name="crown" size={28} color="#b8860b" />
            </View>
            <View style={styles.premiumTextWrap}>
              <Text style={styles.premiumTitle}>Upgrade to Premium!</Text>
              <Text style={styles.premiumSubtitle}>
                Unlock the AI agent and premium features tailored to power up your day.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoIcon: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 28,
      height: 28,
      marginRight: spacing.sm,
    },
    logoDot: {
      width: 12,
      height: 12,
      borderRadius: 3,
      margin: 1,
    },
    logoText: {
      ...typography.h2,
      color: colors.text,
    },
    profileButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    profileImage: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
    },
    sectionButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    sectionButton: {
      alignItems: 'center',
    },
    sectionIconContainer: {
      width: 52,
      height: 52,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    sectionCard: {
      marginBottom: spacing.lg,
    },
    lastCard: {
      marginBottom: spacing.xxxl,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      ...typography.h3,
    },
    dateText: {
      ...typography.bodySmall,
      marginBottom: spacing.md,
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.textLight,
    },
    tasksList: {
      marginTop: spacing.sm,
    },
    taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    taskDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    taskText: {
      flex: 1,
      ...typography.body,
    },
    taskTime: {
      ...typography.caption,
      marginLeft: spacing.sm,
    },
    tasksOverviewCard: {
      backgroundColor: colors.tasks,
      borderColor: colors.tasks,
    },
    tasksOverviewTitle: {
      color: '#FFFFFF',
    },
    tasksOverviewText: {
      color: '#FFFFFF',
    },
    tasksOverviewMeta: {
      color: '#FFFFFFCC',
    },
    tasksOverviewDot: {
      backgroundColor: '#FFFFFF',
    },
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  moodLabel: {
    ...typography.body,
  },
  moodSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moodSummaryEmoji: {
    fontSize: 32,
    marginRight: spacing.sm,
  },
  moodSummaryText: {
    ...typography.body,
    fontWeight: '600',
  },
    healthPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    healthPromptText: {
      ...typography.bodySmall,
      color: colors.health,
      marginLeft: spacing.sm,
    },
    healthCard: {
      backgroundColor: colors.health,
      borderColor: colors.health,
    },
    healthTitle: {
      color: '#FFFFFF',
    },
    healthText: {
      color: '#FFFFFF',
    },
    habitsList: {
      marginTop: spacing.xs,
    },
    habitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    habitDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    habitText: {
      ...typography.body,
    },
    moodPromptCard: {
      backgroundColor: 'rgba(64, 164, 223, 0.15)',
      borderColor: 'rgba(64, 164, 223, 0.3)',
    },
    choreItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    choreText: {
      ...typography.body,
      marginLeft: spacing.sm,
      flex: 1,
    },
    reminderList: {
      marginTop: spacing.xs,
    },
    reminderItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: '#FFFFFF33',
    },
    reminderIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: '#FFFFFF22',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    reminderContent: {
      flex: 1,
    },
    reminderTitle: {
      ...typography.body,
      fontWeight: '600',
    },
    reminderMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    remindersCard: {
      backgroundColor: colors.routine,
      borderColor: colors.routine,
    },
    remindersTitle: {
      color: '#FFFFFF',
    },
    remindersText: {
      color: '#FFFFFF',
    },
    remindersMeta: {
      color: '#FFFFFFCC',
    },
    healthCard: {
      backgroundColor: colors.health,
      borderColor: colors.health,
    },
    healthTitle: {
      color: '#FFFFFF',
    },
    healthText: {
      color: '#FFFFFF',
    },
    groceryPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#FFFFFF33',
    },
    groceryText: {
      ...typography.bodySmall,
      marginLeft: spacing.sm,
    },
    choresCard: {
      backgroundColor: colors.routine,
      borderColor: colors.routine,
    },
    choresTitle: {
      color: '#FFFFFF',
    },
    choresText: {
      color: '#FFFFFF',
    },
    habitsCard: {
      backgroundColor: colors.habits,
      borderColor: colors.habits,
    },
    habitsTitle: {
      color: '#FFFFFF',
    },
    habitsText: {
      color: '#FFFFFF',
    },
    premiumUpsell: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FACC15',
      borderColor: '#b8860b',
      borderWidth: 3,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      marginTop: spacing.lg,
      marginBottom: spacing.xxxl,
      ...shadows.medium,
    },
    premiumIconWrap: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: '#f1c232',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.lg,
      borderWidth: 2,
      borderColor: '#b8860b',
    },
    premiumTextWrap: {
      flex: 1,
    },
    premiumTitle: {
      ...typography.h2,
      color: '#4a3b00',
      marginBottom: spacing.xs,
    },
    premiumSubtitle: {
      ...typography.body,
      color: '#4a3b00',
    },
  });

export default HomeScreen;
