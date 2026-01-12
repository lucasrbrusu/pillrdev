import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';
import { Card, Input, Button } from '../components';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const ForgotPasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendReset = async () => {
    if (isSubmitting) return;
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your account email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail
      );

      if (resetError) {
        throw resetError;
      }

      Alert.alert(
        'Recovery email sent',
        'Check your inbox for a password reset link.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setError(err?.message || 'Unable to send recovery email.');
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
          <Text style={styles.headerTitle}>Forgot Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Reset your password</Text>
          <Text style={styles.sectionSubtitle}>
            Enter the email associated with your account to receive a reset link.
          </Text>
          <Input
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={styles.lastInput}
          />
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <Button
            title="Send recovery email"
            onPress={handleSendReset}
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

export default ForgotPasswordScreen;
