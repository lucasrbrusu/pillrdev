import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { Card, PlatformScrollView } from '../components';
import { colors, spacing, typography } from '../utils/theme';

const INVITE_OPTIONS = [
  {
    key: 'allowTaskInvites',
    title: 'Task invites',
    subtitle: 'Let other users invite you to shared tasks.',
  },
  {
    key: 'allowGroupInvites',
    title: 'Group invites',
    subtitle: 'Let other users invite you to groups.',
  },
  {
    key: 'allowHabitInvites',
    title: 'Habit invites',
    subtitle: 'Let other users share habits with you.',
  },
  {
    key: 'allowRoutineInvites',
    title: 'Routine invites',
    subtitle: 'Let other users invite you to shared routines.',
  },
];

const InvitationsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userSettings, updateUserSettings, themeColors, t } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleToggle = async (settingKey, enabled) => {
    try {
      await updateUserSettings({ [settingKey]: enabled });
    } catch (error) {
      Alert.alert('Unable to update invitations', error?.message || 'Please try again.');
    }
  };

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
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={24} color={themeColors?.text || colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Invitations')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('Who can invite you')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('Turn a category off to block new invites for it. People inviting you will get an error.')}
          </Text>

          {INVITE_OPTIONS.map((option, index) => (
            <View
              key={option.key}
              style={[
                styles.row,
                index === INVITE_OPTIONS.length - 1 ? styles.rowLast : null,
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{t(option.title)}</Text>
                <Text style={styles.rowSubtitle}>{t(option.subtitle)}</Text>
              </View>
              <Switch
                value={Boolean(userSettings?.[option.key])}
                onValueChange={(enabled) => handleToggle(option.key, enabled)}
                trackColor={{ false: '#9CA3AF', true: themeColors?.primary || colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </Card>
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors?.background || colors.background,
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
      paddingVertical: spacing.lg,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...typography.h3,
      color: themeColors?.text || colors.text,
    },
    headerSpacer: {
      width: 32,
    },
    card: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      color: themeColors?.text || colors.text,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: {
      ...typography.bodySmall,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: themeColors?.divider || colors.divider,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowCopy: {
      flex: 1,
      marginRight: spacing.md,
    },
    rowTitle: {
      ...typography.body,
      color: themeColors?.text || colors.text,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    rowSubtitle: {
      ...typography.bodySmall,
      color: themeColors?.textSecondary || colors.textSecondary,
    },
  });

export default InvitationsScreen;
