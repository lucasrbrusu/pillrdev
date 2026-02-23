import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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

const DataAccountScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);

  const handleExportData = () => {
    Alert.alert('Export Data', 'Your data export would be prepared here.');
  };

  const handleOpenTerms = async () => {
    const termsUrl = 'https://pillaflow.net/account-deletion.html';
    try {
      await Linking.openURL(termsUrl);
    } catch (error) {
      Alert.alert('Unable to open link', 'Could not open Account & Data Deletion Terms.');
    }
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
          <Text style={styles.headerTitle}>Data & Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Manage your data and account settings</Text>
          <Text style={styles.infoText}>
            Export your data, review account deletion terms, or start the account deletion flow.
          </Text>
        </Card>

        <Card style={styles.sectionCard}>
          <TouchableOpacity style={[styles.actionRow, styles.actionRowDivider]} onPress={handleExportData}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="download-outline" size={18} color={themeColors.text} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Export My Data</Text>
              <Text style={styles.actionSubtitle}>Request a copy of your account data.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRow, styles.actionRowDivider]} onPress={handleOpenTerms}>
            <View style={styles.actionIconWrap}>
              <Ionicons name="document-text-outline" size={18} color={themeColors.text} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Account & Data Deletion Terms</Text>
              <Text style={styles.actionSubtitle}>Read full deletion terms and policy details.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('DeleteAccountDetails')}
          >
            <View style={[styles.actionIconWrap, styles.dangerIconWrap]}>
              <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={[styles.actionTitle, styles.dangerTitle]}>Delete Account</Text>
              <Text style={styles.actionSubtitle}>Start the permanent account deletion process.</Text>
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
    headerSpacer: {
      width: 40,
    },
    infoCard: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      ...shadows.small,
    },
    infoTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    infoText: {
      ...typography.bodySmall,
      color: mutedText,
      lineHeight: 20,
    },
    sectionCard: {
      borderRadius: borderRadius.xl,
      padding: 0,
      overflow: 'hidden',
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    actionRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: themeColorsParam?.divider || colors.divider,
    },
    actionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    dangerIconWrap: {
      borderColor: `${themeColorsParam?.danger || colors.danger}44`,
      backgroundColor: `${themeColorsParam?.danger || colors.danger}12`,
    },
    actionTextWrap: {
      flex: 1,
      marginLeft: spacing.md,
      marginRight: spacing.sm,
    },
    actionTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '600',
    },
    actionSubtitle: {
      ...typography.caption,
      color: mutedText,
      marginTop: 2,
    },
    dangerTitle: {
      color: themeColorsParam?.danger || colors.danger,
    },
  });
};

export default DataAccountScreen;
