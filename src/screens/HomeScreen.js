import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import { colors, shadows, borderRadius, spacing, typography, moodEmojis } from '../utils/theme';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    habits,
    tasks,
    todayHealth,
    chores,
    reminders,
    groceries,
    profile,
    getTodayTasks,
  } = useApp();

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const todayTasks = getTodayTasks();
  const recentHabits = habits.slice(-5).reverse();
  const upcomingChores = chores.filter((c) => !c.completed).slice(0, 3);
  const upcomingReminders = reminders.slice(0, 3);
  const groceryPreview = groceries.filter((g) => !g.completed).slice(0, 3);

  const currentMood = todayHealth.mood
    ? moodEmojis.find((m) => m.value === todayHealth.mood)
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
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

        {/* Today's Overview */}
        <Card
          style={styles.sectionCard}
          onPress={() => navigation.navigate('Tasks')}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Today's Overview</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </View>
          <Text style={styles.dateText}>{formattedDate}</Text>
          {todayTasks.length > 0 ? (
            <View style={styles.tasksList}>
              {todayTasks.slice(0, 3).map((task) => (
                <View key={task.id} style={styles.taskItem}>
                  <View style={[styles.taskDot, { backgroundColor: colors.tasks }]} />
                  <Text style={styles.taskText} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.time && (
                    <Text style={styles.taskTime}>{task.time}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No tasks scheduled for today</Text>
          )}
        </Card>

        {/* Today's Health */}
        <Card
          style={styles.sectionCard}
          onPress={() => navigation.navigate('Health')}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Today's Health</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </View>
          {currentMood ? (
            <View style={styles.healthContent}>
              <Text style={styles.moodEmoji}>{currentMood.emoji}</Text>
              <Text style={styles.moodLabel}>Feeling {currentMood.label.toLowerCase()}</Text>
            </View>
          ) : (
            <View style={styles.healthPrompt}>
              <Ionicons name="heart-outline" size={20} color={colors.health} />
              <Text style={styles.healthPromptText}>
                Check in with your health and mood today
              </Text>
            </View>
          )}
        </Card>

        {/* Your Habits */}
        <Card
          style={styles.sectionCard}
          onPress={() => navigation.navigate('Habits')}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Habits</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </View>
          {recentHabits.length > 0 ? (
            <View style={styles.habitsList}>
              {recentHabits.map((habit) => (
                <View key={habit.id} style={styles.habitItem}>
                  <View style={[styles.habitDot, { backgroundColor: colors.habits }]} />
                  <Text style={styles.habitText} numberOfLines={1}>
                    {habit.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No habits yet</Text>
          )}
        </Card>

        {/* Home & Chores */}
        <Card
          style={[styles.sectionCard, styles.lastCard]}
          onPress={() => navigation.navigate('Routine')}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Home & Chores</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </View>
          {upcomingChores.length > 0 || groceryPreview.length > 0 ? (
            <View>
              {upcomingChores.map((chore) => (
                <View key={chore.id} style={styles.choreItem}>
                  <Ionicons name="checkbox-outline" size={18} color={colors.routine} />
                  <Text style={styles.choreText} numberOfLines={1}>
                    {chore.title}
                  </Text>
                </View>
              ))}
              {groceryPreview.length > 0 && (
                <View style={styles.groceryPreview}>
                  <Ionicons name="cart-outline" size={16} color={colors.textLight} />
                  <Text style={styles.groceryText}>
                    {groceryPreview.length} item{groceryPreview.length !== 1 ? 's' : ''} on grocery list
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>No upcoming chores or grocery items</Text>
          )}
        </Card>
      </ScrollView>
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
  healthPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthPromptText: {
    ...typography.bodySmall,
    color: colors.health,
    marginLeft: spacing.sm,
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
  groceryPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  groceryText: {
    ...typography.bodySmall,
    marginLeft: spacing.sm,
  },
});

export default HomeScreen;
