import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../context/AppContext';
import { Card, Button, Input } from '../components';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const TwoFactorAuthScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    t,
    mfaFactors,
    mfaCurrentLevel,
    mfaNextLevel,
    isMfaLoading,
    refreshMfaState,
    enrollTotpMfa,
    verifyTotpMfaEnrollment,
    cancelMfaEnrollment,
    disableMfa,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [setupFactor, setSetupFactor] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [isStartingSetup, setIsStartingSetup] = useState(false);
  const [isVerifyingSetup, setIsVerifyingSetup] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const verifiedFactors = mfaFactors?.verified || [];
  const unverifiedTotpFactor = (mfaFactors?.unverified || []).find(
    (factor) => factor?.factor_type === 'totp'
  );
  const hasVerifiedFactor = verifiedFactors.length > 0;
  const activeSetupFactorId = setupFactor?.id || unverifiedTotpFactor?.id || null;
  const setupQrUri = setupFactor?.totp?.uri || '';
  const setupSecret = setupFactor?.totp?.secret || '';

  const handleRefreshStatus = async () => {
    setError('');
    setStatusMessage('');
    try {
      await refreshMfaState({ showLoading: true, throwOnError: true });
    } catch (refreshError) {
      setError(refreshError?.message || 'Unable to refresh 2FA status.');
    }
  };

  const handleStartSetup = async () => {
    setIsStartingSetup(true);
    setError('');
    setStatusMessage('');
    try {
      const enrollment = await enrollTotpMfa();
      setSetupFactor(enrollment || null);
      setSetupCode('');
    } catch (setupError) {
      setError(setupError?.message || 'Unable to start 2FA setup.');
    } finally {
      setIsStartingSetup(false);
    }
  };

  const handleVerifySetup = async () => {
    const normalizedCode = String(setupCode || '').trim();
    if (!activeSetupFactorId) {
      setError('Missing 2FA setup session. Please restart setup.');
      return;
    }
    if (!normalizedCode) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsVerifyingSetup(true);
    setError('');
    setStatusMessage('');
    try {
      await verifyTotpMfaEnrollment({
        factorId: activeSetupFactorId,
        code: normalizedCode,
      });
      setSetupFactor(null);
      setSetupCode('');
      setStatusMessage('Two-factor authentication is now enabled.');
    } catch (verifyError) {
      setError(verifyError?.message || 'Unable to verify the 2FA code.');
    } finally {
      setIsVerifyingSetup(false);
    }
  };

  const handleCancelSetup = async () => {
    if (!activeSetupFactorId) return;
    setError('');
    setStatusMessage('');
    try {
      await cancelMfaEnrollment({ factorId: activeSetupFactorId });
      setSetupFactor(null);
      setSetupCode('');
    } catch (cancelError) {
      setError(cancelError?.message || 'Unable to cancel 2FA setup.');
    }
  };

  const runDisableMfa = async () => {
    setIsDisabling(true);
    setError('');
    setStatusMessage('');
    try {
      await disableMfa();
      setSetupFactor(null);
      setSetupCode('');
      setStatusMessage('Two-factor authentication has been disabled.');
    } catch (disableError) {
      setError(disableError?.message || 'Unable to disable 2FA.');
    } finally {
      setIsDisabling(false);
    }
  };

  const handleDisableMfa = () => {
    Alert.alert(
      'Disable Two-Factor Authentication',
      'This will remove your current 2FA protection. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable', style: 'destructive', onPress: runDisableMfa },
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={24} color={themeColors?.text || colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Two-Factor Authentication')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('2FA Status')}</Text>
          <Text style={styles.sectionSubtitle}>
            {isMfaLoading
              ? t('Checking your current authentication level...')
              : hasVerifiedFactor
                ? t('Two-factor authentication is enabled on this account.')
                : t('Two-factor authentication is currently disabled.')}
          </Text>
          <Text style={styles.detailText}>{`Current level: ${mfaCurrentLevel || 'unknown'}`}</Text>
          <Text style={styles.detailText}>{`Next level: ${mfaNextLevel || 'unknown'}`}</Text>
          <Button
            title={t('Refresh')}
            icon="refresh-outline"
            variant="outline"
            onPress={handleRefreshStatus}
            style={styles.actionButton}
            fullWidth
          />
        </Card>

        {!hasVerifiedFactor && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Set up 2FA')}</Text>
            <Text style={styles.sectionSubtitle}>
              {activeSetupFactorId
                ? t('Scan the QR code with your authenticator app, then enter the 6-digit code.')
                : t('Add an authenticator app to protect your account during sign in.')}
            </Text>

            {setupQrUri ? (
              <View style={styles.qrContainer}>
                <QRCode value={setupQrUri} size={180} />
              </View>
            ) : null}

            {setupSecret ? (
              <View style={styles.secretContainer}>
                <Text style={styles.secretLabel}>{t('Manual key')}</Text>
                <Text selectable style={styles.secretValue}>
                  {setupSecret}
                </Text>
              </View>
            ) : null}

            {activeSetupFactorId ? (
              <>
                <Input
                  label={t('Authenticator code')}
                  value={setupCode}
                  onChangeText={setSetupCode}
                  placeholder={t('123456')}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  containerStyle={styles.inputContainer}
                />
                <Button
                  title={t('Verify and Enable 2FA')}
                  icon="checkmark-circle-outline"
                  onPress={handleVerifySetup}
                  loading={isVerifyingSetup}
                  fullWidth
                />
                <Button
                  title={t('Cancel Setup')}
                  icon="close-circle-outline"
                  variant="ghost"
                  onPress={handleCancelSetup}
                  style={styles.secondaryAction}
                  fullWidth
                />
              </>
            ) : (
              <Button
                title={t('Set up 2FA')}
                icon="shield-checkmark-outline"
                onPress={handleStartSetup}
                loading={isStartingSetup}
                fullWidth
              />
            )}
          </Card>
        )}

        {hasVerifiedFactor && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Enabled Factors')}</Text>
            {verifiedFactors.map((factor) => (
              <View key={factor.id} style={styles.factorRow}>
                <Text style={styles.factorName}>
                  {factor.friendly_name || 'Authenticator App'}
                </Text>
                <Text style={styles.factorType}>{String(factor.factor_type || '').toUpperCase()}</Text>
              </View>
            ))}
            <Text style={styles.warningText}>
              {t('Disabling 2FA removes the code challenge from future sign-ins.')}
            </Text>
            <Button
              title={t('Disable 2FA')}
              icon="trash-outline"
              variant="danger"
              onPress={handleDisableMfa}
              loading={isDisabling}
              fullWidth
            />
          </Card>
        )}

        {statusMessage ? <Text style={styles.successText}>{statusMessage}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors?.background || colors.background,
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
      padding: spacing.xs,
    },
    headerTitle: {
      ...typography.h3,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 32,
    },
    card: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: {
      ...typography.bodySmall,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginBottom: spacing.md,
    },
    detailText: {
      ...typography.bodySmall,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginBottom: spacing.xs,
    },
    actionButton: {
      marginTop: spacing.sm,
    },
    qrContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      backgroundColor: '#FFFFFF',
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
    },
    secretContainer: {
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
    },
    secretLabel: {
      ...typography.caption,
      marginBottom: spacing.xs,
      color: themeColors?.textSecondary || colors.textSecondary,
    },
    secretValue: {
      ...typography.bodySmall,
      color: themeColors?.text || colors.text,
      fontFamily: 'monospace',
    },
    inputContainer: {
      marginBottom: spacing.sm,
    },
    secondaryAction: {
      marginTop: spacing.sm,
    },
    factorRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
    },
    factorName: {
      ...typography.bodySmall,
      color: themeColors?.text || colors.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    factorType: {
      ...typography.caption,
      color: themeColors?.textSecondary || colors.textSecondary,
      fontWeight: '600',
    },
    warningText: {
      ...typography.caption,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginVertical: spacing.sm,
    },
    successText: {
      ...typography.bodySmall,
      color: themeColors?.success || colors.success,
      marginTop: spacing.lg,
    },
    errorText: {
      ...typography.bodySmall,
      color: themeColors?.danger || colors.danger,
      marginTop: spacing.sm,
    },
  });

export default TwoFactorAuthScreen;
