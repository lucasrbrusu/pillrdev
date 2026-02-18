import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card, Button, Input } from '../components';
import { useApp } from '../context/AppContext';

const GroupDetailsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params || {};

  const {
    groups,
    fetchGroupMembers,
    removeGroupMember,
    leaveGroup,
    deleteGroup,
    updateGroupName,
    themeColors,
    authUser,
    ensureGroupDataLoaded,
    ensureFriendDataLoaded,
  } = useApp();

  const [members, setMembers] = useState([]);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const themedStyles = useMemo(() => createStyles(themeColors || colors), [themeColors]);

  const group = groups.find((g) => g.id === groupId);
  const isAdmin = group?.ownerId === authUser?.id;
  const memberList = useMemo(
    () => (members.length ? members : group?.members || []),
    [members, group?.members]
  );

  useEffect(() => {
    ensureGroupDataLoaded();
    ensureFriendDataLoaded();
  }, [ensureFriendDataLoaded, ensureGroupDataLoaded]);

  useEffect(() => {
    if (!groupId) return;
    fetchGroupMembers(groupId).then((res) => setMembers(res || []));
  }, [groupId, fetchGroupMembers]);

  useEffect(() => {
    if (!group?.name || isEditing) return;
    setGroupNameDraft(group.name);
  }, [group?.name, isEditing]);

  const handleDeleteGroup = () => {
    if (!groupId) return;
    Alert.alert('Delete group?', 'This will remove the group for all members.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingGroup(true);
          try {
            await deleteGroup(groupId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Unable to delete group', err?.message || 'Please try again.');
          } finally {
            setDeletingGroup(false);
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    if (!groupId) return;
    if (isAdmin) {
      Alert.alert("Admins can't leave", 'Delete the group instead.');
      return;
    }
    Alert.alert('Leave group?', 'You will be removed from this group.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLeavingGroup(true);
          try {
            await leaveGroup(groupId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Unable to leave group', err?.message || 'Please try again.');
          } finally {
            setLeavingGroup(false);
          }
        },
      },
    ]);
  };

  const handleKickMember = (member) => {
    if (!groupId || !member?.id) return;
    Alert.alert(
      'Kick member?',
      `Kick ${member.name || member.username || 'this member'} out of this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kick',
          style: 'destructive',
          onPress: async () => {
            setRemovingMemberId(member.id);
            try {
              await removeGroupMember(groupId, member.id);
              const refreshed = await fetchGroupMembers(groupId);
              setMembers(refreshed || []);
            } catch (err) {
              Alert.alert('Unable to kick member', err?.message || 'Please try again.');
            } finally {
              setRemovingMemberId(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleEdit = () => {
    if (!isAdmin) return;
    if (isEditing) {
      setIsEditing(false);
      setGroupNameDraft(group?.name || '');
      return;
    }
    setGroupNameDraft(group?.name || '');
    setIsEditing(true);
  };

  const handleSaveName = async () => {
    if (!groupId || !isAdmin) return;
    const trimmed = groupNameDraft.trim();
    if (!trimmed) {
      Alert.alert('Group name required', 'Please enter a group name.');
      return;
    }
    if (trimmed === group?.name) {
      setIsEditing(false);
      return;
    }
    setSavingName(true);
    try {
      await updateGroupName(groupId, trimmed);
      setIsEditing(false);
    } catch (err) {
      Alert.alert('Unable to update group', err?.message || 'Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  if (!group) {
    return (
      <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
        <View style={themedStyles.header}>
          <TouchableOpacity style={themedStyles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
          </TouchableOpacity>
          <Text style={themedStyles.title}>Group Details</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={themedStyles.centered}>
          <Text style={themedStyles.emptyText}>Group not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={themedStyles.container}>
      <View style={[themedStyles.header, { paddingTop: insets.top || spacing.lg }]}>
        <TouchableOpacity style={themedStyles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>Group Details</Text>
        {isAdmin ? (
          <TouchableOpacity style={themedStyles.backButton} onPress={handleToggleEdit}>
            <Ionicons
              name={isEditing ? 'close' : 'create-outline'}
              size={20}
              color={themedStyles.iconColor}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>Group</Text>
          </View>
          {isEditing ? (
            <>
              <Input
                label="Group name"
                value={groupNameDraft}
                onChangeText={setGroupNameDraft}
                placeholder="Group name"
              />
              <View style={themedStyles.editActions}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={handleToggleEdit}
                  style={themedStyles.editButton}
                />
                <Button
                  title={savingName ? 'Saving...' : 'Save'}
                  onPress={handleSaveName}
                  disabled={savingName}
                  style={themedStyles.editButton}
                />
              </View>
            </>
          ) : (
            <View style={themedStyles.detailRow}>
              <Text style={themedStyles.detailLabel}>Name</Text>
              <Text style={themedStyles.detailValue}>{group.name}</Text>
            </View>
          )}
          <View style={themedStyles.detailRow}>
            <Text style={themedStyles.detailLabel}>Members</Text>
            <Text style={themedStyles.detailValue}>{memberList.length}</Text>
          </View>
        </Card>

        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>Members</Text>
          </View>
          {memberList.length === 0 ? (
            <Text style={themedStyles.emptyText}>No members loaded.</Text>
          ) : (
            memberList.map((member) => {
              const isOwner = member.id === group?.ownerId;
              const canKick = isAdmin && !isOwner;
              return (
                <View key={member.id} style={themedStyles.memberRow}>
                  <View style={themedStyles.memberInfo}>
                    <View style={themedStyles.memberNameRow}>
                      <Text style={themedStyles.memberName}>{member.name || 'Member'}</Text>
                      {isOwner ? (
                        <View style={themedStyles.adminBadge}>
                          <Text style={themedStyles.adminBadgeText}>Admin</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={themedStyles.memberMeta}>
                      {member.username ? `@${member.username}` : 'No username'}
                    </Text>
                  </View>
                  {canKick ? (
                    <TouchableOpacity
                      style={themedStyles.removeButton}
                      onPress={() => handleKickMember(member)}
                      disabled={removingMemberId === member.id}
                    >
                      {removingMemberId === member.id ? (
                        <ActivityIndicator size="small" color={colors.danger || '#d9534f'} />
                      ) : (
                        <Text style={themedStyles.removeButtonText}>Kick</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </Card>

        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>Membership</Text>
          </View>
          {isAdmin ? (
            <TouchableOpacity
              style={[themedStyles.dangerButton, themedStyles.fullButton]}
              onPress={handleDeleteGroup}
              disabled={deletingGroup}
            >
              <Text style={themedStyles.dangerButtonText}>
                {deletingGroup ? 'Deleting...' : 'Delete group'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[themedStyles.outlineButton, themedStyles.fullButton]}
            onPress={handleLeaveGroup}
            disabled={leavingGroup}
          >
            <Text style={themedStyles.outlineButtonText}>
              {leavingGroup ? 'Leaving...' : 'Leave group'}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
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
      borderRadius: borderRadius.xl,
      ...shadows.small,
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
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    detailLabel: {
      ...typography.bodySmall,
      color: subdued,
      fontWeight: '600',
    },
    detailValue: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    editActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    editButton: {
      flex: 1,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    memberInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    memberName: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    memberMeta: {
      ...typography.bodySmall,
      color: subdued,
    },
    adminBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.primaryLight || colors.primaryLight,
    },
    adminBadgeText: {
      ...typography.caption,
      color: baseText,
      fontWeight: '700',
    },
    removeButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.danger || '#d9534f',
      minWidth: 72,
      alignItems: 'center',
    },
    removeButtonText: {
      ...typography.caption,
      color: colors.danger || '#d9534f',
      fontWeight: '700',
    },
    fullButton: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.sm,
    },
    dangerButton: {
      backgroundColor: colors.danger || '#d9534f',
    },
    dangerButtonText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    outlineButtonText: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    emptyText: {
      ...typography.body,
      color: subdued,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
};

export default GroupDetailsScreen;
