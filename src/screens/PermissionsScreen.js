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
import { colors, spacing, borderRadius, typography } from '../utils/theme';

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
    syncHealthMetricsFromPlatform,
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
  const nutritionSyncEnabled =
    Boolean(healthConnection?.syncNutritionToHealth) && canWriteNutritionToHealth;
  const connectButtonTitle = healthConnection?.isConnected
    ? `Reconnect ${healthProviderLabel}`
    : `Connect ${healthProviderLabel}`;
  const lastHealthSyncText = healthConnection?.lastSyncedAt
    ? new Date(healthConnection.lastSyncedAt).toLocaleString()
    : 'Not synced yet';

  const handleConnectHealth = async () => {
    try {
      setIsUpdatingHealthPermissions(true);
      await connectHealthIntegration({ syncNutritionToHealth: nutritionSyncEnabled });
      await syncHealthMetricsFromPlatform({ force: true });
    } catch (err) {
      Alert.alert('Unable to connect', err?.message || 'Please try again.');
    } finally {
      setIsUpdatingHealthPermissions(false);
    }
  };

  const handleDisconnectHealth = async () => {
    try {
      setIsUpdatingHealthPermissions(true);
      await disconnectHealthIntegration();
    } catch (err) {
      Alert.alert('Unable to disconnect', err?.message || 'Please try again.');
    } finally {
      setIsUpdatingHealthPermissions(false);
    }
  };

  const handleToggleNutritionSync = async (enabled) => {
    try {
      setIsUpdatingHealthPermissions(true);
      await setHealthNutritionSyncEnabled(enabled);
    } catch (err) {
      Alert.alert('Unable to update', err?.message || 'Please try again.');
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

          <TouchableOpacity
            style={[
              styles.connectHealthButton,
              { backgroundColor: themeColors.primary },
              isUpdatingHealthPermissions && styles.buttonDisabled,
            ]}
            onPress={handleConnectHealth}
            disabled={isUpdatingHealthPermissions}
          >
            <Text style={styles.connectHealthButtonText}>
              {isUpdatingHealthPermissions ? t('Updating...') : connectButtonTitle}
            </Text>
          </TouchableOpacity>

          {healthConnection?.isConnected && (
            <TouchableOpacity
              style={[
                styles.disconnectHealthButton,
                { borderColor: themeColors.border, backgroundColor: themeColors.card },
                isUpdatingHealthPermissions && styles.buttonDisabled,
              ]}
              onPress={handleDisconnectHealth}
              disabled={isUpdatingHealthPermissions}
            >
              <Text style={[styles.disconnectHealthButtonText, { color: themeColors.text }]}>
                {t('Disconnect')}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.nutritionToggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>
                {t('Sync nutrition totals to health app')}
              </Text>
              <Text style={styles.toggleSubtitle}>
                {canWriteNutritionToHealth
                  ? t('Write calories/macros from Pillaflow into your health app daily.')
                  : t('Not supported by current platform permission set.')}
              </Text>
            </View>
            <Switch
              value={nutritionSyncEnabled}
              onValueChange={handleToggleNutritionSync}
              disabled={!healthConnection?.isConnected || !canWriteNutritionToHealth || isUpdatingHealthPermissions}
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
    connectHealthButton: {
      marginTop: spacing.sm,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.65,
    },
    connectHealthButtonText: {
      ...typography.bodySmall,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    disconnectHealthButton: {
      marginTop: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disconnectHealthButtonText: {
      ...typography.bodySmall,
      fontWeight: '600',
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
