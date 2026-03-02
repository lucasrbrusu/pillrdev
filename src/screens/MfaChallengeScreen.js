import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, Button, Input } from '../components';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const MfaChallengeScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    themeColors,
    t,
    mfaFactors,
    isMfaLoading,
    verifyMfaChallenge,
    signOut,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  const preferredFactor =
    mfaFactors?.verifiedTotp?.[0] || mfaFactors?.verified?.[0] || null;

  const handleVerify = async () => {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) {
      setError('Please enter your 2FA code.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await verifyMfaChallenge({
        code: normalizedCode,
        factorId: preferredFactor?.id,
      });
      setCode('');
    } catch (verifyError) {
      setError(verifyError?.message || 'Invalid code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="shield-checkmark-outline"
            size={30}
            color={themeColors?.primary || colors.primary}
          />
        </View>
        <Text style={styles.title}>{t('Two-Factor Authentication')}</Text>
        <Text style={styles.subtitle}>
          {t('Enter the 6-digit code from your authenticator app to continue.')}
        </Text>

        <Card style={styles.card}>
          <Input
            label={t('Authentication code')}
            value={code}
            onChangeText={setCode}
            placeholder={t('123456')}
            keyboardType="number-pad"
            autoCapitalize="none"
            containerStyle={styles.inputContainer}
          />
          {preferredFactor?.friendly_name ? (
            <Text style={styles.factorLabel}>{preferredFactor.friendly_name}</Text>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button
            title={isMfaLoading ? t('Checking status...') : t('Verify Code')}
            icon="checkmark-circle-outline"
            onPress={handleVerify}
            loading={isSubmitting}
            disabled={isMfaLoading}
            fullWidth
          />
          <TouchableOpacity
            style={styles.signOutLink}
            onPress={handleSignOut}
            disabled={isSigningOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutText}>
              {isSigningOut ? t('Signing out...') : t('Sign out')}
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors?.background || colors.background,
      paddingHorizontal: spacing.xl,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: spacing.xxl,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${themeColors?.primary || colors.primary}1A`,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.h2,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.bodySmall,
      textAlign: 'center',
      color: themeColors?.textSecondary || colors.textSecondary,
      marginBottom: spacing.xl,
    },
    card: {
      marginTop: spacing.sm,
    },
    inputContainer: {
      marginBottom: spacing.sm,
    },
    factorLabel: {
      ...typography.caption,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginBottom: spacing.sm,
    },
    errorText: {
      ...typography.bodySmall,
      color: themeColors?.danger || colors.danger,
      marginBottom: spacing.sm,
    },
    signOutLink: {
      marginTop: spacing.md,
      alignSelf: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    signOutText: {
      ...typography.bodySmall,
      color: themeColors?.textSecondary || colors.textSecondary,
      textDecorationLine: 'underline',
    },
  });

export default MfaChallengeScreen;
