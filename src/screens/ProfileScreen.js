import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, ProfileBadgeSlots } from '../components';
import { LinearGradient } from 'expo-linear-gradient';
import { buildAchievementSections, computeAchievementMetrics } from '../utils/achievements';
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
    achievementBadgeCatalog,
    habits,
    authUser,
    getCurrentStreak,
    t,
  } = useApp();
  const isDark = themeName === 'dark';
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
  const achievementMetrics = React.useMemo(
    () =>
      computeAchievementMetrics({
        habits,
        currentStreak,
        profileCreatedAt: profile?.createdAt,
        authCreatedAt: authUser?.created_at,
      }),
    [authUser?.created_at, currentStreak, habits, profile?.createdAt]
  );
  const achievementSections = React.useMemo(
    () =>
      buildAchievementSections({
        metrics: achievementMetrics,
        badgeSlots: profile?.badgeSlots,
      }),
    [achievementMetrics, profile?.badgeSlots]
  );
  const unlockedBadgeCount = React.useMemo(
    () =>
      achievementSections.reduce(
        (count, section) => count + section.badges.filter((badge) => badge.unlocked).length,
        0
      ),
    [achievementSections]
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
      id: 'permissions',
      label: 'Permissions',
      icon: 'lock-closed-outline',
      onPress: () => navigation.navigate('Permissions'),
    },
    {
      id: 'invitations',
      label: 'Invitations',
      icon: 'mail-open-outline',
      onPress: () => navigation.navigate('Invitations'),
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
      permissions: {
        bg: isDark ? 'rgba(14,165,233,0.2)' : '#E0F2FE',
        border: isDark ? 'rgba(14,165,233,0.35)' : '#BAE6FD',
        color: '#0EA5E9',
      },
      invitations: {
        bg: isDark ? 'rgba(6,182,212,0.2)' : '#CFFAFE',
        border: isDark ? 'rgba(6,182,212,0.35)' : '#A5F3FC',
        color: '#06B6D4',
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

        <Card
          style={styles.profileStatsCard}
          onPress={() => navigation.navigate('Achievements')}
        >
          <View style={styles.achievementsHeaderRow}>
            <View style={styles.achievementsHeaderIcon}>
              <Ionicons name="ribbon" size={16} color="#C7D2FE" />
            </View>
            <View style={styles.achievementsHeaderTextWrap}>
              <Text style={styles.achievementsTitle}>Achievements</Text>
              <Text style={styles.achievementsSubtitle}>{unlockedBadgeCount} unlocked badges</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={themeColors?.textSecondary || colors.textSecondary}
            />
          </View>

          <ProfileBadgeSlots
            badgeSlots={profile?.badgeSlots}
            badgeCatalog={achievementBadgeCatalog}
            textColor={themeColors?.text || colors.text}
            mutedColor={themeColors?.textSecondary || colors.textSecondary}
            cardColor={isDark ? 'rgba(15,23,42,0.5)' : '#F8FAFC'}
            borderColor={isDark ? 'rgba(148,163,184,0.3)' : '#E2E8F0'}
          />
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
      padding: spacing.lg,
      overflow: 'hidden',
      ...flatShadow,
    },
    achievementsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    achievementsHeaderIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(99,102,241,0.26)' : '#EEF2FF',
      marginRight: spacing.sm,
    },
    achievementsHeaderTextWrap: {
      flex: 1,
    },
    achievementsTitle: {
      ...typography.h3,
      color: baseText,
    },
    achievementsSubtitle: {
      ...typography.caption,
      color: mutedText,
      marginTop: 2,
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
