import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button } from '../components';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pt', label: 'Português' },
];

const GeneralSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors, userSettings, updateUserSettings } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [selectedLanguage, setSelectedLanguage] = useState(
    userSettings?.language || 'en'
  );

  const handleSave = async () => {
    await updateUserSettings({ language: selectedLanguage });
    navigation.goBack();
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
          <Text style={styles.headerTitle}>General Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Language</Text>
          {LANGUAGE_OPTIONS.map((option, idx) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.languageRow,
                idx < LANGUAGE_OPTIONS.length - 1 && styles.languageRowBorder,
              ]}
              onPress={() => setSelectedLanguage(option.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.languageLabel}>{option.label}</Text>
              <Ionicons
                name={
                  selectedLanguage === option.id
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={20}
                color={selectedLanguage === option.id ? colors.primary : colors.textLight}
              />
            </TouchableOpacity>
          ))}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Save"
          onPress={handleSave}
          style={styles.saveButton}
        />
      </View>
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
    },
    headerSpacer: {
      width: 32,
    },
    card: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      ...typography.h3,
      marginBottom: spacing.md,
    },
    languageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    languageRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    languageLabel: {
      ...typography.body,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      paddingTop: spacing.sm,
      backgroundColor: themeColors?.background || colors.background,
    },
    saveButton: {
      width: '100%',
    },
  });

export default GeneralSettingsScreen;
