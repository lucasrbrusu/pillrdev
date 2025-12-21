import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../utils/theme';
import { Card, Modal, Button, Input } from '../components';
import { useApp } from '../context/AppContext';

const GroupDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId } = route.params || {};

  const {
    groups,
    groupHabits,
    groupHabitCompletions,
    groupRoutines,
    fetchGroupMembers,
    addGroupHabit,
    toggleGroupHabitCompletion,
    addGroupRoutine,
    addTaskToGroupRoutine,
    removeTaskFromGroupRoutine,
    reorderGroupRoutineTasks,
    deleteGroupRoutine,
    deleteGroup,
    themeColors,
    authUser,
    friends,
    sendGroupInvites,
    isPremiumUser,
    ensureGroupDataLoaded,
    ensureFriendDataLoaded,
  } = useApp();

  const [members, setMembers] = useState([]);
  const [showHabitModal, setShowHabitModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [habitTitle, setHabitTitle] = useState('');
  const [habitDescription, setHabitDescription] = useState('');
  const [routineName, setRoutineName] = useState('');
  const [taskName, setTaskName] = useState('');
  const [selectedRoutineId, setSelectedRoutineId] = useState(null);
  const [submittingHabit, setSubmittingHabit] = useState(false);
  const [submittingRoutine, setSubmittingRoutine] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState([]);
  const [sendingInvites, setSendingInvites] = useState(false);

  const themedStyles = useMemo(() => createStyles(themeColors || colors), [themeColors]);

  const group = groups.find((g) => g.id === groupId);
  const groupHabitsForGroup = (groupHabits || []).filter((h) => h.groupId === groupId);
  const groupRoutinesForGroup = (groupRoutines || []).filter((r) => r.groupId === groupId);
  const todayKey = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    ensureGroupDataLoaded();
    ensureFriendDataLoaded();
  }, [ensureFriendDataLoaded, ensureGroupDataLoaded]);

  useEffect(() => {
    if (groupId) {
      fetchGroupMembers(groupId).then((res) => setMembers(res || []));
    }
  }, [groupId, fetchGroupMembers]);

  const handleAddHabit = async () => {
    if (!habitTitle.trim()) return;
    setSubmittingHabit(true);
    try {
      await addGroupHabit({
        groupId,
        title: habitTitle.trim(),
        description: habitDescription.trim(),
      });
      setHabitTitle('');
      setHabitDescription('');
      setShowHabitModal(false);
    } catch (err) {
      Alert.alert('Unable to create habit', err?.message || 'Please try again.');
    } finally {
      setSubmittingHabit(false);
    }
  };

  const handleAddRoutine = async () => {
    if (!routineName.trim()) return;
    setSubmittingRoutine(true);
    try {
      const routine = await addGroupRoutine({ groupId, name: routineName.trim() });
      setRoutineName('');
      setShowRoutineModal(false);
    } catch (err) {
      Alert.alert('Unable to create routine', err?.message || 'Please try again.');
    } finally {
      setSubmittingRoutine(false);
    }
  };

  const handleAddTask = async () => {
    if (!taskName.trim() || !selectedRoutineId) return;
    await addTaskToGroupRoutine(selectedRoutineId, { name: taskName.trim() });
    setTaskName('');
    setSelectedRoutineId(null);
    setShowTaskModal(false);
  };

  const handleDeleteGroup = () => {
    if (!groupId) return;
    Alert.alert(
      'Delete group?',
      'This will remove the group for all members.',
      [
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
      ]
    );
  };

  const handleToggleInvitee = (userId) => {
    setSelectedInvitees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSendInvites = async () => {
    if (!selectedInvitees.length) {
      setShowInviteModal(false);
      return;
    }
    setSendingInvites(true);
    try {
      await sendGroupInvites({ groupId, userIds: selectedInvitees });
      setSelectedInvitees([]);
      setShowInviteModal(false);
    } catch (err) {
      Alert.alert('Unable to send invites', err?.message || 'Please try again.');
    } finally {
      setSendingInvites(false);
    }
  };

  const getMemberDisplay = (userId) => {
    const member = members.find((m) => m.id === userId) || group?.members?.find((m) => m.id === userId);
    return member?.username ? `@${member.username}` : member?.name || 'Member';
  };

  const renderHabitRow = (habit) => {
    const completions = groupHabitCompletions[habit.id] || [];
    const todayCompletions = completions.filter((c) => c.date === todayKey);
    const completedByMe = todayCompletions.some((c) => c.userId === authUser?.id);
    const progressLabel = `${todayCompletions.length}/${members.length || 1} today`;

    return (
      <View key={habit.id} style={themedStyles.habitRow}>
        <View style={themedStyles.habitText}>
          <Text style={themedStyles.habitTitle}>{habit.title}</Text>
          {habit.description ? (
            <Text style={themedStyles.habitMeta}>{habit.description}</Text>
          ) : null}
          <Text style={themedStyles.habitMeta}>{progressLabel}</Text>
        </View>
        <TouchableOpacity
          style={[themedStyles.checkbox, completedByMe && themedStyles.checkboxChecked]}
          onPress={() => toggleGroupHabitCompletion(habit.id)}
        >
          {completedByMe ? (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          ) : null}
        </TouchableOpacity>
      </View>
    );
  };

  const renderRoutine = (routine) => (
    <View key={routine.id} style={themedStyles.routineCard}>
      <View style={themedStyles.routineHeader}>
        <Text style={themedStyles.routineTitle}>{routine.name}</Text>
        <View style={themedStyles.routineActions}>
          <TouchableOpacity
            style={themedStyles.routineActionButton}
            onPress={() => {
              setSelectedRoutineId(routine.id);
              setTaskName('');
              setShowTaskModal(true);
            }}
          >
            <Ionicons name="add" size={18} color={themedStyles.subduedText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.routineActionButton}
            onPress={() =>
              Alert.alert('Delete routine?', 'Remove this routine for the group?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteGroupRoutine(routine.id),
                },
              ])
            }
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
      {(routine.tasks || []).length === 0 ? (
        <Text style={themedStyles.habitMeta}>No tasks yet.</Text>
      ) : (
        routine.tasks.map((task, index) => {
          const atTop = index === 0;
          const atBottom = index === (routine.tasks || []).length - 1;
          return (
            <View key={task.id} style={themedStyles.taskRow}>
              <View style={themedStyles.taskOrderControls}>
                <TouchableOpacity
                  onPress={() =>
                    reorderGroupRoutineTasks(routine.id, [
                      ...routine.tasks.slice(0, index - 1),
                      routine.tasks[index],
                      routine.tasks[index - 1],
                      ...routine.tasks.slice(index + 1),
                    ])
                  }
                  disabled={atTop}
                >
                  <Ionicons
                    name="chevron-up"
                    size={16}
                    color={atTop ? colors.border : themedStyles.subduedText}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    reorderGroupRoutineTasks(routine.id, [
                      ...routine.tasks.slice(0, index),
                      routine.tasks[index + 1],
                      routine.tasks[index],
                      ...routine.tasks.slice(index + 2),
                    ])
                  }
                  disabled={atBottom}
                >
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={atBottom ? colors.border : themedStyles.subduedText}
                  />
                </TouchableOpacity>
              </View>
              <Text style={themedStyles.taskText}>{task.name}</Text>
              <TouchableOpacity onPress={() => removeTaskFromGroupRoutine(routine.id, task.id)}>
                <Ionicons name="close" size={18} color={themedStyles.subduedText} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );

  if (!group) {
    return (
      <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
        <View style={themedStyles.header}>
          <TouchableOpacity style={themedStyles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
          </TouchableOpacity>
          <Text style={themedStyles.title}>Group</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={themedStyles.centered}>
          <Text style={themedStyles.emptyText}>Group not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity style={themedStyles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>{group.name}</Text>
        <View style={themedStyles.headerActions}>
          {group?.ownerId === authUser?.id ? (
            <TouchableOpacity
              style={themedStyles.backButton}
              onPress={handleDeleteGroup}
              disabled={deletingGroup}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={deletingGroup ? colors.border : colors.danger}
              />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={themedStyles.backButton} onPress={() => setShowHabitModal(true)}>
            <Ionicons name="add" size={22} color={themedStyles.iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <View style={themedStyles.rowLeft}>
              <Text style={themedStyles.sectionTitle}>Members</Text>
              <Text style={themedStyles.sectionMeta}>{members.length} total</Text>
            </View>
            <View style={themedStyles.rowRight}>
              {group?.ownerId === authUser?.id ? (
                <TouchableOpacity
                  style={themedStyles.iconButton}
                  onPress={() => {
                    if (!isPremiumUser) {
                      navigation.navigate('Paywall', { source: 'groups' });
                      return;
                    }
                    setShowInviteModal(true);
                  }}
                >
                  <Ionicons name="add" size={18} color={themedStyles.iconColor} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          {members.length === 0 ? (
            <Text style={themedStyles.emptyText}>No members loaded.</Text>
          ) : (
            members.map((member) => (
              <View key={member.id} style={themedStyles.memberRow}>
                <View style={themedStyles.avatar}>
                  <Text style={themedStyles.avatarText}>
                    {(member.name || member.username || '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={themedStyles.memberName}>{member.name || 'Member'}</Text>
                  <Text style={themedStyles.memberMeta}>
                    {member.username ? `@${member.username}` : 'No username'}
                  </Text>
                </View>
                {member.role === 'owner' ? (
                  <View style={themedStyles.rolePill}>
                    <Text style={themedStyles.rolePillText}>Owner</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </Card>

        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>Group habits</Text>
            <TouchableOpacity onPress={() => setShowHabitModal(true)}>
              <Feather name="plus-circle" size={18} color={themedStyles.iconColor} />
            </TouchableOpacity>
          </View>
          {groupHabitsForGroup.length === 0 ? (
            <Text style={themedStyles.emptyText}>No group habits yet.</Text>
          ) : (
            groupHabitsForGroup.map((habit) => renderHabitRow(habit))
          )}
        </Card>

        <Card style={themedStyles.sectionCard}>
          <View style={themedStyles.sectionHeader}>
            <Text style={themedStyles.sectionTitle}>Group routines</Text>
            <TouchableOpacity onPress={() => setShowRoutineModal(true)}>
              <Feather name="plus-circle" size={18} color={themedStyles.iconColor} />
            </TouchableOpacity>
          </View>
          {groupRoutinesForGroup.length === 0 ? (
            <Text style={themedStyles.emptyText}>No group routines yet.</Text>
          ) : (
            groupRoutinesForGroup.map((routine) => renderRoutine(routine))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={showHabitModal}
        onClose={() => {
          setShowHabitModal(false);
          setHabitTitle('');
          setHabitDescription('');
        }}
        title="New group habit"
        fullScreen={false}
      >
        <Input
          label="Habit title"
          value={habitTitle}
          onChangeText={setHabitTitle}
          placeholder="e.g., Morning check-in"
        />
        <Input
          label="Description"
          value={habitDescription}
          onChangeText={setHabitDescription}
          placeholder="Optional"
          multiline
        />
        <View style={themedStyles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setShowHabitModal(false)}
            style={themedStyles.modalButton}
          />
          <Button
            title="Create"
            onPress={handleAddHabit}
            disabled={!habitTitle.trim() || submittingHabit}
            style={themedStyles.modalButton}
          />
        </View>
      </Modal>

      <Modal
        visible={showRoutineModal}
        onClose={() => {
          setShowRoutineModal(false);
          setRoutineName('');
        }}
        title="New group routine"
        fullScreen={false}
      >
        <Input
          label="Routine name"
          value={routineName}
          onChangeText={setRoutineName}
          placeholder="e.g., Weekly reset"
        />
        <View style={themedStyles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setShowRoutineModal(false)}
            style={themedStyles.modalButton}
          />
          <Button
            title="Create"
            onPress={handleAddRoutine}
          disabled={!routineName.trim() || submittingRoutine}
          style={themedStyles.modalButton}
        />
      </View>
      </Modal>

      <Modal
        visible={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskName('');
          setSelectedRoutineId(null);
        }}
        title="Add task to routine"
        fullScreen={false}
      >
        <Input
          label="Task name"
          value={taskName}
          onChangeText={setTaskName}
          placeholder="e.g., Share wins"
        />
        <View style={themedStyles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowTaskModal(false);
              setTaskName('');
              setSelectedRoutineId(null);
            }}
            style={themedStyles.modalButton}
          />
          <Button
            title="Add"
            onPress={handleAddTask}
            disabled={!taskName.trim() || !selectedRoutineId}
            style={themedStyles.modalButton}
          />
        </View>
      </Modal>

      <Modal
        visible={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setSelectedInvitees([]);
        }}
        title="Invite members"
        fullScreen={false}
      >
        {friends.length === 0 ? (
          <Text style={themedStyles.emptyText}>No friends to invite yet.</Text>
        ) : (
          friends
            .filter((f) => !members.some((m) => m.id === f.id))
            .map((friend) => {
              const selected = selectedInvitees.includes(friend.id);
              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[
                    themedStyles.friendRow,
                    selected && { borderColor: themeColors?.primary || colors.primary },
                  ]}
                  onPress={() => handleToggleInvitee(friend.id)}
                >
                  <Text style={themedStyles.friendName}>{friend.name || friend.username || 'Friend'}</Text>
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
            onPress={() => {
              setShowInviteModal(false);
              setSelectedInvitees([]);
            }}
            style={themedStyles.modalButton}
          />
          <Button
            title={sendingInvites ? 'Sending...' : 'Send Invites'}
            onPress={handleSendInvites}
            disabled={sendingInvites || selectedInvitees.length === 0}
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconButton: {
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    emptyText: {
      ...typography.body,
      color: subdued,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      marginRight: spacing.md,
    },
    avatarText: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
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
    rolePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    rolePillText: {
      ...typography.caption,
      color: subdued,
      fontWeight: '700',
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
    habitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    habitText: {
      flex: 1,
      marginRight: spacing.md,
    },
    habitTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    habitMeta: {
      ...typography.bodySmall,
      color: subdued,
      marginTop: 2,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.card || colors.card,
    },
    checkboxChecked: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
      borderColor: themeColorsParam?.primary || colors.primary,
    },
    routineCard: {
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: themeColorsParam?.card || colors.card,
      ...shadows.small,
    },
    routineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    routineTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    routineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    routineActionButton: {
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    taskOrderControls: {
      width: 28,
      alignItems: 'center',
      gap: spacing.xs,
    },
    taskText: {
      ...typography.body,
      color: baseText,
      flex: 1,
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    emptyTitle: {
      ...typography.body,
      color: subdued,
    },
    subduedText: subdued,
  });
};

export default GroupDetailScreen;
