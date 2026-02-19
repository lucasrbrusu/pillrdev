import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Button } from '../components';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const legalLinks = [
  {
    id: 'terms',
    label: 'Terms of Service',
    url: 'https://pillaflow.net/terms-of-service.html',
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    url: 'https://pillaflow.net/privacy-policy.html',
  },
  {
    id: 'community',
    label: 'Community Guidelines',
    url: 'https://pillaflow.net/community-guidelines.html',
  },
  {
    id: 'subscription-terms',
    label: 'Subscription Terms',
    url: 'https://pillaflow.net/premium-subscription-terms.html',
  },
];

const PrivacySecurityScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { themeColors, t } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const handleOpenLink = (url) => {
    Linking.openURL(url);
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
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Privacy & Security')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('Legal')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('Review our policies and guidelines.')}
          </Text>
          {legalLinks.map((link, index) => (
            <Button
              key={link.id}
              title={link.label}
              icon="open-outline"
              variant="outline"
              onPress={() => handleOpenLink(link.url)}
              style={[
                styles.linkButton,
                index === legalLinks.length - 1 && styles.linkButtonLast,
              ]}
              fullWidth
            />
          ))}
        </Card>
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
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    linkButton: {
      marginBottom: spacing.sm,
    },
    linkButtonLast: {
      marginBottom: 0,
    },
  });

export default PrivacySecurityScreen;
