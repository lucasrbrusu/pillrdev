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

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { profile, signOut, themeColors, t } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);
  const isPremium = !!profile?.isPremium;

  const settingsOptions = [
    {
      id: 'general',
      label: 'General Settings',
      icon: 'options-outline',
      onPress: () => navigation.navigate('GeneralSettings'),
    },
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
      onPress: () => {},
    },
  ];

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
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Profile')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {profile.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color={colors.textLight} />
              </View>
            )}
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Ionicons name="star" size={14} color="#f1c232" style={styles.premiumIcon} />
                <Text style={styles.premiumText}>{t('Premium')}</Text>
              </View>
            )}
          </View>
          {!!profile.username && (
            <Text style={styles.profileUsername}>@{profile.username}</Text>
          )}
          <Text style={styles.profileEmail}>{profile.email}</Text>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editProfileText}>{t('Edit Profile')}</Text>
          </TouchableOpacity>

          {!isPremium && (
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
          )}
        </View>

        {/* Settings */}
        <Card style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>{t('Settings')}</Text>
          {settingsOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.settingItem,
                index < settingsOptions.length - 1 && styles.settingItemBorder,
              ]}
              onPress={option.onPress}
            >
              <Ionicons
                name={option.icon}
                size={22}
                color={colors.text}
                style={styles.settingIcon}
              />
              <Text style={styles.settingLabel}>{t(option.label)}</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textLight}
              />
            </TouchableOpacity>
          ))}
        </Card>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>{t('Sign Out')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Pillr v1.0.0</Text>
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
      ...typography.h2,
    },
    headerSpacer: {
      width: 32,
    },
    profileSection: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    avatarContainer: {
      marginBottom: spacing.lg,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
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
    },
    profileUsername: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    profileEmail: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
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
      backgroundColor: '#fff7e6',
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: '#f1c232',
    },
    premiumIcon: {
      marginRight: spacing.xs,
    },
    premiumText: {
      ...typography.caption,
      color: '#b8860b',
      fontWeight: '700',
    },
    editProfileButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    editProfileText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    settingsCard: {
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.md,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    settingItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    settingIcon: {
      fontSize: 20,
      marginRight: spacing.md,
    },
    settingLabel: {
      flex: 1,
      ...typography.body,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      marginBottom: spacing.xl,
    },
    signOutText: {
      ...typography.body,
      color: colors.danger,
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    versionText: {
      ...typography.caption,
      color: colors.textLight,
      textAlign: 'center',
    },
  });

export default ProfileScreen;
