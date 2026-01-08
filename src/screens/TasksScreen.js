import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { formatTimeFromDate } from '../utils/notifications';
import {
  Card,
  Modal,
  Button,
  Input,
  ChipGroup,
  PlatformDatePicker,
  PlatformTimePicker,
  PlatformScrollView,
} from '../components';
import {
  colors,
  borderRadius,
  spacing,
  typography,
  priorityLevels,
} from '../utils/theme';

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, idx) => {
  const h = Math.floor(idx / 2);
  const m = idx % 2 === 0 ? '00' : '30';
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${m} ${suffix}`;
});

const TasksScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    tasks,
    friends,
    notes,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    sendTaskInvite,
    fetchTaskParticipants,
    addNote,
    updateNote,
    deleteNote,
    getTodayTasks,
    getUpcomingTasks,
    verifyNotePassword,
    setNotePassword,
    todayHealth,
    updateTodayHealth,
    themeName,
    themeColors,
    ensureTasksLoaded,
    ensureNotesLoaded,
  } = useApp();
  const isDark = themeName === 'dark';
  const tasksTheme = useMemo(
    () => ({
      background: isDark ? themeColors.background : '#FBF5FF',
      actionGradient: ['#A855F7', '#EC4899'],
      actionText: '#FFFFFF',
      actionSecondaryBg: isDark ? '#2F3147' : '#FFFFFF',
      actionSecondaryBorder: isDark ? '#3E415A' : '#E9E1F5',
      actionSecondaryText: isDark ? '#F0E9FF' : '#1F2937',
      calendarBg: isDark ? '#2F3147' : '#FFFFFF',
      calendarBorder: isDark ? '#3E415A' : '#E5E7EB',
      calendarIcon: isDark ? '#E5E7EB' : themeColors.textSecondary,
      tabsBorder: isDark ? '#4B4760' : '#E7E1F5',
      tabActive: isDark ? '#C084FC' : themeColors.primary,
      tabText: isDark ? '#C9C4D8' : themeColors.textSecondary,
      tabTextActive: isDark ? '#E9D5FF' : themeColors.primary,
      filterIconBg: isDark ? '#2F2B3F' : '#FFFFFF',
      filterIconBorder: isDark ? '#3F3A53' : '#E5E7EB',
      filterIconColor: isDark ? '#C9C4D8' : themeColors.textSecondary,
      filterChipBg: isDark ? '#2F2B3F' : '#FFFFFF',
      filterChipBorder: isDark ? '#3F3A53' : '#E5E7EB',
      filterChipActiveBg: isDark ? '#5B3B76' : '#F0E7FF',
      filterChipActiveBorder: isDark ? '#7A56A0' : '#D9C7FF',
      filterChipText: isDark ? '#C9C4D8' : themeColors.textSecondary,
      filterChipTextActive: isDark ? '#F1E8FF' : themeColors.primary,
      tasksCardBg: isDark ? '#3E4158' : '#FFFFFF',
      tasksCardBorder: isDark ? '#4B4E67' : '#EFE4FF',
      tasksTitle: isDark ? '#D8B4FE' : themeColors.primary,
      taskItemBg: isDark ? '#4B3E5E' : '#F8F1FF',
      taskItemBorder: isDark ? 'rgba(192,132,252,0.4)' : '#E7D7FF',
      checkboxBg: isDark ? '#3B3452' : '#FFFFFF',
      taskDate: isDark ? '#C9C4D8' : themeColors.textSecondary,
      notesCardBg: isDark ? '#34445E' : '#FFFFFF',
      notesCardBorder: isDark ? '#435678' : '#DCEBFF',
      notesTitle: isDark ? '#7DD3FC' : themeColors.tasks,
      noteItemBg: isDark ? '#2C3E54' : '#F2F8FF',
      noteItemBorder: isDark ? 'rgba(96,165,250,0.35)' : '#D8E7FF',
      noteIconBg: '#0EA5E9',
      noteIconColor: '#FFFFFF',
      noteLockBg: isDark ? '#3C2E57' : '#EFE7FF',
      noteLockColor: isDark ? '#D8B4FE' : themeColors.primary,
      noteChevron: isDark ? '#AFAAC2' : themeColors.textLight,
      addNewBg: isDark ? '#2C3E54' : '#EEF4FF',
      addNewBorder: isDark ? '#3B4F6C' : '#DDEBFF',
      addNewText: isDark ? '#7DD3FC' : themeColors.tasks,
    }),
    [isDark, themeColors]
  );
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [activeTab, setActiveTab] = useState('All Tasks');
  const [filterType, setFilterType] = useState('Date');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [showNoteDetailModal, setShowNoteDetailModal] = useState(false);
  const [showNoteSecurityModal, setShowNoteSecurityModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showPeopleModal, setShowPeopleModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [invitedFriendIds, setInvitedFriendIds] = useState([]);
  const [invitingFriends, setInvitingFriends] = useState(false);
  const [taskPeople, setTaskPeople] = useState([]);
  const [loadingTaskPeople, setLoadingTaskPeople] = useState(false);
  const [noteToUnlock, setNoteToUnlock] = useState(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState([]);
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [noteContentDraft, setNoteContentDraft] = useState('');

  // Note security state
  const [currentNotePassword, setCurrentNotePassword] = useState('');
  const [newNotePassword, setNewNotePassword] = useState('');
  const [confirmNotePassword, setConfirmNotePassword] = useState('');
  const [securityError, setSecurityError] = useState('');

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskTime, setTaskTime] = useState('');

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const tabs = ['All Tasks', 'Today', 'Upcoming'];
  const filters = ['Date', 'Priority', 'A-Z'];
  const timeOptions = TIME_OPTIONS;

  useEffect(() => {
    ensureTasksLoaded();
    ensureNotesLoaded();
  }, [ensureNotesLoaded, ensureTasksLoaded]);

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by tab
    switch (activeTab) {
      case 'Today':
        const today = new Date().toDateString();
        filtered = filtered.filter(
          (t) => new Date(t.date).toDateString() === today
        );
        break;
      case 'Upcoming':
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        filtered = filtered.filter((t) => new Date(t.date) >= now);
        break;
      default:
        break;
    }

    // Sort by filter
    switch (filterType) {
      case 'Priority':
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        filtered.sort(
          (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
        );
        break;
      case 'A-Z':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'Date':
      default:
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
        break;
    }

    return filtered;
  }, [tasks, activeTab, filterType]);

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskPriority('medium');
    setTaskDate(new Date().toISOString().split('T')[0]);
    setTaskTime('');
    setShowDatePicker(false);
    setShowTimePicker(false);
    setTimePickerTarget(null);
    setInvitedFriendIds([]);
    setShowPeopleModal(false);
  };

  const resetNoteForm = () => {
    setNoteTitle('');
    setNoteContent('');
  };
  const resetSecurityForm = () => {
    setCurrentNotePassword('');
    setNewNotePassword('');
    setConfirmNotePassword('');
    setSecurityError('');
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    if (!taskDate || Number.isNaN(new Date(taskDate).getTime())) {
      Alert.alert('Missing date', 'Please choose a date for this task.');
      return;
    }
    if (!taskTime) {
      Alert.alert('Missing time', 'Please choose a time for this task.');
      return;
    }

    try {
      setInvitingFriends(true);
      const createdTask = await addTask({
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        date: taskDate,
        time: taskTime,
      });

      if (invitedFriendIds.length) {
        for (const toUserId of invitedFriendIds) {
          try {
            await sendTaskInvite({ task: createdTask, toUserId });
          } catch (err) {
            Alert.alert(
              'Invite failed',
              err?.message || 'Unable to invite one of your friends.'
            );
          }
        }
      }

      resetTaskForm();
      setShowTaskModal(false);
    } catch (err) {
      Alert.alert('Unable to create task', err?.message || 'Please try again.');
    } finally {
      setInvitingFriends(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadPeople = async () => {
      if (!showTaskDetailModal || !selectedTask) {
        if (active) {
          setTaskPeople([]);
          setLoadingTaskPeople(false);
        }
        return;
      }

      const baseTaskId = selectedTask.sharedTaskId || selectedTask.id;
      setLoadingTaskPeople(true);
      try {
        const people = await fetchTaskParticipants(baseTaskId);
        if (active) setTaskPeople(people || []);
      } catch (err) {
        if (active) setTaskPeople([]);
      } finally {
        if (active) setLoadingTaskPeople(false);
      }
    };

    loadPeople();
    return () => {
      active = false;
    };
  }, [fetchTaskParticipants, selectedTask, showTaskDetailModal]);

  const toggleInvitedFriend = (userId) => {
    if (!userId) return;
    setInvitedFriendIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateNote = async () => {
    if (!noteTitle.trim()) return;

    await addNote({
      title: noteTitle.trim(),
      content: noteContent,
    });

    resetNoteForm();
    setShowNoteModal(false);
  };

  const handleTaskPress = (task) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
  };

  useEffect(() => {
    const taskId = route.params?.taskId;
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      handleTaskPress(task);
    }
    navigation.setParams?.({ taskId: undefined });
  }, [route.params?.taskId, tasks, navigation]);

  const handleDeleteTask = async () => {
    if (selectedTask) {
      await deleteTask(selectedTask.id);
      setShowTaskDetailModal(false);
      setSelectedTask(null);
    }
  };

  const handleCompleteTask = async () => {
    if (selectedTask) {
      const nextCompleted = !selectedTask.completed;
      await toggleTaskCompletion(selectedTask.id);
      // Keep the modal open and reflect the new completion state immediately.
      setSelectedTask((prev) =>
        prev ? { ...prev, completed: nextCompleted } : prev
      );
    }
  };

  const handleNotePress = (note) => {
    if (note.password && !unlockedNoteIds.includes(note.id)) {
      setNoteToUnlock(note);
      setShowUnlockModal(true);
      return;
    }
    setSelectedNote(note);
    setShowNoteDetailModal(true);
    setNoteTitleDraft(note.title || '');
    setNoteContentDraft(note.content || '');
  };

  const closeNoteDetail = () => {
    setShowNoteDetailModal(false);
    setSelectedNote(null);
    setNoteTitleDraft('');
    setNoteContentDraft('');
  };

  const handleDeleteNote = () => {
    if (!selectedNote) return;
    Alert.alert(
      'Delete note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteNote(selectedNote.id);
            closeNoteDetail();
          },
        },
      ]
    );
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;
    const updates = {
      title: noteTitleDraft || 'Untitled note',
      content: noteContentDraft,
    };
    await updateNote(selectedNote.id, updates);
    setSelectedNote((prev) => (prev ? { ...prev, ...updates } : prev));
    closeNoteDetail();
  };

  const handleUnlockNote = () => {
    if (!noteToUnlock) return;
    setShowUnlockModal(false);
    setShowNoteDetailModal(true);
    setSelectedNote(noteToUnlock);
    setNoteTitleDraft(noteToUnlock.title || '');
    setNoteContentDraft(noteToUnlock.content || '');
    setUnlockedNoteIds([...unlockedNoteIds, noteToUnlock.id]);
    setNoteToUnlock(null);
  };

  const handleManageSecurity = (note) => {
    setSelectedNote(note);
    resetSecurityForm();
    setShowNoteSecurityModal(true);
  };

  useEffect(() => {
    if (selectedNote) {
      setNoteTitleDraft(selectedNote.title || '');
      setNoteContentDraft(selectedNote.content || '');
    } else {
      setNoteTitleDraft('');
      setNoteContentDraft('');
    }
  }, [selectedNote]);

  const handleSaveNotePassword = async () => {
    if (!selectedNote) return;
    setSecurityError('');

    try {
      if (selectedNote.password && !currentNotePassword) {
        setSecurityError('Enter current password to change it.');
        return;
      }
      if (!newNotePassword) {
        setSecurityError('Enter a new password.');
        return;
      }
      if (newNotePassword !== confirmNotePassword) {
        setSecurityError('New passwords do not match.');
        return;
      }

      await setNotePassword(selectedNote.id, newNotePassword, currentNotePassword);
      setShowNoteSecurityModal(false);
      setUnlockedNoteIds(unlockedNoteIds.filter((id) => id !== selectedNote.id));
    } catch (err) {
      setSecurityError(err?.message || 'Unable to update password.');
    }
  };

  const handleRemoveNotePassword = async () => {
    if (!selectedNote) return;
    setSecurityError('');
    try {
      await setNotePassword(selectedNote.id, null, currentNotePassword);
      setShowNoteSecurityModal(false);
      setUnlockedNoteIds(unlockedNoteIds.filter((id) => id !== selectedNote.id));
    } catch (err) {
      setSecurityError(err?.message || 'Unable to remove password.');
    }
  };

  useEffect(() => {
    const targetId = route.params?.noteId;
    if (!targetId) return;
    const targetNote = notes.find((n) => n.id === targetId);
    if (targetNote) {
      if (targetNote.password && !unlockedNoteIds.includes(targetNote.id)) {
        setNoteToUnlock(targetNote);
        setShowUnlockModal(true);
      } else {
        setSelectedNote(targetNote);
        setShowNoteDetailModal(true);
        setNoteTitleDraft(targetNote.title || '');
        setNoteContentDraft(targetNote.content || '');
      }
    }
    navigation.setParams?.({ noteId: undefined });
  }, [route.params?.noteId, notes, unlockedNoteIds, navigation]);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return themeColors.danger;
      case 'medium':
        return themeColors.warning;
      case 'low':
        return themeColors.textLight;
      default:
        return themeColors.textLight;
    }
  };

  const getPriorityBadgeStyles = (priority) => {
    const color = getPriorityColor(priority);
    const isLow = priority === 'low';
    return {
      backgroundColor: isLow ? (isDark ? '#3B3F52' : '#EEF1F5') : color,
      textColor: isLow ? themeColors.textSecondary : '#FFFFFF',
    };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatISODate = (date) => date.toISOString().split('T')[0];

  const handleSelectDate = (date) => {
    setTaskDate(formatISODate(date));
  };

  const openDatePicker = () => {
    setShowTimePicker(false);
    setTimePickerTarget(null);
    setShowDatePicker(true);
  };

  const openTimePicker = (target) => {
    setShowDatePicker(false);
    setTimePickerTarget(target);
    setShowTimePicker(true);
  };

  const handleSelectTime = (value) => {
    const normalized =
      value instanceof Date
        ? formatTimeFromDate(value)
        : value;

    if (timePickerTarget === 'task') {
      setTaskTime(normalized);
    }
    if (timePickerTarget === 'sleep') {
      updateTodayHealth({ sleepTime: normalized });
    }
    if (timePickerTarget === 'wake') {
      updateTodayHealth({ wakeTime: normalized });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tasksTheme.background }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        alwaysBounceVertical
        bounces
      >
        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={() => setShowTaskModal(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={tasksTheme.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionPrimaryGradient}
            >
              <Ionicons name="add" size={18} color={tasksTheme.actionText} />
              <Text style={[styles.actionPrimaryText, { color: tasksTheme.actionText }]}>
                Add Task
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionSecondary,
              {
                backgroundColor: tasksTheme.actionSecondaryBg,
                borderColor: tasksTheme.actionSecondaryBorder,
              },
            ]}
            onPress={() => setShowNoteModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={tasksTheme.actionSecondaryText}
            />
            <Text
              style={[
                styles.actionSecondaryText,
                { color: tasksTheme.actionSecondaryText },
              ]}
            >
              Create Note
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.calendarButton,
              {
                backgroundColor: tasksTheme.calendarBg,
                borderColor: tasksTheme.calendarBorder,
              },
            ]}
            onPress={() => navigation.navigate('Calendar')}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={20} color={tasksTheme.calendarIcon} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: tasksTheme.tabsBorder }]}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && [
                  styles.tabActive,
                  { borderBottomColor: tasksTheme.tabActive },
                ],
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tasksTheme.tabText },
                  activeTab === tab && [
                    styles.tabTextActive,
                    { color: tasksTheme.tabTextActive },
                  ],
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          <View
            style={[
              styles.filterIcon,
              {
                backgroundColor: tasksTheme.filterIconBg,
                borderColor: tasksTheme.filterIconBorder,
              },
            ]}
          >
            <Ionicons name="filter-outline" size={18} color={tasksTheme.filterIconColor} />
          </View>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                {
                  backgroundColor: tasksTheme.filterChipBg,
                  borderColor: tasksTheme.filterChipBorder,
                },
                filterType === filter && [
                  styles.filterChipActive,
                  {
                    backgroundColor: tasksTheme.filterChipActiveBg,
                    borderColor: tasksTheme.filterChipActiveBorder,
                  },
                ],
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: tasksTheme.filterChipText },
                  filterType === filter && [
                    styles.filterTextActive,
                    { color: tasksTheme.filterChipTextActive },
                  ],
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tasks List */}
        <Card
          style={[
            styles.sectionCard,
            styles.tasksCard,
            {
              backgroundColor: tasksTheme.tasksCardBg,
              borderColor: tasksTheme.tasksCardBorder,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: tasksTheme.tasksTitle }]}>Tasks</Text>
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={tasksTheme.tasksTitle}
              />
              <Text style={styles.emptyTitle}>No tasks yet</Text>
              <Text style={styles.emptySubtitle}>
                Create your first task to get started
              </Text>
            </View>
          ) : (
            filteredTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[
                  styles.taskItem,
                  {
                    backgroundColor: tasksTheme.taskItemBg,
                    borderColor: tasksTheme.taskItemBorder,
                  },
                ]}
                onPress={() => handleTaskPress(task)}
                activeOpacity={0.7}
              >
                <TouchableOpacity
                  style={[
                    styles.checkbox,
                    {
                      borderColor: tasksTheme.taskItemBorder,
                      backgroundColor: tasksTheme.checkboxBg,
                    },
                    task.completed && styles.checkboxChecked,
                  ]}
                  onPress={() => toggleTaskCompletion(task.id)}
                >
                  {task.completed && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
                <View style={styles.taskContent}>
                  <Text
                    style={[
                      styles.taskTitle,
                      task.completed && styles.taskTitleCompleted,
                    ]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                  <View style={styles.taskMeta}>
                    {(() => {
                      const badge = getPriorityBadgeStyles(task.priority);
                      return (
                        <View
                          style={[
                            styles.priorityBadge,
                            { backgroundColor: badge.backgroundColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.priorityText,
                              { color: badge.textColor },
                            ]}
                          >
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </Text>
                        </View>
                      );
                    })()}
                    <Text style={[styles.taskDate, { color: tasksTheme.taskDate }]}>
                      {formatDate(task.date)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Notes Section */}
        <Card
          style={[
            styles.sectionCard,
            styles.notesCard,
            {
              backgroundColor: tasksTheme.notesCardBg,
              borderColor: tasksTheme.notesCardBorder,
            },
          ]}
        >
          <View style={styles.notesHeader}>
            <Text style={[styles.sectionTitle, { color: tasksTheme.notesTitle }]}>Notes</Text>
            <TouchableOpacity
              style={[
                styles.addNewButton,
                {
                  backgroundColor: tasksTheme.addNewBg,
                  borderColor: tasksTheme.addNewBorder,
                },
              ]}
            onPress={() => setShowNoteModal(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.addNewText, { color: tasksTheme.addNewText }]}>Add new</Text>
          </TouchableOpacity>
        </View>

          {notes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={tasksTheme.notesTitle} />
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>Create a note to get started</Text>
              <Button
                title="Create Note"
                variant="secondary"
                icon="document-text-outline"
                onPress={() => setShowNoteModal(true)}
                style={styles.createNoteEmptyButton}
              />
            </View>
          ) : (
            notes.map((note) => (
              <View key={note.id} style={styles.noteRow}>
                <TouchableOpacity
                  style={[
                    styles.noteItem,
                    {
                      backgroundColor: tasksTheme.noteItemBg,
                      borderColor: tasksTheme.noteItemBorder,
                    },
                  ]}
                  onPress={() => handleNotePress(note)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.noteIcon,
                      { backgroundColor: tasksTheme.noteIconBg },
                    ]}
                  >
                    <Feather name="file-text" size={18} color={tasksTheme.noteIconColor} />
                  </View>
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle} numberOfLines={1}>
                      {note.title}
                    </Text>
                    {note.password && (
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={12} color={tasksTheme.noteLockColor} />
                        <Text style={[styles.lockBadgeText, { color: tasksTheme.noteLockColor }]}>
                          Locked
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={tasksTheme.noteChevron}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.lockButton,
                    { backgroundColor: tasksTheme.noteLockBg, borderColor: tasksTheme.noteItemBorder },
                  ]}
                  onPress={() => handleManageSecurity(note)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={note.password ? 'lock-closed' : 'lock-open'}
                    size={18}
                    color={note.password ? tasksTheme.noteLockColor : themeColors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>
      </PlatformScrollView>

        {/* Add Task Modal */}
        <Modal
          visible={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            resetTaskForm();
          }}
          title={showPeopleModal ? 'People' : 'New Task'}
          fullScreen
        >
        {showPeopleModal ? (
          <PlatformScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
            <Text style={styles.peopleModalHint}>
              Select friends to invite. Invites are sent when you create the task.
            </Text>

            {friends.length === 0 ? (
              <View style={styles.peopleEmpty}>
                <Ionicons name="people-outline" size={22} color={themeColors.textSecondary} />
                <Text style={styles.peopleEmptyText}>No friends yet.</Text>
              </View>
            ) : (
              <Card style={styles.peopleCard}>
                {friends.map((friend) => {
                  const invited = invitedFriendIds.includes(friend.id);
                  return (
                    <View key={friend.id} style={styles.peopleRow}>
                      <View style={styles.peopleRowText}>
                        <Text style={styles.peopleName} numberOfLines={1}>
                          {friend.name || friend.username || 'Friend'}
                        </Text>
                        <Text style={styles.peopleUsername} numberOfLines={1}>
                          {friend.username ? `@${friend.username}` : ''}
                        </Text>
                      </View>
                      <Button
                        title={invited ? 'Invited' : 'Invite'}
                        variant={invited ? 'outline' : 'primary'}
                        size="small"
                        fullWidth={false}
                        disableTranslation
                        onPress={() => toggleInvitedFriend(friend.id)}
                      />
                    </View>
                  );
                })}
              </Card>
            )}

            <View style={styles.modalButtons}>
              <Button
                title="Back"
                variant="secondary"
                onPress={() => setShowPeopleModal(false)}
                disableTranslation
                style={styles.modalButton}
              />
              <Button
                title="Done"
                onPress={() => setShowPeopleModal(false)}
                disableTranslation
                style={styles.modalButton}
              />
            </View>
          </PlatformScrollView>
        ) : (
          <PlatformScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
            <Input
              label="Task Title"
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="e.g., Complete project proposal"
            />

            <Input
              label="Description (Optional)"
              value={taskDescription}
              onChangeText={setTaskDescription}
              placeholder="Add more details..."
              multiline
              numberOfLines={3}
            />

            <View style={styles.peopleButtonRow}>
              <Button
                title={
                  invitedFriendIds.length ? `People (${invitedFriendIds.length})` : 'People'
                }
                variant="secondary"
                icon="people-outline"
                fullWidth={false}
                disableTranslation
                onPress={() => setShowPeopleModal(true)}
              />
              <Text style={styles.peopleHintText}>
                Invites are sent when you create the task.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {priorityLevels.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.priorityOption,
                    taskPriority === level.value && styles.priorityOptionActive,
                    taskPriority === level.value && {
                      backgroundColor: level.color,
                    },
                  ]}
                  onPress={() => setTaskPriority(level.value)}
                >
                  <Text
                    style={[
                      styles.priorityOptionText,
                      taskPriority === level.value && styles.priorityOptionTextActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dateTimeRow}>
              <View style={styles.dateInput}>
                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={openDatePicker}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dateButtonText}>{formatDate(taskDate)}</Text>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={themeColors.textLight}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>Time</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => openTimePicker('task')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dateButtonText,
                      !taskTime && styles.placeholderText,
                    ]}
                  >
                    {taskTime || 'Select time'}
                  </Text>
                  <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                </TouchableOpacity>
              </View>
            </View>

            <PlatformDatePicker
              visible={showDatePicker}
              value={taskDate}
              onChange={handleSelectDate}
              onClose={() => setShowDatePicker(false)}
              accentColor={themeColors.tasks}
            />

            <PlatformTimePicker
              visible={showTimePicker}
              value={
                timePickerTarget === 'task'
                  ? taskTime
                  : timePickerTarget === 'sleep'
                  ? todayHealth?.sleepTime
                  : timePickerTarget === 'wake'
                  ? todayHealth?.wakeTime
                  : ''
              }
              onChange={handleSelectTime}
              onClose={() => {
                setShowTimePicker(false);
                setTimePickerTarget(null);
              }}
              options={timeOptions}
              accentColor={themeColors.tasks}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowTaskModal(false);
                  resetTaskForm();
                }}
                style={styles.modalButton}
              />
              <Button
                title="Create Task"
                onPress={handleCreateTask}
                disabled={!taskTitle.trim() || !taskTime || invitingFriends}
                loading={invitingFriends}
                style={styles.modalButton}
              />
            </View>
          </PlatformScrollView>
        )}
        </Modal>

      {/* Quick Note Modal */}
      <Modal
        visible={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
          resetNoteForm();
        }}
        title="New Note"
        fullScreen
      >
        <View style={styles.noteForm}>
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setShowNoteModal(false);
                resetNoteForm();
              }}
              style={styles.modalButton}
            />
            <Button
              title="Create"
              onPress={handleCreateNote}
              disabled={!noteTitle.trim()}
              style={styles.modalButton}
            />
          </View>

          <Input
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder="Title"
            style={styles.noteFieldContainer}
            inputStyle={styles.noteFieldInput}
            containerStyle={styles.noteFieldWrapper}
          />

          <Input
            value={noteContent}
            onChangeText={setNoteContent}
            placeholder="Start writing..."
            multiline
            numberOfLines={16}
            style={styles.noteFieldContainer}
            inputStyle={[styles.noteContentInput, styles.noteFieldInput]}
            containerStyle={styles.noteContentWrapper}
          />
        </View>
        </Modal>

        {/* Task Detail Modal */}
        <Modal
          visible={showTaskDetailModal}
          onClose={() => {
            setShowTaskDetailModal(false);
            setSelectedTask(null);
          }}
          title="Task Details"
          fullScreen
        >
        {selectedTask && (
          <>
            <Text style={styles.detailTitle}>{selectedTask.title}</Text>
            {(() => {
              const badge = getPriorityBadgeStyles(selectedTask.priority);
              return (
                <View
                  style={[
                    styles.priorityBadgeLarge,
                    { backgroundColor: badge.backgroundColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityTextLarge,
                      { color: badge.textColor },
                    ]}
                  >
                {selectedTask.priority.charAt(0).toUpperCase() +
                  selectedTask.priority.slice(1)}{' '}
                Priority
                  </Text>
                </View>
              );
            })()}

            {selectedTask.description && (
              <>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailDescription}>
                  {selectedTask.description}
                </Text>
              </>
            )}

            <Text style={styles.detailLabel}>People</Text>
            {loadingTaskPeople ? (
              <Text style={styles.peopleLoadingText}>Loading…</Text>
            ) : taskPeople.length ? (
              <View style={styles.peoplePills}>
                {taskPeople.map((p) => (
                  <View key={p.id} style={styles.peoplePill}>
                    <Text style={styles.peoplePillText}>
                      {p.name || (p.username ? `@${p.username}` : 'User')}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.peopleLoadingText}>Just you</Text>
            )}

            <View style={styles.scheduleBox}>
              <Ionicons name="calendar" size={20} color={themeColors.info} />
              <View style={styles.scheduleContent}>
                <Text style={styles.scheduleLabel}>Scheduled</Text>
                <Text style={styles.scheduleValue}>
                  {formatDate(selectedTask.date)}
                  {selectedTask.time && ` at ${selectedTask.time}`}
                </Text>
              </View>
            </View>

            <View style={styles.detailButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowTaskDetailModal(false);
                  setSelectedTask(null);
                }}
                style={styles.detailButton}
              />
              <Button
                title="Delete"
                variant="danger"
                icon="trash-outline"
                onPress={handleDeleteTask}
                style={styles.detailButton}
              />
            </View>

            <Button
              title={selectedTask.completed ? 'Mark Uncomplete' : 'Mark Complete'}
              variant={selectedTask.completed ? 'danger' : 'success'}
              icon={selectedTask.completed ? 'close' : 'checkmark'}
              onPress={handleCompleteTask}
              style={styles.completeButton}
            />
          </>
        )}
        </Modal>

        {/* Note Detail Modal */}
        <Modal
          visible={showNoteDetailModal}
          onClose={closeNoteDetail}
          title=""
          fullScreen
          showCloseButton={false}
        >
        {selectedNote && (
          <View style={styles.noteDetailContainer}>
            <View style={styles.noteDetailHeader}>
              <TouchableOpacity onPress={closeNoteDetail} style={styles.noteHeaderButton}>
                <Text style={styles.noteHeaderButtonText}>Cancel</Text>
              </TouchableOpacity>
              <View style={styles.noteHeaderActions}>
                <TouchableOpacity
                  onPress={handleDeleteNote}
                  style={[styles.noteHeaderButton, styles.noteDeleteButton]}
                >
                  <Text style={styles.noteDeleteText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveNote}
                  style={[styles.noteHeaderButton, styles.noteDoneButton]}
                >
                  <Text style={styles.noteDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.noteEditBody}>
              <TextInput
                value={noteTitleDraft}
                onChangeText={setNoteTitleDraft}
                placeholder="Title"
                placeholderTextColor={themeColors.textSecondary}
                style={styles.noteEditTitle}
              />
              <TextInput
                value={noteContentDraft}
                onChangeText={setNoteContentDraft}
                placeholder="Start writing..."
                placeholderTextColor={themeColors.textSecondary}
                style={styles.noteEditContent}
                multiline
                autoFocus
                textAlignVertical="top"
              />
            </View>
          </View>
        )}
        </Modal>

        {/* Note Security Modal */}
        <Modal
          visible={showNoteSecurityModal}
          onClose={() => {
            setShowNoteSecurityModal(false);
            resetSecurityForm();
          }}
          title="Note Security"
          fullScreen
        >
        {selectedNote && (
          <>
            <Text style={styles.inputLabel}>Note</Text>
            <Text style={styles.detailTitle}>{selectedNote.title}</Text>
            <View style={styles.securitySection}>
              {selectedNote.password && (
                <Input
                  label="Current Password"
                  value={currentNotePassword}
                  onChangeText={setCurrentNotePassword}
                  secureTextEntry
                  placeholder="Enter current password"
                />
              )}
              <Input
                label="New Password"
                value={newNotePassword}
                onChangeText={setNewNotePassword}
                secureTextEntry
                placeholder="Enter new password"
              />
              <Input
                label="Confirm New Password"
                value={confirmNotePassword}
                onChangeText={setConfirmNotePassword}
                secureTextEntry
                placeholder="Re-enter new password"
              />
              {securityError ? (
                <Text style={styles.errorText}>{securityError}</Text>
              ) : null}
              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setShowNoteSecurityModal(false);
                    resetSecurityForm();
                  }}
                  style={styles.modalButton}
                />
                <Button
                  title="Save Password"
                  onPress={handleSaveNotePassword}
                  style={styles.modalButton}
                />
              </View>
              {selectedNote.password && (
                <Button
                  title="Remove Password"
                  variant="outline"
                  onPress={handleRemoveNotePassword}
                />
              )}
            </View>
          </>
        )}
        </Modal>

        {/* Unlock Modal */}
        <Modal
          visible={showUnlockModal}
          onClose={() => {
            setShowUnlockModal(false);
            setNoteToUnlock(null);
            setCurrentNotePassword('');
            setSecurityError('');
          }}
          title="Unlock Note"
        >
        {noteToUnlock && (
          <>
            <Text style={styles.detailTitle}>{noteToUnlock.title}</Text>
            <Input
              label="Password"
              value={currentNotePassword}
              onChangeText={setCurrentNotePassword}
              secureTextEntry
              placeholder="Enter password"
            />
            {securityError ? (
              <Text style={styles.errorText}>{securityError}</Text>
            ) : null}
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowUnlockModal(false);
                  setNoteToUnlock(null);
                  setCurrentNotePassword('');
                  setSecurityError('');
                }}
                style={styles.modalButton}
              />
              <Button
                title="Unlock"
                onPress={() => {
                  if (!verifyNotePassword(noteToUnlock.id, currentNotePassword)) {
                    setSecurityError('Incorrect password.');
                    return;
                  }
                  setSecurityError('');
                  handleUnlockNote();
                  setCurrentNotePassword('');
                }}
                style={styles.modalButton}
              />
            </View>
          </>
        )}
        </Modal>

      </View>
  );
};

const createStyles = (themeColors) => {
  const backgroundColor = (themeColors && themeColors.background) || colors.background;
  const textColor = (themeColors && themeColors.text) || colors.text;

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
    flexGrow: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  actionPrimary: {
    flex: 1,
    minWidth: 140,
    height: 48,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionPrimaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  actionPrimaryText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  actionSecondary: {
    flex: 1,
    minWidth: 140,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  actionSecondaryText: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  calendarButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
  },
  tab: {
    marginRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    ...typography.body,
  },
  tabTextActive: {
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  filterIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterChipActive: {
    borderWidth: 1,
  },
  filterText: {
    ...typography.bodySmall,
  },
  filterTextActive: {
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tasksCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  linkText: {
    ...typography.bodySmall,
    color: themeColors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: themeColors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: themeColors.textLight,
    marginTop: spacing.xs,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: themeColors.success,
    borderColor: themeColors.success,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    ...typography.body,
    marginBottom: spacing.xs,
    color: themeColors.text,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: themeColors.textLight,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskDate: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  notesCard: {
    marginBottom: spacing.xxxl,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    flex: 1,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitle: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
  },
  noteInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  lockBadgeText: {
    ...typography.caption,
    marginLeft: spacing.xs,
  },
  createNoteEmptyButton: {
    marginTop: spacing.lg,
  },
  lockButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: themeColors.border,
    marginLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteForm: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: spacing.xl,
    backgroundColor,
    borderColor: backgroundColor,
    borderWidth: 1,
  },
  noteFieldWrapper: {
    marginBottom: spacing.xs,
  },
  noteContentWrapper: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  noteFieldContainer: {
    backgroundColor,
    borderWidth: 0,
    borderColor: backgroundColor,
    paddingHorizontal: 0,
  },
  noteFieldInput: {
    paddingVertical: spacing.md,
    color: textColor,
  },
  addNewButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  addNewText: {
    ...typography.body,
    fontWeight: '700',
  },
  inputLabel: {
    ...typography.label,
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.inputBackground,
    marginHorizontal: spacing.xs,
  },
  priorityOptionActive: {
    borderWidth: 0,
  },
  priorityOptionText: {
    ...typography.body,
    fontWeight: '500',
    color: themeColors.textSecondary,
  },
  priorityOptionTextActive: {
    color: themeColors.text,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dateTimeRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  dateInput: {
    flex: 1,
    marginRight: spacing.md,
  },
  timeInput: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
  },
  dateButtonText: {
    ...typography.body,
    color: themeColors.text,
  },
  placeholderText: {
    color: themeColors.placeholder,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  detailTitle: {
    ...typography.h2,
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  priorityBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  priorityTextLarge: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailLabel: {
    ...typography.caption,
    color: themeColors.textLight,
    marginBottom: spacing.xs,
  },
  detailDescription: {
    ...typography.body,
    color: themeColors.text,
    marginBottom: spacing.lg,
  },
  peopleLoadingText: {
    ...typography.body,
    color: themeColors.textLight,
    marginBottom: spacing.lg,
  },
  peoplePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  peoplePill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
  },
  peoplePillText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: themeColors.text,
  },
  peopleButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  peopleHintText: {
    ...typography.caption,
    color: themeColors.textLight,
    flex: 1,
  },
  peopleModalHint: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginBottom: spacing.md,
  },
  peopleEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  peopleEmptyText: {
    ...typography.body,
    color: themeColors.textLight,
    marginTop: spacing.sm,
  },
  peopleCard: {
    marginTop: spacing.sm,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  peopleRowText: {
    flex: 1,
    marginRight: spacing.md,
  },
  peopleName: {
    ...typography.body,
    fontWeight: '700',
    color: themeColors.text,
  },
  peopleUsername: {
    ...typography.bodySmall,
    color: themeColors.textLight,
  },
  scheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.inputBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  scheduleContent: {
    marginLeft: spacing.md,
  },
  scheduleLabel: {
    ...typography.caption,
    color: themeColors.textLight,
  },
  scheduleValue: {
    ...typography.body,
    fontWeight: '500',
    color: themeColors.text,
  },
  detailButtons: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  detailButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  completeButton: {
    marginBottom: spacing.lg,
  },
  noteContentText: {
    ...typography.body,
    color: themeColors.text,
    marginVertical: spacing.lg,
    lineHeight: 24,
  },
  noteContentInput: {
    minHeight: 240,
    textAlignVertical: 'top',
  },
  noteDetailContainer: {
    flex: 1,
  },
  noteDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  noteHeaderButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  noteHeaderButtonText: {
    ...typography.body,
    color: themeColors.text,
    fontWeight: '600',
  },
  noteHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteDeleteButton: {
    marginRight: spacing.sm,
  },
  noteDoneButton: {
    backgroundColor: themeColors.primary,
    borderRadius: borderRadius.md,
  },
  noteDeleteText: {
    ...typography.body,
    color: themeColors.danger,
    fontWeight: '600',
  },
  noteDoneText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  noteEditBody: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  noteEditTitle: {
    ...typography.h2,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
  noteEditContent: {
    ...typography.body,
    color: themeColors.text,
    flex: 1,
    padding: spacing.md,
    backgroundColor: themeColors.inputBackground,
    borderRadius: borderRadius.md,
    minHeight: 260,
    lineHeight: 22,
  },
  securitySection: {
    marginTop: spacing.md,
  },
  errorText: {
    color: themeColors.danger,
    marginBottom: spacing.sm,
  },
});
};

export default TasksScreen;
