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
import { Ionicons } from '@expo/vector-icons';
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
  const [activeTab, setActiveTab] = useState('overview');

  const themedStyles = useMemo(() => createStyles(themeColors || colors), [themeColors]);

  const group = groups.find((g) => g.id === groupId);
  const isAdmin = group?.ownerId === authUser?.id;
  const groupHabitsForGroup = (groupHabits || []).filter((h) => h.groupId === groupId);
  const groupRoutinesForGroup = (groupRoutines || []).filter((r) => r.groupId === groupId);
  const memberList = useMemo(
    () => (members.length ? members : group?.members || []),
    [members, group?.members]
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const memberCount = memberList.length;

  const allGroupCompletions = useMemo(
    () =>
      groupHabitsForGroup.flatMap((habit) => groupHabitCompletions[habit.id] || []),
    [groupHabitsForGroup, groupHabitCompletions]
  );
  const todayCompletions = useMemo(
    () => allGroupCompletions.filter((completion) => completion.date === todayKey),
    [allGroupCompletions, todayKey]
  );
  const completionPercent = useMemo(() => {
    if (!memberCount || !groupHabitsForGroup.length) return 0;
    const totalPossible = memberCount * groupHabitsForGroup.length;
    return Math.min(100, Math.round((todayCompletions.length / totalPossible) * 100));
  }, [memberCount, groupHabitsForGroup.length, todayCompletions.length]);
  const activeToday = useMemo(() => {
    const unique = new Set(todayCompletions.map((completion) => completion.userId));
    return unique.size;
  }, [todayCompletions]);
  const activityStreak = useMemo(() => {
    if (!allGroupCompletions.length) return 0;
    const dateSet = new Set(allGroupCompletions.map((completion) => completion.date));
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (!dateSet.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [allGroupCompletions]);
  const memberLeaderboard = useMemo(() => {
    const counts = new Map();
    todayCompletions.forEach((completion) => {
      counts.set(completion.userId, (counts.get(completion.userId) || 0) + 1);
    });
    return [...memberList]
      .map((member) => ({ ...member, todayCount: counts.get(member.id) || 0 }))
      .sort((a, b) => b.todayCount - a.todayCount);
  }, [memberList, todayCompletions]);

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


  const openInviteModal = () => {
    if (!isPremiumUser) {
      navigation.navigate('Paywall', { source: 'groups' });
      return;
    }
    setShowInviteModal(true);
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

  const habitPalette = ['#FCEFE2', '#E7FAEE', '#E8F1FF', '#F2E9FF'];
  const habitIcons = ['water-outline', 'barbell-outline', 'book-outline', 'sunny-outline'];
  const hashString = (value) =>
    String(value || '')
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const pickFromList = (id, list) => list[Math.abs(hashString(id)) % list.length];

  const renderHabitRow = (habit, index) => {
    const completions = groupHabitCompletions[habit.id] || [];
    const todayCompletionsForHabit = completions.filter((c) => c.date === todayKey);
    const completedByMe = todayCompletionsForHabit.some((c) => c.userId === authUser?.id);
    const completionCount = todayCompletionsForHabit.length;
    const progressValue = memberCount ? Math.min(100, Math.round((completionCount / memberCount) * 100)) : 0;
    const completedMemberIds = Array.from(
      new Set(todayCompletionsForHabit.map((completion) => completion.userId))
    );
    const completedMembers = completedMemberIds
      .map((id) => memberList.find((member) => member.id === id))
      .filter(Boolean);
    const visibleMembers = completedMembers.slice(0, 4);
    const extraCount = Math.max(0, completedMembers.length - visibleMembers.length);
    const accentColor = pickFromList(habit.id || index, habitPalette);
    const iconName = pickFromList(habit.id || index, habitIcons);

    return (
      <View key={habit.id} style={themedStyles.habitCard}>
        <View style={themedStyles.habitHeader}>
          <View style={[themedStyles.habitIcon, { backgroundColor: accentColor }]}>
            <Ionicons name={iconName} size={18} color={themedStyles.habitIconColor} />
          </View>
          <View style={themedStyles.habitText}>
            <Text style={themedStyles.habitTitle}>{habit.title}</Text>
            <Text style={themedStyles.habitMeta}>
              {habit.description || `${completionCount}/${memberCount || 1} completed`}
            </Text>
          </View>
          <TouchableOpacity
            style={[themedStyles.habitCheck, completedByMe && themedStyles.habitCheckActive]}
            onPress={() => toggleGroupHabitCompletion(habit.id)}
          >
            {completedByMe ? (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            ) : null}
          </TouchableOpacity>
        </View>
        <View style={themedStyles.progressTrack}>
          <View style={[themedStyles.progressFill, { width: `${progressValue}%` }]} />
        </View>
        <View style={themedStyles.habitFooter}>
          <Text style={themedStyles.habitFooterText}>
            {completionCount}/{memberCount || 1} completed today
          </Text>
          <View style={themedStyles.avatarRow}>
            {visibleMembers.map((member) => (
              <View key={member.id} style={themedStyles.smallAvatar}>
                <Text style={themedStyles.smallAvatarText}>
                  {(member.name || member.username || '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            ))}
            {extraCount > 0 ? (
              <View style={themedStyles.smallAvatarAlt}>
                <Text style={themedStyles.smallAvatarText}>+{extraCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const renderRoutine = (routine) => (
    <View key={routine.id} style={themedStyles.routineCard}>
      <View style={themedStyles.routineHeader}>
        <View style={themedStyles.routineTitleWrap}>
          <View style={themedStyles.routineIcon}>
            <Ionicons name="sparkles-outline" size={18} color={themedStyles.routineIconColor} />
          </View>
          <View>
            <Text style={themedStyles.routineTitle}>{routine.name}</Text>
            <Text style={themedStyles.routineMeta}>
              {(routine.tasks || []).length} tasks
            </Text>
          </View>
        </View>
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

  const quickActions = [
    {
      key: 'add-habit',
      label: 'Add Habit',
      icon: 'flame-outline',
      background: '#E8F1FF',
      onPress: () => setShowHabitModal(true),
    },
    {
      key: 'add-routine',
      label: 'Add Routine',
      icon: 'sparkles-outline',
      background: '#F3E8FF',
      onPress: () => setShowRoutineModal(true),
    },
    {
      key: 'invite',
      label: 'Invite Friends',
      icon: 'person-add-outline',
      background: '#E7FAEE',
      onPress: openInviteModal,
    },
    {
      key: 'stats',
      label: 'View Stats',
      icon: 'analytics-outline',
      background: '#FFF2E1',
      onPress: () => navigation.navigate('Insights'),
    },
  ];

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
    <View style={themedStyles.container}>
      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[themedStyles.hero, { paddingTop: insets.top || spacing.lg }]}>
          <View style={themedStyles.heroTopRow}>
            <TouchableOpacity style={themedStyles.heroIconButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={22} color={themedStyles.heroIconColor} />
            </TouchableOpacity>
            <View style={themedStyles.heroActions}>
              <TouchableOpacity
                style={themedStyles.heroIconButton}
                onPress={() => navigation.navigate('GroupDetails', { groupId })}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={themedStyles.heroIconColor} />
              </TouchableOpacity>
              {group?.ownerId === authUser?.id ? (
                <TouchableOpacity
                  style={themedStyles.heroIconButton}
                  onPress={handleDeleteGroup}
                  disabled={deletingGroup}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={deletingGroup ? colors.border : themedStyles.heroIconColor}
                  />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={themedStyles.heroIconButton}
                onPress={() => setShowHabitModal(true)}
              >
                <Ionicons name="add" size={22} color={themedStyles.heroIconColor} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={themedStyles.heroContent}>
            <View style={themedStyles.heroBadge}>
              <Ionicons name="people-outline" size={22} color={themedStyles.heroBadgeIcon} />
            </View>
            <View>
              <Text style={themedStyles.heroTitle}>{group.name}</Text>
              <Text style={themedStyles.heroMeta}>{memberCount} members</Text>
            </View>
          </View>
        </View>

        <Card style={themedStyles.progressCard}>
          <View style={themedStyles.progressHeader}>
            <View style={themedStyles.progressTitleWrap}>
              <Ionicons name="flame" size={16} color={themedStyles.progressIcon} />
              <Text style={themedStyles.progressTitle}>Group Progress</Text>
            </View>
          </View>
          <View style={themedStyles.statsGrid}>
            <View style={[themedStyles.statTile, themedStyles.statWarm]}>
              <Text style={themedStyles.statValue}>{activityStreak}</Text>
              <Text style={themedStyles.statLabel}>Day Streak</Text>
            </View>
            <View style={[themedStyles.statTile, themedStyles.statMint]}>
              <Text style={themedStyles.statValue}>{completionPercent}%</Text>
              <Text style={themedStyles.statLabel}>Completion</Text>
            </View>
            <View style={[themedStyles.statTile, themedStyles.statSky]}>
              <Text style={themedStyles.statValue}>{groupHabitsForGroup.length}</Text>
              <Text style={themedStyles.statLabel}>Shared Habits</Text>
            </View>
            <View style={[themedStyles.statTile, themedStyles.statLilac]}>
              <Text style={themedStyles.statValue}>{activeToday}</Text>
              <Text style={themedStyles.statLabel}>Active Today</Text>
            </View>
          </View>
        </Card>

        <View style={themedStyles.segmentWrap}>
          {['overview', 'habits', 'routines'].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[themedStyles.segmentButton, isActive && themedStyles.segmentButtonActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[themedStyles.segmentText, isActive && themedStyles.segmentTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'overview' ? (
          <View>
            <Card style={themedStyles.sectionCard}>
              <View style={themedStyles.sectionHeader}>
                <Text style={themedStyles.sectionTitle}>Members Leaderboard</Text>
                {isAdmin ? (
                  <TouchableOpacity style={themedStyles.iconButton} onPress={openInviteModal}>
                    <Ionicons name="add" size={18} color={themedStyles.iconColor} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {memberLeaderboard.length === 0 ? (
                <Text style={themedStyles.emptyText}>No members loaded.</Text>
              ) : (
                memberLeaderboard.map((member, index) => {
                  const totalHabits = groupHabitsForGroup.length || 0;
                  const progressLabel = totalHabits
                    ? `${member.todayCount}/${totalHabits} today`
                    : 'No habits yet';
                  const isTop = index < 3;
                  const rankColors = ['#F59E0B', '#9CA3AF', '#D97706'];
                  return (
                    <View key={member.id} style={themedStyles.leaderRow}>
                      <View style={themedStyles.rankBadge}>
                        {isTop ? (
                          <Ionicons
                            name="trophy"
                            size={14}
                            color={rankColors[index] || themeColors?.primary || colors.primary}
                          />
                        ) : (
                          <Text style={themedStyles.rankText}>#{index + 1}</Text>
                        )}
                      </View>
                      <View style={themedStyles.leaderAvatar}>
                        <Text style={themedStyles.leaderAvatarText}>
                          {(member.name || member.username || '?').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={themedStyles.leaderText}>
                        <View style={themedStyles.memberNameRow}>
                          <Text style={themedStyles.memberName}>{member.name || 'Member'}</Text>
                          {member.id === group?.ownerId ? (
                            <View style={themedStyles.adminBadge}>
                              <Text style={themedStyles.adminBadgeText}>Admin</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={themedStyles.memberMeta}>
                          {member.username ? `@${member.username}` : 'No username'}
                        </Text>
                      </View>
                      <View style={themedStyles.leaderStats}>
                        <View style={themedStyles.leaderScore}>
                          <Ionicons name="flame" size={14} color={themedStyles.progressIcon} />
                          <Text style={themedStyles.leaderScoreText}>{member.todayCount}</Text>
                        </View>
                        <Text style={themedStyles.leaderMeta}>{progressLabel}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </Card>

            <Card style={themedStyles.sectionCard}>
              <View style={themedStyles.sectionHeader}>
                <Text style={themedStyles.sectionTitle}>Quick Actions</Text>
              </View>
              <View style={themedStyles.quickActionsGrid}>
                {quickActions.map((action) => (
                  <TouchableOpacity
                    key={action.key}
                    style={[themedStyles.quickActionCard, { backgroundColor: action.background }]}
                    onPress={action.onPress}
                    activeOpacity={0.8}
                  >
                    <View style={themedStyles.quickActionIcon}>
                      <Ionicons name={action.icon} size={18} color={themedStyles.quickActionIconColor} />
                    </View>
                    <Text style={themedStyles.quickActionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {activeTab === 'habits' ? (
          <View style={themedStyles.sectionBlock}>
            <View style={themedStyles.sectionHeader}>
              <Text style={themedStyles.sectionTitle}>Group habits</Text>
              <TouchableOpacity style={themedStyles.iconButton} onPress={() => setShowHabitModal(true)}>
                <Ionicons name="add" size={18} color={themedStyles.iconColor} />
              </TouchableOpacity>
            </View>
            {groupHabitsForGroup.length === 0 ? (
              <Text style={themedStyles.emptyText}>No group habits yet.</Text>
            ) : (
              groupHabitsForGroup.map((habit, index) => renderHabitRow(habit, index))
            )}
          </View>
        ) : null}

        {activeTab === 'routines' ? (
          <View style={themedStyles.sectionBlock}>
            <View style={themedStyles.sectionHeader}>
              <Text style={themedStyles.sectionTitle}>Group routines</Text>
              <TouchableOpacity style={themedStyles.iconButton} onPress={() => setShowRoutineModal(true)}>
                <Ionicons name="add" size={18} color={themedStyles.iconColor} />
              </TouchableOpacity>
            </View>
            {groupRoutinesForGroup.length === 0 ? (
              <Text style={themedStyles.emptyText}>No group routines yet.</Text>
            ) : (
              groupRoutinesForGroup.map((routine) => renderRoutine(routine))
            )}
          </View>
        ) : null}
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
            .filter((f) => !memberList.some((m) => m.id === f.id))
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
      paddingBottom: spacing.xxxl,
    },
    hero: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
      paddingBottom: spacing.xxxl,
      borderBottomLeftRadius: borderRadius.xxl,
      borderBottomRightRadius: borderRadius.xxl,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    heroActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    heroIconButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    heroIconColor: '#FFFFFF',
    heroContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    heroBadge: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    heroBadgeIcon: '#FFFFFF',
    heroTitle: {
      ...typography.h2,
      color: '#FFFFFF',
    },
    heroMeta: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 4,
    },
    progressCard: {
      marginTop: -spacing.xxl,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    progressHeader: {
      marginBottom: spacing.md,
    },
    progressTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressTitle: {
      ...typography.label,
      color: baseText,
    },
    progressIcon: themeColorsParam?.primary || colors.primary,
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statTile: {
      flexBasis: '48%',
      flexGrow: 1,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: baseText,
    },
    statLabel: {
      ...typography.caption,
      color: subdued,
      marginTop: 4,
    },
    statWarm: {
      backgroundColor: '#FCEFE2',
    },
    statMint: {
      backgroundColor: '#E7FAEE',
    },
    statSky: {
      backgroundColor: '#E8F1FF',
    },
    statLilac: {
      backgroundColor: '#F2E9FF',
    },
    segmentWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColorsParam?.card || colors.card,
      borderRadius: borderRadius.full,
      padding: spacing.xs,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentButtonActive: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
    },
    segmentText: {
      ...typography.bodySmall,
      color: subdued,
      fontWeight: '600',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
    sectionCard: {
      marginBottom: spacing.md,
      marginHorizontal: spacing.lg,
    },
    sectionBlock: {
      marginHorizontal: spacing.lg,
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
    iconButton: {
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    emptyText: {
      ...typography.body,
      color: subdued,
    },
    memberName: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
    leaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: themeColorsParam?.divider || colors.divider,
    },
    rankBadge: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      marginRight: spacing.sm,
    },
    rankText: {
      ...typography.caption,
      color: subdued,
      fontWeight: '700',
    },
    leaderAvatar: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.primaryLight || colors.primaryLight,
      marginRight: spacing.md,
    },
    leaderAvatarText: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '700',
    },
    leaderText: {
      flex: 1,
    },
    leaderStats: {
      alignItems: 'flex-end',
    },
    leaderScore: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    leaderScoreText: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '700',
    },
    leaderMeta: {
      ...typography.caption,
      color: subdued,
      marginTop: 2,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    quickActionCard: {
      flexBasis: '48%',
      flexGrow: 1,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickActionIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    quickActionIconColor: themeColorsParam?.primary || colors.primary,
    quickActionLabel: {
      ...typography.bodySmall,
      color: baseText,
      fontWeight: '600',
      textAlign: 'center',
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
    habitCard: {
      backgroundColor: themeColorsParam?.card || colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      ...shadows.small,
    },
    habitHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    habitIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    habitIconColor: themeColorsParam?.primary || colors.primary,
    habitText: {
      flex: 1,
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
    habitCheck: {
      width: 28,
      height: 28,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.card || colors.card,
    },
    habitCheckActive: {
      backgroundColor: themeColorsParam?.primary || colors.primary,
      borderColor: themeColorsParam?.primary || colors.primary,
    },
    progressTrack: {
      height: 8,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.divider || colors.divider,
      marginTop: spacing.md,
    },
    progressFill: {
      height: 8,
      borderRadius: borderRadius.full,
      backgroundColor: themeColorsParam?.success || colors.success,
    },
    habitFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    habitFooterText: {
      ...typography.caption,
      color: subdued,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    smallAvatar: {
      width: 22,
      height: 22,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.primaryLight || colors.primaryLight,
      marginLeft: -4,
      borderWidth: 1,
      borderColor: themeColorsParam?.card || colors.card,
    },
    smallAvatarAlt: {
      width: 22,
      height: 22,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      marginLeft: -4,
      borderWidth: 1,
      borderColor: themeColorsParam?.card || colors.card,
    },
    smallAvatarText: {
      ...typography.caption,
      color: baseText,
      fontWeight: '700',
    },
    routineCard: {
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: themeColorsParam?.card || colors.card,
      ...shadows.small,
    },
    routineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    routineTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    routineTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
    },
    routineMeta: {
      ...typography.bodySmall,
      color: subdued,
      marginTop: 2,
    },
    routineIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.primaryLight || colors.primaryLight,
    },
    routineIconColor: themeColorsParam?.primary || colors.primary,
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
