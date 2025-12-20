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
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { Card, Button, Input } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} from '../utils/theme';

const EditProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { profile, updateProfile, deleteAccount, themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);

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
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handleChangePhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color={colors.textLight} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </View>

        {/* Personal Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.changePasswordButton}
            onPress={handleChangePassword}
          >
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <Text style={styles.changePasswordText}>Change Password</Text>
          </TouchableOpacity>
        </Card>

        {/* Health Goals */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Health Goals</Text>
          <Input
            label="Daily Calorie Goal"
            value={calorieGoal}
            onChangeText={setCalorieGoal}
            placeholder="2000"
            keyboardType="numeric"
            rightIcon="nutrition-outline"
          />
          <Input
            label="Daily Water Goal (L)"
            value={waterGoal}
            onChangeText={setWaterGoal}
            placeholder="2.0"
            keyboardType="decimal-pad"
            rightIcon="water-outline"
          />
          <Input
            label="Daily Sleep Goal (hours)"
            value={sleepGoal}
            onChangeText={setSleepGoal}
            placeholder="8"
            keyboardType="numeric"
            rightIcon="moon-outline"
          />
        </Card>

        {/* Data & Account */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Data & Account</Text>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleExportData}
          >
            <Ionicons name="download-outline" size={20} color={colors.text} />
            <Text style={styles.actionText}>Export My Data</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionItem, styles.dangerItem]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={[styles.actionText, styles.dangerText]}>
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Text>
              {deleting && <ActivityIndicator size="small" color={colors.danger} style={{ marginLeft: spacing.sm }} />}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.danger} />
          </TouchableOpacity>
        </Card>
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
      ...typography.h3,
    },
    saveButton: {
      padding: spacing.xs,
    },
    saveText: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '600',
    },
    photoSection: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
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
    cameraIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    changePhotoText: {
      ...typography.bodySmall,
      color: colors.primary,
      marginTop: spacing.sm,
    },
    sectionCard: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.md,
    },
    changePasswordButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    changePasswordText: {
      ...typography.body,
      color: colors.primary,
      marginLeft: spacing.sm,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    actionText: {
      flex: 1,
      ...typography.body,
      marginLeft: spacing.md,
    },
    dangerItem: {
      borderBottomWidth: 0,
    },
    dangerText: {
      color: colors.danger,
    },
  });

export default EditProfileScreen;
