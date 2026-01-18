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
import { supabase } from '../utils/supabaseClient';
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
  const { profile, signOut, themeColors, themeName, tasks, getBestStreak, t } = useApp();
  const isDark = themeName === 'dark';
  const profileTheme = React.useMemo(
    () => ({
      heroGradient: isDark ? ['#1F1B2F', '#0B1020'] : ['#F7E8FF', '#FDF4FF'],
      cardBg: isDark ? '#0F172A' : '#FFFFFF',
      cardBorder: isDark ? '#1F2937' : '#E7E5F0',
      avatarRing: isDark ? ['#8B5CF6', '#F97316'] : ['#C084FC', '#F97316'],
      buttonGradient: isDark ? ['#8B5CF6', '#EC4899'] : ['#A855F7', '#EC4899'],
      buttonText: '#FFFFFF',
      chipBg: isDark ? 'rgba(148,163,184,0.2)' : '#F3E8FF',
      chipBorder: isDark ? 'rgba(148,163,184,0.35)' : '#E7D5FF',
      chipText: isDark ? '#E2E8F0' : '#6B21A8',
      settingsBg: isDark ? '#0F172A' : '#FFFFFF',
      settingsBorder: isDark ? '#1F2937' : '#E7E5F0',
      signOutBg: isDark ? '#111827' : '#F9FAFB',
      signOutBorder: isDark ? '#1F2937' : '#E5E7EB',
    }),
    [isDark]
  );
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);
  const isPremium = !!profile?.isPremium;
  const bestStreak = getBestStreak ? getBestStreak() : 0;
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((task) => task.completed).length || 0;
  const successRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const stats = React.useMemo(
    () => [
      {
        id: 'streak',
        label: t('Day Streak'),
        value: bestStreak,
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
    [bestStreak, completedTasks, isDark, successRate, t]
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
        <LinearGradient
          colors={profileTheme.heroGradient}
          style={[styles.heroCard, { borderColor: profileTheme.cardBorder }]}
        >
          <View style={styles.heroContent}>
            <LinearGradient colors={profileTheme.avatarRing} style={styles.avatarRing}>
              {profile.photo ? (
                <Image source={{ uri: profile.photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {getInitials(profile.name, profile.username, profile.email)}
                  </Text>
                </View>
              )}
            </LinearGradient>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{profile.name}</Text>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <LinearGradient
                    colors={[
                      'rgba(255,255,255,0.6)',
                      'rgba(255,255,255,0.12)',
                      'rgba(255,255,255,0)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.premiumBadgeShine}
                    pointerEvents="none"
                  />
                  <View style={styles.premiumBadgeContent}>
                    <Ionicons name="star" size={13} color="#FFFFFF" style={styles.premiumIcon} />
                    <Text style={styles.premiumText}>{t('Premium')}</Text>
                  </View>
                </View>
              )}
            </View>
            {!!profile.username && (
              <Text style={styles.profileUsername}>@{profile.username}</Text>
            )}
            <Text style={styles.profileEmail}>{profile.email}</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.editProfileButtonWrap}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <LinearGradient
                colors={profileTheme.buttonGradient}
                style={styles.editProfileButton}
              >
                <Text style={styles.editProfileText}>{t('Edit Profile')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <View style={styles.statsDivider} />
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
        </LinearGradient>

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
        <Text style={styles.versionText}>PillarUp v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const mutedText = themeColorsParam?.textSecondary || colors.textSecondary;
  const lightText = themeColorsParam?.textLight || colors.textLight;
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
    heroCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      ...shadows.medium,
    },
    heroContent: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    avatarRing: {
      width: 110,
      height: 110,
      borderRadius: 55,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    avatarPlaceholder: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: themeColorsParam?.card || colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      ...typography.h2,
      color: baseText,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    profileName: {
      ...typography.h2,
      color: baseText,
    },
    profileUsername: {
      ...typography.bodySmall,
      color: mutedText,
      marginBottom: spacing.xs,
    },
    profileEmail: {
      ...typography.bodySmall,
      color: mutedText,
      marginBottom: spacing.lg,
    },
    editProfileButtonWrap: {
      width: '100%',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    editProfileButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.full,
      minWidth: 160,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    editProfileText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    statsDivider: {
      height: 1,
      width: '100%',
      backgroundColor: themeColorsParam?.divider || colors.divider,
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
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F59E0B',
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      position: 'relative',
      overflow: 'hidden',
      ...shadows.small,
    },
    premiumBadgeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 1,
    },
    premiumBadgeShine: {
      position: 'absolute',
      top: -6,
      left: -18,
      width: '70%',
      height: '140%',
      transform: [{ rotate: '-12deg' }],
      opacity: 0.75,
    },
    premiumIcon: {
      marginRight: spacing.xs,
    },
    premiumText: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    settingsCard: {
      marginTop: spacing.lg,
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
