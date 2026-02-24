import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import { LinearGradient } from 'expo-linear-gradient';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} from '../utils/theme';

const getInitials = (name, username, email) => {
  const source = (name || username || email || '').trim();
  if (!source) return 'U';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    profile,
    signOut,
    themeColors,
    themeName,
    tasks,
    getCurrentStreak,
    healthConnection,
    connectHealthIntegration,
    disconnectHealthIntegration,
    setHealthNutritionSyncEnabled,
    syncHealthMetricsFromPlatform,
    userSettings,
    setCalendarSyncEnabled,
    hasCalendarPermission,
    t,
  } = useApp();
  const isDark = themeName === 'dark';
  const [isUpdatingHealthPermissions, setIsUpdatingHealthPermissions] = React.useState(false);
  const [isUpdatingCalendarPermissions, setIsUpdatingCalendarPermissions] = React.useState(false);
  const profileTheme = React.useMemo(
    () => ({
      settingsBg: isDark ? '#0F172A' : '#FFFFFF',
      settingsBorder: isDark ? '#1F2937' : '#E7E5F0',
      signOutBg: isDark ? '#111827' : '#F9FAFB',
      signOutBorder: isDark ? '#1F2937' : '#E5E7EB',
    }),
    [isDark]
  );
  const styles = React.useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const isPremium = !!profile?.isPremium;
  const currentStreak = getCurrentStreak ? getCurrentStreak() : 0;
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((task) => task.completed).length || 0;
  const successRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const stats = React.useMemo(
    () => [
      {
        id: 'streak',
        label: t('Current streak'),
        value: currentStreak,
        icon: 'flame',
        color: '#F97316',
        bg: isDark ? 'rgba(249,115,22,0.18)' : '#FFEDD5',
        border: isDark ? 'rgba(249,115,22,0.35)' : '#FED7AA',
      },
      {
        id: 'tasks',
        label: t('Tasks Done'),
        value: completedTasks,
        icon: 'ribbon',
        color: '#A855F7',
        bg: isDark ? 'rgba(168,85,247,0.18)' : '#F3E8FF',
        border: isDark ? 'rgba(168,85,247,0.35)' : '#E9D5FF',
      },
      {
        id: 'success',
        label: t('Success'),
        value: `${successRate}%`,
        icon: 'trending-up',
        color: '#22C55E',
        bg: isDark ? 'rgba(34,197,94,0.18)' : '#DCFCE7',
        border: isDark ? 'rgba(34,197,94,0.35)' : '#BBF7D0',
      },
    ],
    [currentStreak, completedTasks, isDark, successRate, t]
  );

  const settingsOptions = [
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => navigation.navigate('NotificationSettings'),
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: 'color-palette-outline',
      onPress: () => navigation.navigate('Appearance'),
    },
    {
      id: 'membership',
      label: 'Your membership',
      icon: 'card-outline',
      onPress: () => navigation.navigate('Membership'),
    },
    {
      id: 'privacy',
      label: 'Privacy & Security',
      icon: 'shield-checkmark-outline',
      onPress: () => navigation.navigate('PrivacySecurity'),
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: () => navigation.navigate('HelpSupport'),
    },
  ];
  const settingsPalette = React.useMemo(
    () => ({
      notifications: {
        bg: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
        border: isDark ? 'rgba(59,130,246,0.35)' : '#BFDBFE',
        color: '#3B82F6',
      },
      appearance: {
        bg: isDark ? 'rgba(168,85,247,0.2)' : '#F3E8FF',
        border: isDark ? 'rgba(168,85,247,0.35)' : '#E9D5FF',
        color: '#A855F7',
      },
      membership: {
        bg: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7',
        border: isDark ? 'rgba(245,158,11,0.35)' : '#FDE68A',
        color: '#F59E0B',
      },
      privacy: {
        bg: isDark ? 'rgba(34,197,94,0.2)' : '#DCFCE7',
        border: isDark ? 'rgba(34,197,94,0.35)' : '#BBF7D0',
        color: '#22C55E',
      },
      help: {
        bg: isDark ? 'rgba(249,115,22,0.2)' : '#FFEDD5',
        border: isDark ? 'rgba(249,115,22,0.35)' : '#FED7AA',
        color: '#F97316',
      },
    }),
    [isDark]
  );
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

  const handleSignOut = () => {
    Alert.alert(
      t('Sign Out'),
      t('Are you sure you want to sign out?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Sign Out'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Profile')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Profile Info */}
        <Card style={styles.profileInfoCard}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.profileInfoRow}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.profileAvatarWrap}>
              {profile.photo ? (
                <Image source={{ uri: profile.photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {getInitials(profile.name, profile.username, profile.email)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.profileTextWrap}>
              <View style={styles.profileTitleRow}>
                <Text style={styles.profileUsername} numberOfLines={1}>
                  {profile.username ? `@${profile.username}` : profile.name || t('Profile')}
                </Text>
                {isPremium && (
                  <View style={styles.premiumChip}>
                    <Ionicons name="star" size={11} color="#FFFFFF" style={styles.premiumChipIcon} />
                    <Text style={styles.premiumChipText}>{t('Premium')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {profile.email}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColors?.textSecondary || colors.textSecondary}
            />
          </TouchableOpacity>
        </Card>

        <Card style={styles.profileStatsCard}>
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.id} style={styles.statItem}>
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: stat.bg, borderColor: stat.border },
                  ]}
                >
                  <Ionicons name={stat.icon} size={18} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {!isPremium && (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate('Paywall', { source: 'profile' })}
            style={styles.premiumUpsellWrap}
          >
            <LinearGradient
              colors={['#fbe7a1', '#f5c542', '#f3b11c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumUpsell}
            >
              <View style={styles.premiumShine} />
              <View style={styles.premiumIconWrap}>
                <Ionicons name="star" size={22} color="#b8860b" />
              </View>
              <View style={styles.premiumTextWrap}>
                <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                <Text style={styles.premiumSubtitle}>Unlock AI agent and premium perks.</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Insights */}
        <Card style={styles.insightsCard}>
          <TouchableOpacity
            style={styles.insightsRow}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Insights')}
          >
            <View style={styles.insightsIconWrap}>
              <Ionicons name="bar-chart-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.insightsTextWrap}>
              <Text style={styles.insightsTitle}>View Insights</Text>
              <Text style={styles.insightsSubtitle}>Weekly & monthly reports</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColors?.textSecondary || colors.textSecondary}
            />
          </TouchableOpacity>
        </Card>

        {/* Settings */}
        <Card
          style={[
            styles.settingsCard,
            { backgroundColor: profileTheme.settingsBg, borderColor: profileTheme.settingsBorder },
          ]}
        >
          <Text style={styles.sectionTitle}>{t('Settings')}</Text>
          {settingsOptions.map((option, index) => {
            const palette = settingsPalette[option.id] || settingsPalette.help;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.settingItem,
                  index < settingsOptions.length - 1 && styles.settingItemBorder,
                ]}
                onPress={option.onPress}
              >
                <View
                  style={[
                    styles.settingIconBadge,
                    { backgroundColor: palette.bg, borderColor: palette.border },
                  ]}
                >
                  <Ionicons name={option.icon} size={18} color={palette.color} />
                </View>
                <Text style={styles.settingLabel}>{t(option.label)}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={themeColors.textLight}
                />
              </TouchableOpacity>
            );
          })}
        </Card>

        <Card
          style={[
            styles.permissionsCard,
            { backgroundColor: profileTheme.settingsBg, borderColor: profileTheme.settingsBorder },
          ]}
        >
          <Text style={styles.sectionTitle}>{t('Permissions')}</Text>
          <Text style={styles.permissionsSubtitle}>
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
          <View style={styles.permissionItem}>
            <Ionicons name="calendar-outline" size={16} color={themeColors.info || '#0EA5E9'} />
            <Text style={styles.permissionItemText}>{t('Calendar events (read import, write export)')}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.connectHealthButton,
              { backgroundColor: themeColors.primary },
              isUpdatingHealthPermissions && styles.connectHealthButtonDisabled,
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
                isUpdatingHealthPermissions && styles.connectHealthButtonDisabled,
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
            <View style={styles.nutritionToggleTextWrap}>
              <Text style={styles.nutritionToggleTitle}>
                {t('Sync nutrition totals to health app')}
              </Text>
              <Text style={styles.nutritionToggleSubtitle}>
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

          <View style={styles.calendarToggleRow}>
            <View style={styles.calendarToggleTextWrap}>
              <Text style={styles.calendarToggleTitle}>{t('Calendar import and export')}</Text>
              <Text style={styles.calendarToggleSubtitle}>
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

          <Text style={styles.permissionMeta}>
            {t('Status')}: {healthConnection?.isConnected ? t('Connected') : t('Disconnected')}
          </Text>
          <Text style={styles.permissionMeta}>
            {t('Last sync')}: {lastHealthSyncText}
          </Text>
          <Text style={styles.permissionMeta}>
            {t('Calendar access')}: {hasCalendarPermission ? t('Allowed') : t('Not allowed')}
          </Text>
        </Card>

        {/* Sign Out */}
        <TouchableOpacity
          style={[
            styles.signOutButton,
            { backgroundColor: profileTheme.signOutBg, borderColor: profileTheme.signOutBorder },
          ]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={themeColors.danger} />
          <Text style={styles.signOutText}>{t('Sign Out')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Pillaflow v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors, isDark = false) => {
  const baseText = themeColorsParam?.text || colors.text;
  const mutedText = themeColorsParam?.textSecondary || colors.textSecondary;
  const lightText = themeColorsParam?.textLight || colors.textLight;
  const mutedBorder = isDark ? '#272A35' : '#EEE6FF';
  const flatShadow = isDark
    ? { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 }
    : shadows.small;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColorsParam?.background || colors.background,
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
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    headerTitle: {
      ...typography.h2,
      color: baseText,
    },
    headerSpacer: {
      width: 40,
    },
    profileInfoCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: mutedBorder,
      backgroundColor: themeColorsParam?.card || colors.card,
      marginBottom: spacing.md,
      ...flatShadow,
    },
    profileInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    profileAvatarWrap: {
      width: 52,
      height: 52,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.full,
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    profileTextWrap: {
      flex: 1,
    },
    profileTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 2,
    },
    profileUsername: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
      flexShrink: 1,
    },
    profileEmail: {
      ...typography.bodySmall,
      color: mutedText,
    },
    profileStatsCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      backgroundColor: themeColorsParam?.card || colors.card,
      marginBottom: spacing.lg,
      padding: 0,
      overflow: 'hidden',
      ...flatShadow,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginBottom: spacing.xs,
    },
    statValue: {
      ...typography.h3,
      color: baseText,
      marginBottom: 2,
    },
    statLabel: {
      ...typography.caption,
      color: mutedText,
    },
    premiumUpsellWrap: {
      width: '100%',
    },
    premiumUpsell: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FACC15',
      borderColor: '#b8860b',
      borderWidth: 2,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginTop: spacing.lg,
      width: '100%',
      overflow: 'hidden',
      position: 'relative',
      ...shadows.medium,
    },
    premiumIconWrap: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: '#f1c232',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
      borderWidth: 1,
      borderColor: '#b8860b',
    },
    premiumTextWrap: {
      flex: 1,
    },
    premiumShine: {
      position: 'absolute',
      top: 0,
      left: -100,
      width: 140,
      height: '120%',
      backgroundColor: 'rgba(255,255,255,0.35)',
      transform: [{ rotate: '20deg' }],
    },
    premiumTitle: {
      ...typography.body,
      color: '#000000',
      fontWeight: '700',
    },
    premiumSubtitle: {
      ...typography.bodySmall,
      color: '#000000',
      marginTop: 2,
    },
    premiumChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F59E0B',
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    premiumChipIcon: {
      marginRight: spacing.xs,
    },
    premiumChipText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    insightsCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: mutedBorder,
      backgroundColor: themeColorsParam?.card || colors.card,
      marginTop: spacing.lg,
      ...flatShadow,
    },
    insightsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    insightsIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#6D28D9' : '#7C3AED',
    },
    insightsTextWrap: {
      flex: 1,
    },
    insightsTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    insightsSubtitle: {
      ...typography.bodySmall,
      color: mutedText,
      marginTop: 2,
    },
    settingsCard: {
      marginTop: spacing.md,
      marginBottom: spacing.xl,
      borderRadius: borderRadius.xl,
    },
    sectionTitle: {
      ...typography.h3,
      color: baseText,
      marginBottom: spacing.md,
    },
    permissionsCard: {
      marginBottom: spacing.xl,
      borderRadius: borderRadius.xl,
    },
    permissionsSubtitle: {
      ...typography.bodySmall,
      color: mutedText,
      marginBottom: spacing.md,
    },
    permissionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    permissionItemText: {
      ...typography.bodySmall,
      color: baseText,
      marginLeft: spacing.sm,
    },
    connectHealthButton: {
      marginTop: spacing.sm,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    connectHealthButtonDisabled: {
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
    nutritionToggleTextWrap: {
      flex: 1,
      marginRight: spacing.md,
    },
    nutritionToggleTitle: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '600',
    },
    nutritionToggleSubtitle: {
      ...typography.caption,
      color: mutedText,
      marginTop: 2,
    },
    calendarToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    calendarToggleTextWrap: {
      flex: 1,
      marginRight: spacing.md,
    },
    calendarToggleTitle: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '600',
    },
    calendarToggleSubtitle: {
      ...typography.caption,
      color: mutedText,
      marginTop: 2,
    },
    permissionMeta: {
      ...typography.caption,
      color: mutedText,
      marginTop: 2,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    settingItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: themeColorsParam?.divider || colors.divider,
    },
    settingIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginRight: spacing.md,
    },
    settingLabel: {
      flex: 1,
      ...typography.body,
      color: baseText,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      marginBottom: spacing.xl,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    signOutText: {
      ...typography.body,
      color: themeColorsParam?.danger || colors.danger,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    versionText: {
      ...typography.caption,
      color: lightText,
      textAlign: 'center',
    },
  });
};

export default ProfileScreen;
