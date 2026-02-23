import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';
import { Card, Input, Button } from '../components';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const getPasswordError = (password) => {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters and include at least one uppercase letter and one symbol.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }

  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return 'Password must include at least one symbol.';
  }

  return '';
};

const ChangePasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors, profile, authUser } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = (authUser?.email || profile?.email || '').trim().toLowerCase();

  const handleUpdatePassword = async () => {
    if (isSubmitting) return;
    setError('');

    if (!currentPassword || !newPassword) {
      setError('Please enter your current password and a new password.');
      return;
    }

    if (!email) {
      setError('Unable to determine your account email.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      setIsSubmitting(true);
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauthError) {
        setError('Current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      Alert.alert('Password updated', 'Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
      navigation.goBack();
    } catch (err) {
      setError(err?.message || 'Unable to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={24} color={themeColors?.text || colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Update your password</Text>
          <Text style={styles.sectionSubtitle}>
            Enter your current password and choose a new one with 6+ characters, 1 uppercase letter, and 1 symbol.
          </Text>
          <Input
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            secureTextEntry
            autoCapitalize="none"
          />
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            secureTextEntry
            autoCapitalize="none"
            containerStyle={styles.lastInput}
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            title="Save new password"
            onPress={handleUpdatePassword}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColorsParam?.background || colors.background,
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
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    headerTitle: {
      ...typography.h3,
      color: themeColorsParam?.text || colors.text,
    },
    headerSpacer: {
      width: 40,
    },
    card: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      ...typography.h3,
      color: themeColorsParam?.text || colors.text,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: {
      ...typography.bodySmall,
      color: themeColorsParam?.textSecondary || colors.textSecondary,
      marginBottom: spacing.lg,
    },
    lastInput: {
      marginBottom: spacing.md,
    },
    errorText: {
      ...typography.bodySmall,
      color: themeColorsParam?.danger || colors.danger,
      marginBottom: spacing.md,
    },
  });

export default ChangePasswordScreen;
