import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Input } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} from '../utils/theme';

const getInitials = (name, email) => {
  const source = (name || email || '').trim();
  if (!source) return 'U';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const EditProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { profile, updateProfile, deleteAccount, themeColors, themeName, tasks, getBestStreak } = useApp();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);
  const isDark = themeName === 'dark';
  const profileTheme = React.useMemo(
    () => ({
      heroGradient: isDark ? ['#1F1B2F', '#0B1020'] : ['#F7E8FF', '#FDF4FF'],
      cardBg: isDark ? '#0F172A' : '#FFFFFF',
      cardBorder: isDark ? '#1F2937' : '#E7E5F0',
      avatarRing: isDark ? ['#8B5CF6', '#F97316'] : ['#C084FC', '#F97316'],
      buttonGradient: isDark ? ['#8B5CF6', '#EC4899'] : ['#A855F7', '#EC4899'],
      buttonText: '#FFFFFF',
      secondaryBg: isDark ? '#111827' : '#F9FAFB',
      secondaryBorder: isDark ? '#1F2937' : '#E5E7EB',
      secondaryText: themeColors.text,
      statDivider: isDark ? '#1F2937' : '#EAE6F3',
      goalTints: {
        calorie: {
          bg: isDark ? 'rgba(249,115,22,0.18)' : '#FFF3E7',
          border: isDark ? 'rgba(249,115,22,0.35)' : '#FFD9B5',
          icon: '#F97316',
        },
        water: {
          bg: isDark ? 'rgba(59,130,246,0.18)' : '#EFF6FF',
          border: isDark ? 'rgba(59,130,246,0.35)' : '#BFDBFE',
          icon: '#3B82F6',
        },
        sleep: {
          bg: isDark ? 'rgba(168,85,247,0.18)' : '#F5F3FF',
          border: isDark ? 'rgba(168,85,247,0.35)' : '#DDD6FE',
          icon: '#8B5CF6',
        },
      },
    }),
    [isDark, themeColors]
  );
  const isPremium = !!profile?.isPremium;
  const bestStreak = getBestStreak ? getBestStreak() : 0;
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((task) => task.completed).length || 0;
  const successRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [photo, setPhoto] = useState(profile.photo);
  const [calorieGoal, setCalorieGoal] = useState(String(profile.dailyCalorieGoal));
  const [waterGoal, setWaterGoal] = useState(String(profile.dailyWaterGoal));
  const [sleepGoal, setSleepGoal] = useState(String(profile.dailySleepGoal));
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    await updateProfile({
      name: name.trim(),
      email: email.trim(),
      photo,
      dailyCalorieGoal: parseInt(calorieGoal) || 2000,
      dailyWaterGoal: parseFloat(waterGoal) || 2,
      dailySleepGoal: parseInt(sleepGoal) || 8,
    });
    navigation.goBack();
  };

  const handleChangePhoto = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleChangePassword = () => {
    Alert.alert('Change Password', 'Password change flow would start here');
  };

  const handleExportData = () => {
    Alert.alert('Export Data', 'Your data export would be prepared here');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (deleting) return;
            try {
              setDeleting(true);
              await deleteAccount();
            } catch (error) {
              Alert.alert('Delete failed', error?.message || 'Unable to delete your account.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <LinearGradient
                colors={profileTheme.buttonGradient}
                style={styles.saveButtonInner}
              >
                <Text style={styles.saveText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Hero */}
        <LinearGradient
          colors={profileTheme.heroGradient}
          style={[styles.heroCard, { borderColor: profileTheme.cardBorder }]}
        >
          <View style={styles.heroContent}>
            <TouchableOpacity onPress={handleChangePhoto} style={styles.avatarTap}>
              <LinearGradient colors={profileTheme.avatarRing} style={styles.avatarRing}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {getInitials(profile.name, profile.email)}
                    </Text>
                  </View>
                )}
              </LinearGradient>
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
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
                    <Text style={styles.premiumText}>Premium</Text>
                  </View>
                </View>
              )}
            </View>
            {!!profile.username && <Text style={styles.profileHandle}>@{profile.username}</Text>}
            <Text style={styles.profileEmail}>{profile.email}</Text>
          </View>
          <View style={[styles.statsDivider, { backgroundColor: profileTheme.statDivider }]} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconWrap,
                  {
                    backgroundColor: profileTheme.goalTints.calorie.bg,
                    borderColor: profileTheme.goalTints.calorie.border,
                  },
                ]}
              >
                <Ionicons name="flame" size={18} color={profileTheme.goalTints.calorie.icon} />
              </View>
              <Text style={styles.statValue}>{bestStreak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconWrap,
                  {
                    backgroundColor: profileTheme.goalTints.sleep.bg,
                    borderColor: profileTheme.goalTints.sleep.border,
                  },
                ]}
              >
                <Ionicons name="ribbon" size={18} color={profileTheme.goalTints.sleep.icon} />
              </View>
              <Text style={styles.statValue}>{completedTasks}</Text>
              <Text style={styles.statLabel}>Tasks Done</Text>
            </View>
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconWrap,
                  {
                    backgroundColor: profileTheme.goalTints.water.bg,
                    borderColor: profileTheme.goalTints.water.border,
                  },
                ]}
              >
                <Ionicons name="trending-up" size={18} color={profileTheme.goalTints.water.icon} />
              </View>
              <Text style={styles.statValue}>{successRate}%</Text>
              <Text style={styles.statLabel}>Success</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Personal Information */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder },
          ]}
        >
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            containerStyle={styles.formInputContainer}
            style={styles.formInput}
            inputStyle={styles.formInputText}
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={styles.formInputContainer}
            style={styles.formInput}
            inputStyle={styles.formInputText}
          />
          <TouchableOpacity
            style={styles.changePasswordButton}
            onPress={handleChangePassword}
          >
            <LinearGradient
              colors={profileTheme.buttonGradient}
              style={styles.changePasswordInner}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
              <Text style={styles.changePasswordText}>Change Password</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Card>

        {/* Health Goals */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder },
          ]}
        >
          <Text style={styles.sectionTitle}>Health Goals</Text>
          <Input
            label="Daily Calorie Goal"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            placeholder="2000"
            keyboardType="numeric"
            icon="nutrition-outline"
            containerStyle={styles.formInputContainer}
            style={[
              styles.formInput,
              {
                backgroundColor: profileTheme.goalTints.calorie.bg,
                borderColor: profileTheme.goalTints.calorie.border,
              },
            ]}
            inputStyle={styles.formInputText}
          />
          <Input
            label="Daily Water Goal (L)"
            value={waterGoal}
            onChangeText={setWaterGoal}
            placeholder="2.0"
            keyboardType="decimal-pad"
            icon="water-outline"
            containerStyle={styles.formInputContainer}
            style={[
              styles.formInput,
              {
                backgroundColor: profileTheme.goalTints.water.bg,
                borderColor: profileTheme.goalTints.water.border,
              },
            ]}
            inputStyle={styles.formInputText}
          />
          <Input
            label="Daily Sleep Goal (hours)"
            value={sleepGoal}
            onChangeText={setSleepGoal}
            placeholder="8"
            keyboardType="numeric"
            icon="moon-outline"
            containerStyle={styles.formInputContainer}
            style={[
              styles.formInput,
              {
                backgroundColor: profileTheme.goalTints.sleep.bg,
                borderColor: profileTheme.goalTints.sleep.border,
              },
            ]}
            inputStyle={styles.formInputText}
          />
        </Card>

        {/* Data & Account */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder },
          ]}
        >
          <Text style={styles.sectionTitle}>Data & Account</Text>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleExportData}
          >
            <Ionicons name="download-outline" size={20} color={themeColors.text} />
            <Text style={styles.actionText}>Export My Data</Text>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => Linking.openURL('https://pillarup.net/account-deletion.html')}
          >
            <Ionicons name="document-text-outline" size={20} color={themeColors.text} />
            <Text style={styles.actionText}>Account & Data Deletion Terms</Text>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionItem, styles.dangerItem]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={20} color={themeColors.danger} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={[styles.actionText, styles.dangerText]}>
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Text>
              {deleting && (
                <ActivityIndicator
                  size="small"
                  color={themeColors.danger}
                  style={{ marginLeft: spacing.sm }}
                />
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.danger} />
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const mutedText = themeColorsParam?.textSecondary || colors.textSecondary;
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
      ...typography.h3,
      color: baseText,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    saveButton: {
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    saveButtonInner: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
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
    avatarTap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    avatarRing: {
      width: 110,
      height: 110,
      borderRadius: 55,
      alignItems: 'center',
      justifyContent: 'center',
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
    cameraIcon: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: themeColorsParam?.primary || colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: themeColorsParam?.card || colors.card,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    profileName: {
      ...typography.h3,
      color: baseText,
    },
    profileHandle: {
      ...typography.bodySmall,
      color: mutedText,
    },
    profileEmail: {
      ...typography.bodySmall,
      color: mutedText,
      marginTop: 2,
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
    sectionCard: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.md,
      color: baseText,
    },
    formInputContainer: {
      marginBottom: spacing.md,
    },
    formInput: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderColor: themeColorsParam?.border || colors.border,
    },
    formInputText: {
      color: baseText,
    },
    changePasswordButton: {
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      marginTop: spacing.sm,
      alignSelf: 'stretch',
    },
    changePasswordInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    changePasswordText: {
      ...typography.bodySmall,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: themeColorsParam?.divider || colors.divider,
    },
    actionText: {
      flex: 1,
      ...typography.body,
      marginLeft: spacing.md,
      color: baseText,
    },
    dangerItem: {
      borderBottomWidth: 0,
    },
    dangerText: {
      color: themeColorsParam?.danger || colors.danger,
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
  });
};

export default EditProfileScreen;
