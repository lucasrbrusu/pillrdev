import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';

const NotificationCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors } = useApp();

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

  const themedStyles = React.useMemo(() => createStyles(themeColors || colors), [themeColors]);

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>Notification Centre</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={themedStyles.sectionLabel}>Recent</Text>
        {notifications.map((item) => (
          <View key={item.id} style={themedStyles.card}>
            <View style={[themedStyles.iconWrap, { backgroundColor: `${item.color}15` }]}>
              {renderIcon(item)}
            </View>
            <View style={themedStyles.textWrap}>
              <Text style={themedStyles.cardTitle}>{item.title}</Text>
              <Text style={themedStyles.cardBody}>{item.body}</Text>
            </View>
          </View>
        ))}

        <View style={themedStyles.placeholderBox}>
          <Ionicons name="notifications-outline" size={20} color={themedStyles.subduedText} />
          <Text style={themedStyles.placeholderText}>
            Future notifications (streaks, friend requests, shared tasks) will appear here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColors) => {
  const baseText = themeColors?.text || colors.text;
  const subdued = themeColors?.textSecondary || colors.textSecondary;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors?.background || colors.background,
    },
    iconColor: baseText,
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
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
    },
    title: {
      ...typography.h3,
      color: baseText,
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
      color: subdued,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: themeColors?.card || colors.card,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
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
      color: baseText,
    },
    cardBody: {
      ...typography.bodySmall,
      color: subdued,
      lineHeight: 18,
    },
    placeholderBox: {
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    placeholderText: {
      ...typography.bodySmall,
      color: subdued,
      flex: 1,
    },
    subduedText: subdued,
  });
};

export default NotificationCenterScreen;
