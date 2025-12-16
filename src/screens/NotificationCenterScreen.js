import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { useNavigation } from '@react-navigation/native';

const NotificationCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Placeholder data for future real notifications
  const notifications = [
    {
      id: 'streak-warning',
      type: 'streak',
      title: 'Habit streak ending soon',
      body: 'Your habit streak will expire in 1 hour. Log today to keep it alive.',
      icon: 'flame',
      color: colors.habits,
    },
    {
      id: 'friend-request',
      type: 'friend',
      title: 'New friend request',
      body: 'Alex sent you a friend request.',
      icon: 'user-plus',
      iconType: 'feather',
      color: colors.primary,
    },
    {
      id: 'shared-task',
      type: 'task',
      title: 'Shared task added',
      body: 'Jamie added you to “Team Standup” tomorrow at 9:00 AM.',
      icon: 'people',
      color: colors.tasks,
    },
  ];

  const renderIcon = (item) => {
    if (item.iconType === 'feather') {
      return <Feather name={item.icon} size={20} color={item.color} />;
    }
    return <Ionicons name={item.icon} size={20} color={item.color} />;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notification Centre</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Recent</Text>
        {notifications.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}15` }]}>
              {renderIcon(item)}
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.placeholderBox}>
          <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.placeholderText}>
            Future notifications (streaks, friend requests, shared tasks) will appear here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.inputBackground,
  },
  title: {
    ...typography.h3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  placeholderBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeholderText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
});

export default NotificationCenterScreen;
