import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Button from '../components/Button';
import { useApp } from '../context/AppContext';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';

const pillars = [
  {
    id: 'habits',
    title: 'Micro Habits',
    description: 'Build lasting change through small, consistent actions.',
    icon: 'target',
    iconType: 'feather',
    color: colors.habits,
  },
  {
    id: 'planning',
    title: 'Daily Planning',
    description: 'Organize your schedule with clarity and intention.',
    icon: 'edit-3',
    iconType: 'feather',
    color: colors.tasks,
  },
  {
    id: 'health',
    title: 'Health Tracking',
    description: 'Monitor your wellness journey day by day.',
    icon: 'heart-outline',
    iconType: 'ionicons',
    color: colors.health,
  },
  {
    id: 'home',
    title: 'Home Routines',
    description: 'Maintain your space with effortless organization.',
    icon: 'history',
    iconType: 'material',
    color: colors.routine,
  },
  {
    id: 'finance',
    title: 'Finance',
    description: 'Track expenses, income, and stay on budget.',
    icon: 'trending-up',
    iconType: 'feather',
    color: colors.finance,
  },
];

const legalLinks = [
  {
    id: 'terms',
    label: 'Terms of Service',
    url: 'https://pillarup.net/terms-of-service.html',
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    url: 'https://pillarup.net/privacy-policy.html',
  },
  {
    id: 'community',
    label: 'Community Guidelines',
    url: 'https://pillarup.net/community-guidelines.html',
  },
];

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);

  const handleGetStarted = () => {
    navigation.navigate('Auth');
  };

  const handleOpenLink = (url) => {
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: `${colors.habits}15` }]}>
            <Feather name="target" size={18} color={colors.habits} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.tasks}15` }]}>
            <Feather name="edit-3" size={18} color={colors.tasks} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.health}15` }]}>
            <Ionicons name="heart-outline" size={18} color={colors.health} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.routine}15` }]}>
            <MaterialCommunityIcons name="history" size={18} color={colors.routine} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.finance}15` }]}>
            <Feather name="trending-up" size={18} color={colors.finance} />
          </View>
        </View>

        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <View style={[styles.logoDot, { backgroundColor: colors.habits }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.tasks }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.health }]} />
            <View style={[styles.logoDot, { backgroundColor: colors.routine }]} />
          </View>
          <Text style={styles.logoTitle}>PillarUp</Text>
        </View>
        <Text style={styles.subtitle}>Four pillars for a balanced life</Text>

        <View style={styles.pillarsContainer}>
          {pillars.map((pillar) => (
            <TouchableOpacity key={pillar.id} activeOpacity={0.9} style={styles.pillarCard}>
              <View style={[styles.iconContainer, { backgroundColor: `${pillar.color}15` }]}>
                {pillar.iconType === 'feather' && (
                  <Feather name={pillar.icon} size={24} color={pillar.color} />
                )}
                {pillar.iconType === 'material' && (
                  <MaterialCommunityIcons name={pillar.icon} size={24} color={pillar.color} />
                )}
                {!pillar.iconType || pillar.iconType === 'ionicons' ? (
                  <Ionicons name={pillar.icon} size={24} color={pillar.color} />
                ) : null}
              </View>
              <View style={styles.pillarText}>
                <Text style={styles.pillarTitle}>{pillar.title}</Text>
                <Text style={styles.pillarDescription}>{pillar.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={styles.legalLinksContainer}>
            {legalLinks.map((link) => (
              <TouchableOpacity
                key={link.id}
                activeOpacity={0.7}
                onPress={() => handleOpenLink(link.url)}
                style={styles.legalLink}
              >
                <Text style={styles.legalLinkText}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Get Started"
          icon="arrow-forward"
          onPress={handleGetStarted}
          size="large"
        />
      </View>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    alignItems: 'stretch',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
    ...shadows.small,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  logoTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 0,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoIcon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 28,
    height: 28,
    marginRight: spacing.sm,
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    margin: 1,
  },
  pillarsContainer: {},
  pillarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    ...shadows.small,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  pillarText: {
    flex: 1,
  },
  pillarTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  pillarDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  legalLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  legalLink: {
    marginHorizontal: spacing.xs,
    marginVertical: spacing.xs / 2,
  },
  legalLinkText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  ctaContainer: {
    paddingHorizontal: spacing.xl,
  },
});

export default OnboardingScreen;
