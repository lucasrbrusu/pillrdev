import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import { colors, spacing, typography } from '../utils/theme';

const PermissionsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    t,
    healthConnection,
    connectHealthIntegration,
    disconnectHealthIntegration,
    setHealthNutritionSyncEnabled,
    userSettings,
    setCalendarSyncEnabled,
    hasCalendarPermission,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [isUpdatingHealthPermissions, setIsUpdatingHealthPermissions] = useState(false);
  const [isUpdatingCalendarPermissions, setIsUpdatingCalendarPermissions] = useState(false);

  const healthProviderLabel =
    healthConnection?.providerLabel ||
    (Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect');
  const canWriteNutritionToHealth = Boolean(healthConnection?.canWriteNutrition);
  const stepsSyncEnabled = Boolean(healthConnection?.isConnected);
  const nutritionSyncEnabled =
    Boolean(healthConnection?.syncNutritionToHealth) && canWriteNutritionToHealth;
  const nutritionSubtitle = !stepsSyncEnabled
    ? t('Enable steps sync first to request nutrition write permission.')
    : canWriteNutritionToHealth
      ? t('Write calories/macros from Pillaflow into your health app daily.')
      : t('Nutrition write permission not granted. Re-enable steps sync or allow access in the health app settings.');
  const lastHealthSyncText = healthConnection?.lastSyncedAt
    ? new Date(healthConnection.lastSyncedAt).toLocaleString()
    : 'Not synced yet';

  const getHealthErrorMessage = (rawMessage) => {
    const message = String(rawMessage || '').trim();
    if (!message) return 'Please try again.';
    if (message === 'health_connect_not_installed') {
      return 'Health Connect is not installed on this device.';
    }
    if (message === 'health_connect_provider_update_required') {
      return 'Health Connect needs an update before sync can be enabled.';
    }
    if (message === 'ios_healthkit_module_missing') {
      return 'Apple Health support is not available in this app build.';
    }
    if (message === 'nutrition_permission_not_granted') {
      return 'Steps sync was enabled, but nutrition write permission was not granted.';
    }
    if (message.includes('timeout')) {
      return 'Health permission check timed out. Please try again.';
    }
    return message;
  };

  const handleToggleStepsSync = async (enabled) => {
    try {
      setIsUpdatingHealthPermissions(true);
      if (enabled) {
        await connectHealthIntegration({ syncNutritionToHealth: nutritionSyncEnabled });
      } else {
        await disconnectHealthIntegration();
      }
    } catch (err) {
      Alert.alert(
        enabled ? 'Unable to enable steps sync' : 'Unable to disable steps sync',
        getHealthErrorMessage(err?.message)
      );
    } finally {
      setIsUpdatingHealthPermissions(false);
    }
  };

  const handleToggleNutritionSync = async (enabled) => {
    try {
      setIsUpdatingHealthPermissions(true);
      await setHealthNutritionSyncEnabled(enabled);
    } catch (err) {
      Alert.alert('Unable to update', getHealthErrorMessage(err?.message));
    } finally {
      setIsUpdatingHealthPermissions(false);
    }
  };

  const handleToggleCalendarSync = async (enabled) => {
    try {
      setIsUpdatingCalendarPermissions(true);
      await setCalendarSyncEnabled(enabled);
    } catch (err) {
      Alert.alert('Calendar permission', err?.message || 'Unable to update calendar permission.');
    } finally {
      setIsUpdatingCalendarPermissions(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
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
          <Text style={styles.headerTitle}>{t('Permissions')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('Health permissions')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('Allow read/write access for platform health syncing.')}
          </Text>

          <View style={styles.permissionItem}>
            <Ionicons name="walk-outline" size={16} color={themeColors.primary} />
            <Text style={styles.permissionItemText}>{t('Steps (read daily snapshots)')}</Text>
          </View>
          <View style={styles.permissionItem}>
            <Ionicons name="flame-outline" size={16} color={themeColors.warning || '#F59E0B'} />
            <Text style={styles.permissionItemText}>{t('Active calories (optional read)')}</Text>
          </View>
          <View style={styles.permissionItem}>
            <Ionicons name="nutrition-outline" size={16} color={themeColors.success || '#22C55E'} />
            <Text style={styles.permissionItemText}>{t('Nutrition totals (optional write)')}</Text>
          </View>

          <View style={styles.stepsToggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>{`Enable ${healthProviderLabel} steps sync`}</Text>
              <Text style={styles.toggleSubtitle}>
                When enabled, steps sync automatically while app is open and in background
                (best effort every ~15 minutes).
              </Text>
            </View>
            <Switch
              value={stepsSyncEnabled}
              onValueChange={handleToggleStepsSync}
              disabled={isUpdatingHealthPermissions}
              trackColor={{ false: '#9CA3AF', true: themeColors.primary }}
            />
          </View>

          <View style={styles.nutritionToggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>
                {t('Sync nutrition totals to health app')}
              </Text>
              <Text style={styles.toggleSubtitle}>{nutritionSubtitle}</Text>
            </View>
            <Switch
              value={nutritionSyncEnabled}
              onValueChange={handleToggleNutritionSync}
              disabled={!stepsSyncEnabled || !canWriteNutritionToHealth || isUpdatingHealthPermissions}
              trackColor={{ false: '#9CA3AF', true: themeColors.primary }}
            />
          </View>

          <Text style={styles.metaText}>
            {t('Status')}: {healthConnection?.isConnected ? t('Connected') : t('Disconnected')}
          </Text>
          <Text style={styles.metaText}>
            {t('Last sync')}: {lastHealthSyncText}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('Calendar permissions')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('Allow calendar import and export between your device and Pillaflow tasks.')}
          </Text>

          <View style={styles.permissionItem}>
            <Ionicons name="calendar-outline" size={16} color={themeColors.info || '#0EA5E9'} />
            <Text style={styles.permissionItemText}>{t('Calendar events (read import, write export)')}</Text>
          </View>

          <View style={styles.calendarToggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>{t('Calendar import and export')}</Text>
              <Text style={styles.toggleSubtitle}>
                {hasCalendarPermission
                  ? t('Import device calendar events as tasks and export tasks back to your device calendar.')
                  : t('Enable to request iOS/Android calendar permission for task import/export.')}
              </Text>
            </View>
            <Switch
              value={Boolean(userSettings?.calendarSyncEnabled)}
              onValueChange={handleToggleCalendarSync}
              disabled={isUpdatingCalendarPermissions}
              trackColor={{ false: '#9CA3AF', true: themeColors.primary }}
            />
          </View>

          <Text style={styles.metaText}>
            {t('Calendar access')}: {hasCalendarPermission ? t('Allowed') : t('Not allowed')}
          </Text>
        </Card>
      </ScrollView>
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
      paddingBottom: spacing.xxl,
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
      marginTop: spacing.md,
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
    permissionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    permissionItemText: {
      ...typography.bodySmall,
      color: themeColors?.text || colors.text,
      marginLeft: spacing.sm,
      flex: 1,
    },
    stepsToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    nutritionToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    calendarToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    toggleTextWrap: {
      flex: 1,
      marginRight: spacing.md,
    },
    toggleTitle: {
      ...typography.bodySmall,
      color: themeColors?.text || colors.text,
      fontWeight: '600',
    },
    toggleSubtitle: {
      ...typography.caption,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginTop: 2,
    },
    metaText: {
      ...typography.caption,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginTop: 2,
    },
  });

export default PermissionsScreen;
