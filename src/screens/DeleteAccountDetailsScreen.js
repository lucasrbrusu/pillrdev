import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import {
  colors,
  borderRadius,
  spacing,
  typography,
  shadows,
} from '../utils/theme';

const DeleteAccountDetailsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { deleteAccount, themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedFinal, setAcceptedFinal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canContinue = acceptedTerms && acceptedFinal && !deleting;

  const handleOpenTerms = async () => {
    const termsUrl = 'https://pillaflow.net/account-deletion.html';
    try {
      await Linking.openURL(termsUrl);
    } catch (error) {
      Alert.alert('Unable to open link', 'Could not open Account & Data Deletion Terms.');
    }
  };

  const confirmDelete = async () => {
    if (!canContinue) return;

    Alert.alert(
      'Delete account permanently?',
      'This will permanently delete your account and data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.warningCard}>
          <View style={styles.warningTitleRow}>
            <View style={styles.warningIconWrap}>
              <Ionicons name="warning-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.warningTitle}>What this means</Text>
          </View>
          <Text style={styles.warningText}>
            Deleting your account permanently removes your profile and signs you out immediately.
          </Text>
          <Text style={styles.warningText}>
            Your app data is deleted through the account deletion process, including tasks, habits,
            routines, reminders, notes, groceries, health logs, finance data, and settings tied to
            your account.
          </Text>
          <Text style={styles.warningText}>
            Once completed, the process is final and cannot be reverted.
          </Text>

          <TouchableOpacity style={styles.termsRow} onPress={handleOpenTerms}>
            <Ionicons name="document-text-outline" size={18} color={themeColors.text} />
            <Text style={styles.termsText}>Read Account & Data Deletion Terms</Text>
            <Ionicons name="open-outline" size={16} color={themeColors.textLight} />
          </TouchableOpacity>
        </Card>

        <Card style={styles.checklistCard}>
          <Text style={styles.checklistTitle}>Confirm to continue</Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.85}
            onPress={() => setAcceptedTerms((prev) => !prev)}
          >
            <View style={[styles.checkboxBox, acceptedTerms && styles.checkboxBoxChecked]}>
              {acceptedTerms ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.checkboxLabel}>I accept the Account & Data Deletion Terms</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.85}
            onPress={() => setAcceptedFinal((prev) => !prev)}
          >
            <View style={[styles.checkboxBox, acceptedFinal && styles.checkboxBoxChecked]}>
              {acceptedFinal ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.checkboxLabel}>
              I understand if I continue the process is final and cannot be reverted
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={confirmDelete}
            disabled={!canContinue}
            activeOpacity={0.9}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Continue</Text>
            )}
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const mutedText = themeColorsParam?.textSecondary || colors.textSecondary;
  const danger = themeColorsParam?.danger || colors.danger;

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
    headerSpacer: {
      width: 40,
    },
    warningCard: {
      borderRadius: borderRadius.xl,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: `${danger}3A`,
      ...shadows.small,
    },
    warningTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    warningIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: danger,
      marginRight: spacing.sm,
    },
    warningTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    warningText: {
      ...typography.bodySmall,
      color: mutedText,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      borderRadius: borderRadius.lg,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    termsText: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '600',
      flex: 1,
      marginHorizontal: spacing.sm,
    },
    checklistCard: {
      borderRadius: borderRadius.xl,
      marginBottom: spacing.lg,
    },
    checklistTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    checkboxBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
      marginRight: spacing.sm,
    },
    checkboxBoxChecked: {
      backgroundColor: danger,
      borderColor: danger,
    },
    checkboxLabel: {
      ...typography.bodySmall,
      color: baseText,
      flex: 1,
      lineHeight: 20,
    },
    continueButton: {
      marginTop: spacing.sm,
      borderRadius: borderRadius.lg,
      backgroundColor: danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      ...shadows.small,
    },
    continueButtonDisabled: {
      opacity: 0.45,
    },
    continueText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
};

export default DeleteAccountDetailsScreen;
