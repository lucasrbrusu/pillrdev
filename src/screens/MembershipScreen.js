import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import { colors, spacing, borderRadius, typography } from '../utils/theme';

const parseExpiryDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const asMs = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(asMs);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return null;
      const asMs = numeric < 1e12 ? numeric * 1000 : numeric;
      const parsed = new Date(asMs);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatExpiryDate = (value) => {
  const parsed = parseExpiryDate(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const MembershipScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { profile, revenueCatPremium, isPremiumUser, themeColors, t } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const planLabel = isPremiumUser ? t('Premium') : t('Free plan');
  const premiumExpiryText = useMemo(() => {
    const revenueCatExpiry = revenueCatPremium?.isActive ? revenueCatPremium?.expiration : null;
    const profileExpiry = profile?.premiumExpiresAt || profile?.premium_expires_at || null;
    return formatExpiryDate(revenueCatExpiry || profileExpiry);
  }, [profile?.premiumExpiresAt, profile?.premium_expires_at, revenueCatPremium]);

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
          <Text style={styles.headerTitle}>{t('Your membership')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('Membership details')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('See your current plan and premium access details.')}
          </Text>

          <View
            style={[
              styles.statusPill,
              isPremiumUser ? styles.statusPillPremium : styles.statusPillFree,
            ]}
          >
            <Ionicons
              name={isPremiumUser ? 'star' : 'leaf-outline'}
              size={16}
              color={isPremiumUser ? '#B45309' : '#15803D'}
            />
            <Text
              style={[
                styles.statusPillText,
                { color: isPremiumUser ? '#B45309' : '#15803D' },
              ]}
            >
              {planLabel}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('Current plan')}</Text>
            <Text style={styles.detailValue}>{planLabel}</Text>
          </View>

          {isPremiumUser && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('Premium expires')}</Text>
                <Text style={styles.detailValue}>{premiumExpiryText || t('Not available')}</Text>
              </View>
            </>
          )}
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
      color: themeColors?.text || colors.text,
    },
    headerSpacer: {
      width: 32,
    },
    card: {
      marginTop: spacing.md,
    },
    sectionTitle: {
      ...typography.h3,
      color: themeColors?.text || colors.text,
      marginBottom: spacing.xs,
    },
    sectionSubtitle: {
      ...typography.bodySmall,
      color: themeColors?.textSecondary || colors.textSecondary,
      marginBottom: spacing.lg,
    },
    statusPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      marginBottom: spacing.lg,
    },
    statusPillPremium: {
      backgroundColor: '#FEF3C7',
      borderColor: '#FDE68A',
    },
    statusPillFree: {
      backgroundColor: '#DCFCE7',
      borderColor: '#BBF7D0',
    },
    statusPillText: {
      ...typography.bodySmall,
      fontWeight: '700',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    detailDivider: {
      height: 1,
      backgroundColor: themeColors?.divider || colors.border,
      marginVertical: spacing.md,
    },
    detailLabel: {
      ...typography.bodySmall,
      color: themeColors?.textSecondary || colors.textSecondary,
    },
    detailValue: {
      ...typography.body,
      color: themeColors?.text || colors.text,
      fontWeight: '600',
      textAlign: 'right',
      flexShrink: 1,
    },
  });

export default MembershipScreen;
