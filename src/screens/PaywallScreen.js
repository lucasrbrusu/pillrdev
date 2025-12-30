import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';

import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';
import { Button, Card } from '../components';
import { useApp } from '../context/AppContext';
import {
  configureRevenueCat,
  loadOfferingPackages,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  getPremiumEntitlementStatus,
} from '../../RevenueCat';

const featureList = [
  {
    title: 'Pillr AI agent',
    subtitle: 'Chat with your personal planner to create tasks, habits, and reminders instantly.',
  },
  {
    title: 'Groups & collaboration',
    subtitle: 'Create groups, invite friends, and run shared habits and routines together.',
  },
  {
    title: 'Finance insights & budgets',
    subtitle: 'Unlock spending breakdowns, recurring payment tracking, and budget groups.',
  },
  {
    title: 'Weekly & monthly reports',
    subtitle: 'Dive into insights across focus, health, tasks, and more in one place.',
  },
  {
    title: 'Streak protection',
    subtitle: "Premium users get extra cushion so missing a day won't instantly break your streaks.",
  },
  {
    title: 'Premium badge',
    subtitle: 'Show off your premium status across Pillr.',
  },
];

const PaywallScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { themeColors, isPremium, refreshRevenueCatPremium } = useApp();
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [monthlyPackage, setMonthlyPackage] = useState(null);
  const [annualPackage, setAnnualPackage] = useState(null);
  const [purchasingId, setPurchasingId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [entitled, setEntitled] = useState(!!isPremium);
  const [entitlementLabel, setEntitlementLabel] = useState('');

  const palette = themeColors || colors;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const source = route.params?.source || '';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadingError('');
      try {
        await configureRevenueCat();
        const { monthly, annual } = await loadOfferingPackages();
        if (!mounted) return;
        setMonthlyPackage(monthly || null);
        setAnnualPackage(annual || null);
      } catch (err) {
        if (!mounted) return;
        setLoadingError(err?.message || 'Unable to load plans right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const syncEntitlement = async () => {
      try {
        const { isActive, entitlement } =
          (await refreshRevenueCatPremium()) || (await getPremiumEntitlementStatus());
        if (!active) return;
        setEntitled(!!isActive || !!isPremium);
        setEntitlementLabel(entitlement?.productIdentifier || '');
      } catch {
        // ignore; keep existing state
      }
    };
    syncEntitlement();
    return () => {
      active = false;
    };
  }, [isPremium, refreshRevenueCatPremium]);

  const formatPrice = (pkg, cadence) => {
    const suffix = cadence === 'yearly' ? '/year' : '/month';
    const product = pkg?.product;
    if (!product) {
      return 'Price updates after RevenueCat is connected';
    }
    if (product.priceString) {
      return `${product.priceString}${suffix}`;
    }
    if (product.price && product.currencyCode) {
      const formatted = Number(product.price).toFixed(2);
      return `${product.currencyCode} ${formatted}${suffix}`;
    }
    return 'Price updates after RevenueCat is connected';
  };

  const handlePurchase = async (pkg) => {
    if (!pkg) {
      setLoadingError('This plan is not available yet. Check your RevenueCat offering.');
      return;
    }
    if (entitled) return;
    setPurchasingId(pkg.identifier);
    setLoadingError('');
    try {
      await purchaseRevenueCatPackage(pkg);
      const status =
        (await refreshRevenueCatPremium()) || (await getPremiumEntitlementStatus());
      setEntitled(!!status?.isActive || !!isPremium);
      navigation.goBack();
    } catch (err) {
      if (!err?.userCancelled) {
        setLoadingError(err?.message || 'Purchase did not complete.');
      }
    } finally {
      setPurchasingId('');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setLoadingError('');
    try {
      await restoreRevenueCatPurchases();
      const status =
        (await refreshRevenueCatPremium()) || (await getPremiumEntitlementStatus());
      setEntitled(!!status?.isActive || !!isPremium);
      navigation.goBack();
    } catch (err) {
      setLoadingError(err?.message || 'Could not restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0b0f1a', '#121b2f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#f8f3d7" />
          </TouchableOpacity>
          <Text style={styles.tagline}>Upgrade your Pillr experience</Text>
          <View style={{ width: 32 }} />
        </View>

        <Text style={styles.title}>Pillr Premium</Text>
        <Text style={styles.subtitle}>
          Unlock the AI agent, richer insights, and all the premium tools built to keep you on track.
        </Text>
        {source ? <Text style={styles.sourceNote}>Opened from: {source}</Text> : null}
        {entitled && (
          <View style={styles.entitlementPill}>
            <Ionicons name="checkmark-circle" size={18} color="#0fcb81" />
            <Text style={styles.entitlementText}>
              Active: {entitlementLabel || 'Pillr Premium'}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What you get</Text>
        </View>
        <Card style={styles.featureCard}>
          {featureList.map((item, idx) => (
            <View key={item.title} style={[styles.featureRow, idx < featureList.length - 1 && styles.featureBorder]}>
              <View style={styles.featureIcon}>
                <Feather name="check" size={16} color="#0f6d4f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          ))}
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose your plan</Text>
          <Text style={styles.sectionHint}>Prices come directly from your RevenueCat offering.</Text>
        </View>

        {loading ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color={palette.primary} />
            <Text style={styles.loadingText}>Fetching plans...</Text>
          </Card>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => handlePurchase(monthlyPackage)}
            >
              <LinearGradient
                colors={['#f7e7b4', '#f1c644']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.planCard}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planLabel}>Monthly</Text>
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>Flexible</Text>
                  </View>
                </View>
                <Text style={styles.planPrice}>{formatPrice(monthlyPackage, 'monthly')}</Text>
                <Text style={styles.planDetail}>Cancel anytime.</Text>
                <Button
                  title={purchasingId === monthlyPackage?.identifier ? 'Processing...' : 'Choose Monthly'}
                  onPress={() => handlePurchase(monthlyPackage)}
                  fullWidth
                  style={styles.planButton}
                  disabled={!!purchasingId || entitled}
                  icon="star"
                  disableTranslation
                />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => handlePurchase(annualPackage)}
            >
              <Card style={styles.planOutlineCard}>
                <View style={styles.planHeader}>
                  <Text style={styles.planLabel}>Yearly</Text>
                  <View style={[styles.planBadge, styles.bestValueBadge]}>
                    <Text style={[styles.planBadgeText, styles.bestValueBadgeText]}>Best value</Text>
                  </View>
                </View>
                <Text style={styles.planPrice}>{formatPrice(annualPackage, 'yearly')}</Text>
                <Text style={styles.planDetail}>Save more with the annual plan.</Text>
                <Button
                  title={purchasingId === annualPackage?.identifier ? 'Processing...' : 'Choose Yearly'}
                  onPress={() => handlePurchase(annualPackage)}
                  fullWidth
                  variant="secondary"
                  style={styles.planButton}
                  disabled={!!purchasingId || entitled}
                  icon="calendar"
                  disableTranslation
                />
              </Card>
            </TouchableOpacity>
          </>
        )}

        {!!loadingError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadingError}</Text>
          </View>
        )}

        <View style={styles.footerActions}>
          <Button
            title={restoring ? 'Restoring...' : 'Restore purchases'}
            onPress={handleRestore}
            fullWidth
            variant="ghost"
            disabled={restoring || purchasingId}
            disableTranslation
          />
          {entitled ? (
            <Text style={styles.smallNote}>You already have Premium on this account.</Text>
          ) : (
            <Text style={styles.smallNote}>
              Purchases are managed securely via RevenueCat. Once connected, your live prices and trials appear here.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    hero: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      borderBottomLeftRadius: borderRadius.xl,
      borderBottomRightRadius: borderRadius.xl,
      ...shadows.medium,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: '#f1c644',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    tagline: {
      ...typography.bodySmall,
      color: '#f8f3d7',
      textAlign: 'center',
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: '#f5d76e',
      marginTop: spacing.md,
      letterSpacing: 0.5,
    },
    subtitle: {
      ...typography.body,
      color: '#d5e0ff',
      marginTop: spacing.sm,
      lineHeight: 22,
    },
    sourceNote: {
      ...typography.caption,
      color: '#9ab0ff',
      marginTop: spacing.xs,
    },
    entitlementPill: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: 'rgba(15, 203, 129, 0.12)',
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: 'rgba(15, 203, 129, 0.35)',
    },
    entitlementText: {
      ...typography.caption,
      color: '#c7f3df',
      fontWeight: '700',
    },
    scroll: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    sectionHeader: {
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    sectionTitle: {
      ...typography.h3,
      color: palette.text,
      fontWeight: '700',
    },
    sectionHint: {
      ...typography.caption,
      color: palette.textSecondary,
      marginTop: 2,
    },
    featureCard: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    featureBorder: {
      borderBottomWidth: 1,
      borderBottomColor: palette.divider || '#ececec',
    },
    featureIcon: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      backgroundColor: '#dcf5eb',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    featureTitle: {
      ...typography.body,
      fontWeight: '700',
      color: palette.text,
    },
    featureSubtitle: {
      ...typography.bodySmall,
      color: palette.textSecondary,
      marginTop: 2,
    },
    planCard: {
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginTop: spacing.md,
      ...shadows.medium,
    },
    planOutlineCard: {
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginTop: spacing.md,
      borderWidth: 1.5,
      borderColor: '#f1c644',
    },
    planHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planLabel: {
      ...typography.h3,
      color: '#1f1304',
      fontWeight: '800',
    },
    planBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    planBadgeText: {
      ...typography.caption,
      color: '#1f1304',
      fontWeight: '700',
    },
    bestValueBadge: {
      backgroundColor: '#1f2937',
    },
    bestValueBadgeText: {
      color: '#f7e7b4',
    },
    planPrice: {
      ...typography.h1,
      color: '#1f1304',
      fontWeight: '800',
      marginTop: spacing.sm,
    },
    planDetail: {
      ...typography.bodySmall,
      color: '#2f2412',
      marginTop: spacing.xs,
    },
    planButton: {
      marginTop: spacing.md,
    },
    loadingCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      marginTop: spacing.md,
    },
    loadingText: {
      ...typography.bodySmall,
      color: palette.textSecondary,
      marginTop: spacing.sm,
    },
    errorBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: '#fef2f2',
      borderWidth: 1,
      borderColor: '#fecdd3',
    },
    errorText: {
      ...typography.bodySmall,
      color: '#991b1b',
    },
    footerActions: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    smallNote: {
      ...typography.caption,
      color: palette.textSecondary,
      textAlign: 'center',
    },
  });

export default PaywallScreen;
