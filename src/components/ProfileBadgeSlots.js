import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing, typography } from '../utils/theme';
import AchievementBadge from './AchievementBadge';
import { getBadgeDetails, normalizeBadgeSlots } from '../utils/achievements';

const ProfileBadgeSlots = ({
  badgeSlots,
  badgeCatalog = {},
  title = 'Equipped badges',
  subtitle = 'Choose up to 3 badges',
  interactive = false,
  onPressSlot,
  textColor = '#E2E8F0',
  mutedColor = '#94A3B8',
  cardColor = 'rgba(15,23,42,0.32)',
  borderColor = 'rgba(148,163,184,0.3)',
}) => {
  const slots = normalizeBadgeSlots(badgeSlots);

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>{subtitle}</Text>
      </View>
      <View style={styles.row}>
        {slots.map((badgeId, index) => {
          const details = getBadgeDetails(badgeId);
          const dbBadge = details?.id ? badgeCatalog?.[details.id] : null;
          const content = details ? (
            <AchievementBadge
              badge={{
                ...details,
                milestoneLabel: dbBadge?.milestoneLabel || details.milestoneLabel,
                imageUri: dbBadge?.imageUri || null,
                unlocked: true,
                equippedSlots: [],
              }}
              compact
              showMilestoneLabel={false}
            />
          ) : (
            <View
              style={[
                styles.emptySlot,
                { borderColor, backgroundColor: 'rgba(15,23,42,0.35)' },
              ]}
            >
              <Ionicons name="ribbon-outline" size={18} color={mutedColor} />
              <Text style={[styles.emptyText, { color: mutedColor }]}>Slot {index + 1}</Text>
            </View>
          );

          if (!interactive || typeof onPressSlot !== 'function') {
            return (
              <View key={`slot-${index}`} style={styles.slotWrap}>
                {content}
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={`slot-${index}`}
              style={styles.slotWrap}
              activeOpacity={0.8}
              onPress={() => onPressSlot(index)}
            >
              {content}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.sm,
  },
  header: {
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  slotWrap: {
    flex: 1,
  },
  emptySlot: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  emptyText: {
    ...typography.caption,
    fontWeight: '700',
  },
});

export default ProfileBadgeSlots;
