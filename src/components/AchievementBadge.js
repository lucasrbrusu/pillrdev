import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, typography } from '../utils/theme';

const BADGE_ASSET_BY_ID = {
  // Longest current streak
  'longest_current_streak:2': require('../../assets/badges/longest current streak/current2.png'),
  'longest_current_streak:5': require('../../assets/badges/longest current streak/current5.png'),
  'longest_current_streak:7': require('../../assets/badges/longest current streak/current7.png'),
  'longest_current_streak:14': require('../../assets/badges/longest current streak/current14.png'),
  'longest_current_streak:30': require('../../assets/badges/longest current streak/current30.png'),
  'longest_current_streak:60': require('../../assets/badges/longest current streak/current60.png'),
  'longest_current_streak:90': require('../../assets/badges/longest current streak/current90.png'),
  'longest_current_streak:100': require('../../assets/badges/longest current streak/current100.png'),
  'longest_current_streak:180': require('../../assets/badges/longest current streak/current180.png'),
  'longest_current_streak:275': require('../../assets/badges/longest current streak/current275.png'),
  'longest_current_streak:365': require('../../assets/badges/longest current streak/current365.png'),

  // Longest habit streak
  'longest_habit_streak:2': require('../../assets/badges/longest habit streak/habitstreak2.png'),
  'longest_habit_streak:5': require('../../assets/badges/longest habit streak/habitstreak5.png'),
  'longest_habit_streak:7': require('../../assets/badges/longest habit streak/habitstreak7.png'),
  'longest_habit_streak:14': require('../../assets/badges/longest habit streak/habitstreak14.png'),
  'longest_habit_streak:30': require('../../assets/badges/longest habit streak/habitstreak30.png'),
  'longest_habit_streak:60': require('../../assets/badges/longest habit streak/habitstreak60.png'),
  'longest_habit_streak:90': require('../../assets/badges/longest habit streak/habitstreak90.png'),
  'longest_habit_streak:100': require('../../assets/badges/longest habit streak/habitstreak100.png'),
  'longest_habit_streak:180': require('../../assets/badges/longest habit streak/habitstreak180.png'),
  'longest_habit_streak:275': require('../../assets/badges/longest habit streak/habitstreak275.png'),
  'longest_habit_streak:365': require('../../assets/badges/longest habit streak/habitstreak365.png'),

  // Habit completions
  'total_habit_completions:1': require('../../assets/badges/habits completed/completion1.png'),
  'total_habit_completions:5': require('../../assets/badges/habits completed/completion5.png'),
  'total_habit_completions:10': require('../../assets/badges/habits completed/completion10.png'),
  'total_habit_completions:25': require('../../assets/badges/habits completed/completion25.png'),
  'total_habit_completions:50': require('../../assets/badges/habits completed/completion50.png'),
  'total_habit_completions:100': require('../../assets/badges/habits completed/completion100.png'),
  'total_habit_completions:250': require('../../assets/badges/habits completed/completion250.png'),
  'total_habit_completions:500': require('../../assets/badges/habits completed/completion500.png'),
  'total_habit_completions:1000': require('../../assets/badges/habits completed/completion1000.png'),

  // Total habits achieved
  'total_habits_achieved:1': require('../../assets/badges/total habits achieved/totalhabits1.png'),
  'total_habits_achieved:3': require('../../assets/badges/total habits achieved/totalhabits3.png'),
  'total_habits_achieved:5': require('../../assets/badges/total habits achieved/totalhabits5.png'),
  'total_habits_achieved:10': require('../../assets/badges/total habits achieved/totalhabits10.png'),
  'total_habits_achieved:25': require('../../assets/badges/total habits achieved/totalhabits25.png'),
  'total_habits_achieved:50': require('../../assets/badges/total habits achieved/totalhabits50.png'),
  'total_habits_achieved:75': require('../../assets/badges/total habits achieved/totalhabits75.png'),
  'total_habits_achieved:100': require('../../assets/badges/total habits achieved/totalhabits100.png'),

  // Account age (requested milestones)
  'account_age:1': require('../../assets/badges/account age/account age 1 months.png'),
  'account_age:3': require('../../assets/badges/account age/account age 3 months.png'),
  'account_age:6': require('../../assets/badges/account age/account age 6 months.png'),
  'account_age:9': require('../../assets/badges/account age/account age 9 months.png'),
  'account_age:12': require('../../assets/badges/account age/account age 1 year.png'),
  'account_age:24': require('../../assets/badges/account age/account age 2 years.png'),
  'account_age:36': require('../../assets/badges/account age/account age 3 years.png'),
  'account_age:48': require('../../assets/badges/account age/account age 4 years.png'),
  'account_age:60': require('../../assets/badges/account age/account age 5 years.png'),
};

const FALLBACK_BY_VARIANT = {
  streak_current: require('../../assets/badges/longest current streak/current2.png'),
  streak_habit: require('../../assets/badges/longest habit streak/habitstreak2.png'),
  habit_completions: require('../../assets/badges/habits completed/completion1.png'),
  habits_achieved: require('../../assets/badges/total habits achieved/totalhabits1.png'),
  account_monthly: require('../../assets/badges/account age/account age 3 months.png'),
  account_yearly: require('../../assets/badges/account age/account age 1 year.png'),
  default: require('../../assets/badges/longest current streak/current2.png'),
};

const getBadgeKey = (badge = {}) => {
  if (badge?.badgeId) return String(badge.badgeId);
  if (badge?.id) return String(badge.id);
  if (badge?.achievementId && badge?.milestone !== undefined) {
    return `${badge.achievementId}:${badge.milestone}`;
  }
  return '';
};

const getAsset = (badge = {}) => {
  const key = getBadgeKey(badge);
  if (key && BADGE_ASSET_BY_ID[key]) return BADGE_ASSET_BY_ID[key];
  return FALLBACK_BY_VARIANT[badge?.variant] || FALLBACK_BY_VARIANT.default;
};

const AchievementBadge = ({
  badge,
  compact = false,
  onPress,
  style,
  showMilestoneLabel = true,
  disabled = false,
}) => {
  const unlocked = !!badge?.unlocked;
  const Component = onPress ? TouchableOpacity : View;
  const localSource = getAsset(badge);
  const badgeIdentity = `${badge?.badgeId || badge?.achievementId || 'badge'}:${badge?.milestone ?? ''}:${badge?.imageUri || ''}`;
  const [useRemoteImage, setUseRemoteImage] = React.useState(Boolean(badge?.imageUri));

  React.useEffect(() => {
    setUseRemoteImage(Boolean(badge?.imageUri));
  }, [badgeIdentity, badge?.imageUri]);

  const source = useRemoteImage && badge?.imageUri ? { uri: badge.imageUri } : localSource;
  const artStyle = compact
    ? showMilestoneLabel
      ? styles.badgeArtCompactWithLabel
      : styles.badgeArtCompact
    : showMilestoneLabel
    ? styles.badgeArtRegularWithLabel
    : styles.badgeArtRegular;

  return (
    <Component
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.wrap,
        compact ? styles.wrapCompact : styles.wrapRegular,
        { opacity: unlocked ? 1 : 0.58 },
        style,
      ]}
    >
      <View style={styles.badgeCanvas}>
        <Image
          source={source}
          style={[styles.badgeArt, artStyle]}
          resizeMode="contain"
          onError={() => {
            if (useRemoteImage) setUseRemoteImage(false);
          }}
        />
      </View>
      {!unlocked ? (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={compact ? 11 : 12} color="#E2E8F0" />
        </View>
      ) : null}

      {showMilestoneLabel ? (
        <Text
          numberOfLines={1}
          style={[
            compact ? styles.milestoneCompact : styles.milestone,
            { color: '#CBD5E1' },
          ]}
        >
          {badge?.milestoneLabel || ''}
        </Text>
      ) : null}

      {Array.isArray(badge?.equippedSlots) && badge.equippedSlots.length ? (
        <View style={styles.equippedPill}>
          <Text style={styles.equippedText}>Slot {badge.equippedSlots[0]}</Text>
        </View>
      ) : null}
    </Component>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  wrapRegular: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  wrapCompact: {
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: borderRadius.lg,
  },
  badgeCanvas: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  badgeArt: {
    aspectRatio: 1,
    alignSelf: 'center',
  },
  badgeArtRegular: {
    width: '100%',
    height: '100%',
  },
  badgeArtRegularWithLabel: {
    width: '100%',
    height: '100%',
  },
  badgeArtCompact: {
    width: '96%',
    height: '96%',
  },
  badgeArtCompactWithLabel: {
    width: '86%',
    height: '86%',
  },
  lockOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.75)',
  },
  milestone: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  milestoneCompact: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
  equippedPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  equippedText: {
    ...typography.caption,
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '700',
  },
});

export default AchievementBadge;
