import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { colors, borderRadius, spacing, typography, shadows, defaultCurrencies } from '../utils/theme';

const CurrencyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors, userSettings, updateUserSettings } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [selectedCode, setSelectedCode] = useState(
    userSettings?.defaultCurrencyCode || 'USD'
  );

  useEffect(() => {
    if (userSettings?.defaultCurrencyCode) {
      setSelectedCode(userSettings.defaultCurrencyCode);
    }
  }, [userSettings?.defaultCurrencyCode]);

  const handleSelect = async (code) => {
    setSelectedCode(code);
    try {
      await updateUserSettings({ defaultCurrencyCode: code });
    } catch (error) {
      Alert.alert(
        'Unable to update currency',
        error?.message || 'Please try again.'
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Currency</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Default currency</Text>
        <Text style={styles.sectionSubtitle}>
          This currency will be used for balances, budgets, and new transactions.
        </Text>

        {defaultCurrencies.map((currency) => {
          const selected = selectedCode === currency.code;
          return (
            <TouchableOpacity
              key={currency.code}
              style={[
                styles.optionCard,
                {
                  backgroundColor: themeColors.card,
                  borderColor: selected ? themeColors.primary : themeColors.border,
                },
                selected && styles.optionCardSelected,
              ]}
              onPress={() => handleSelect(currency.code)}
              activeOpacity={0.9}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.symbolBubble,
                    selected && styles.symbolBubbleSelected,
                  ]}
                >
                  <Text style={styles.symbolText}>{currency.symbol}</Text>
                </View>
                <View>
                  <Text style={[styles.optionLabel, { color: themeColors.text }]}>
                    {currency.code}
                  </Text>
                  <Text style={[styles.optionHint, { color: themeColors.textSecondary }]}>
                    {currency.name}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={selected ? themeColors.primary : themeColors.textLight}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColorsParam.background || colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam.border || colors.border,
    },
    headerTitle: {
      ...typography.h2,
      color: themeColorsParam.text || colors.text,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.xs,
      color: themeColorsParam.text || colors.text,
    },
    sectionSubtitle: {
      ...typography.bodySmall,
      color: themeColorsParam.textSecondary || colors.textSecondary,
      marginBottom: spacing.lg,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      ...shadows.small,
    },
    optionCardSelected: {
      borderColor: themeColorsParam.primary || colors.primary,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    symbolBubble: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
      backgroundColor: themeColorsParam.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam.border || colors.border,
    },
    symbolBubbleSelected: {
      borderColor: themeColorsParam.primary || colors.primary,
    },
    symbolText: {
      ...typography.body,
      color: themeColorsParam.text || colors.text,
      fontWeight: '700',
    },
    optionLabel: {
      ...typography.body,
      fontWeight: '600',
    },
    optionHint: {
      ...typography.caption,
      marginTop: spacing.xs,
    },
  });

export default CurrencyScreen;
