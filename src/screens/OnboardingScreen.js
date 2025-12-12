import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { useApp } from '../context/AppContext';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';

const pillars = [
  {
    id: 'habits',
    title: 'Micro Habits',
    description: 'Build lasting change through small, consistent actions.',
    icon: 'radio-button-on-outline',
    color: colors.habits,
  },
  {
    id: 'planning',
    title: 'Daily Planning',
    description: 'Organize your schedule with clarity and intention.',
    icon: 'calendar-outline',
    color: colors.tasks,
  },
  {
    id: 'health',
    title: 'Health Tracking',
    description: 'Monitor your wellness journey day by day.',
    icon: 'heart-outline',
    color: colors.health,
  },
  {
    id: 'home',
    title: 'Home Routines',
    description: 'Maintain your space with effortless organization.',
    icon: 'home-outline',
    color: colors.finance,
  },
];

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);

  const handleGetStarted = () => {
    navigation.navigate('Auth');
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
            <Ionicons name="radio-button-on" size={18} color={colors.habits} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.tasks}15` }]}>
            <Ionicons name="calendar-clear-outline" size={18} color={colors.tasks} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.health}15` }]}>
            <Ionicons name="heart" size={18} color={colors.health} />
          </View>
          <View style={[styles.badge, { backgroundColor: `${colors.finance}15` }]}>
            <Ionicons name="home" size={18} color={colors.finance} />
          </View>
        </View>

        <Text style={styles.title}>Pillr</Text>
        <Text style={styles.subtitle}>Four pillars for a balanced life</Text>

        <View style={styles.pillarsContainer}>
          {pillars.map((pillar) => (
            <TouchableOpacity key={pillar.id} activeOpacity={0.9} style={styles.pillarCard}>
              <View style={[styles.iconContainer, { backgroundColor: `${pillar.color}15` }]}>
                <Ionicons name={pillar.icon} size={24} color={pillar.color} />
              </View>
              <View style={styles.pillarText}>
                <Text style={styles.pillarTitle}>{pillar.title}</Text>
                <Text style={styles.pillarDescription}>{pillar.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
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
  ctaContainer: {
    paddingHorizontal: spacing.xl,
  },
});

export default OnboardingScreen;
