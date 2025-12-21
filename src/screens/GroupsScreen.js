import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card, Modal, Button, Input } from '../components';
import { useApp } from '../context/AppContext';

const GroupsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    groups,
    friends,
    groupInvites,
    ensureGroupDataLoaded,
    ensureFriendDataLoaded,
    createGroup,
    respondToGroupInvite,
    themeColors,
    isPremiumUser,
  } = useApp();

  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [responding, setResponding] = useState({});

  useEffect(() => {
    ensureGroupDataLoaded();
    ensureFriendDataLoaded();
  }, [ensureFriendDataLoaded, ensureGroupDataLoaded]);

  const themedStyles = useMemo(() => createStyles(themeColors || colors), [themeColors]);

  const toggleFriendSelection = (id) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setSubmitting(true);
    try {
      await createGroup({ name: groupName.trim(), inviteUserIds: selectedFriendIds });
      setGroupName('');
      setSelectedFriendIds([]);
      setShowCreate(false);
    } catch (err) {
      Alert.alert('Unable to create group', err?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondInvite = async (inviteId, status) => {
    setResponding((prev) => ({ ...prev, [inviteId]: status }));
    try {
      await respondToGroupInvite(inviteId, status);
    } catch (err) {
      Alert.alert('Unable to update invite', err?.message || 'Please try again.');
    } finally {
      setResponding((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const renderInviteCard = (invite) => (
    <View key={invite.id} style={themedStyles.inviteCard}>
      <View style={themedStyles.inviteIcon}>
        <Feather name="users" size={18} color={colors.primary} />
      </View>
      <View style={themedStyles.inviteContent}>
        <Text style={themedStyles.inviteTitle}>
          {invite.fromUser?.name || invite.fromUser?.username || 'Someone'} invited you to join
        </Text>
        <Text style={themedStyles.inviteMeta}>{invite.group?.name || 'Group'}</Text>
        <View style={themedStyles.inviteActions}>
          <TouchableOpacity
            style={themedStyles.primaryButton}
            disabled={!!responding[invite.id]}
            onPress={() => handleRespondInvite(invite.id, 'accepted')}
          >
            <Text style={themedStyles.primaryButtonText}>
              {responding[invite.id] === 'accepted' ? '...' : 'Accept'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.secondaryButton}
            disabled={!!responding[invite.id]}
            onPress={() => handleRespondInvite(invite.id, 'declined')}
          >
            <Text style={themedStyles.secondaryButtonText}>
              {responding[invite.id] === 'declined' ? '...' : 'Decline'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity style={themedStyles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>Groups</Text>
        <TouchableOpacity
          style={[
            themedStyles.backButton,
            !isPremiumUser && { opacity: 0.4 },
          ]}
          onPress={() => {
            if (!isPremiumUser) {
              navigation.navigate('Paywall', { source: 'groups' });
              return;
            }
            setShowCreate(true);
          }}
        >
          <Ionicons name="add" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>Your groups</Text>
            <Text style={themedStyles.sectionMeta}>{groups.length} total</Text>
          </View>
          {groups.length === 0 ? (
            <Text style={themedStyles.emptyText}>No groups yet. Create one to get started.</Text>
          ) : (
            groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={themedStyles.groupRow}
                onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
              >
                <View>
                  <Text style={themedStyles.groupName}>{group.name}</Text>
                  <Text style={themedStyles.groupMeta}>
                    {group.members?.length || 1} member{(group.members?.length || 1) === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={themedStyles.subduedText} />
              </TouchableOpacity>
            ))
          )}
        </Card>

        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>Invitations</Text>
            <Text style={themedStyles.sectionMeta}>
              {groupInvites.incoming?.length || 0} pending
            </Text>
          </View>
          {(groupInvites.incoming || []).length === 0 ? (
            <Text style={themedStyles.emptyText}>No invitations right now.</Text>
          ) : (
            groupInvites.incoming.map((invite) => renderInviteCard(invite))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={showCreate}
        onClose={() => {
          setShowCreate(false);
          setGroupName('');
          setSelectedFriendIds([]);
        }}
        title="Create group"
        fullScreen={false}
      >
        <Input
          label="Group name"
          value={groupName}
          onChangeText={setGroupName}
          placeholder="e.g., Morning crew"
        />
        <Text style={themedStyles.subheading}>Invite friends (optional)</Text>
        {friends.length === 0 ? (
          <Text style={themedStyles.emptyText}>Add friends to invite them here.</Text>
        ) : (
          friends.map((friend) => {
            const selected = selectedFriendIds.includes(friend.id);
            return (
              <TouchableOpacity
                key={friend.id}
                style={[
                  themedStyles.friendRow,
                  selected && { borderColor: themeColors?.primary || colors.primary },
                ]}
                onPress={() => toggleFriendSelection(friend.id)}
              >
                <Text style={themedStyles.friendName}>
                  {friend.name || friend.username || 'Friend'}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                ) : (
                  <Ionicons name="ellipse-outline" size={18} color={themedStyles.subduedText} />
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={themedStyles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setShowCreate(false)}
            style={themedStyles.modalButton}
          />
          <Button
            title="Create"
            onPress={handleCreateGroup}
            disabled={!groupName.trim() || submitting}
            style={themedStyles.modalButton}
          />
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const baseText = themeColorsParam?.text || colors.text;
  const subdued = themeColorsParam?.textSecondary || colors.textSecondary;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColorsParam?.background || colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    iconColor: baseText,
    title: {
      ...typography.h3,
      color: baseText,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    sectionCard: {
      marginBottom: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      ...typography.h3,
      color: baseText,
    },
    sectionMeta: {
      ...typography.caption,
      color: subdued,
    },
    emptyText: {
      ...typography.body,
      color: subdued,
    },
    groupRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    groupName: {
      ...typography.body,
      fontWeight: '700',
      color: baseText,
    },
    groupMeta: {
      ...typography.bodySmall,
      color: subdued,
    },
    inviteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: themeColorsParam?.card || colors.card,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      marginBottom: spacing.sm,
      ...shadows.small,
    },
    inviteIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}15`,
      marginRight: spacing.md,
    },
    inviteContent: {
      flex: 1,
    },
    inviteTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    inviteMeta: {
      ...typography.bodySmall,
      color: subdued,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    inviteActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    primaryButton: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    primaryButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    secondaryButton: {
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    secondaryButtonText: {
      ...typography.body,
      color: baseText,
      fontWeight: '600',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    infoText: {
      ...typography.body,
      color: subdued,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    subheading: {
      ...typography.caption,
      color: subdued,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    friendName: {
      ...typography.body,
      color: baseText,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    modalButton: {
      flex: 1,
    },
  });
};

export default GroupsScreen;
