import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';

const themeOptions = [
  { id: 'default', label: 'Default (Light)' },
  { id: 'dark', label: 'Dark' },
];

const AppearanceScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeName, changeTheme, themeColors } = useApp();

  const handleSelect = async (id) => {
    await changeTheme(id);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appearance</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <Text style={styles.sectionSubtitle}>Change how Pillr looks across the app.</Text>

        {themeOptions.map((option) => {
          const selected = themeName === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                {
                  backgroundColor: themeColors.card,
                  borderColor: selected ? colors.primary : themeColors.border,
                },
                selected && styles.optionCardSelected,
              ]}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.9}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.swatch, option.id === 'dark' ? styles.swatchDark : styles.swatchLight]} />
                <View>
                  <Text style={[styles.optionLabel, { color: themeColors.text }]}>{option.label}</Text>
                  <Text style={[styles.optionHint, { color: themeColors.textSecondary }]}>
                    {option.id === 'dark'
                      ? 'Deep black background with navy cards and bright text.'
                      : 'Clean white background with the current accent colors.'}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.radio,
                  { borderColor: selected ? colors.primary : themeColors.border },
                  selected && styles.radioSelected,
                ]}
              >
                {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
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
    backgroundColor: colors.card,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  optionCardSelected: {
    borderColor: colors.primary,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  swatch: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  swatchLight: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchDark: {
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  optionLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  optionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});

export default AppearanceScreen;
