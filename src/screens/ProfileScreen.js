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
  const { profile, signOut, themeColors } = useApp();

  const settingsOptions = [
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => {},
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
      onPress: () => {},
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
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
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
          <Text style={styles.headerTitle}>Profile</Text>
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
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <Card style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
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
              <Text style={styles.settingLabel}>{option.label}</Text>
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
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Pillr v1.0.0</Text>
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
  profileName: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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

