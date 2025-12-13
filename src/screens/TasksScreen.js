import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, ChipGroup } from '../components';
import {
  colors,
  shadows,
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
  const {
    tasks,
    notes,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    addNote,
    deleteNote,
    getTodayTasks,
    getUpcomingTasks,
    verifyNotePassword,
    setNotePassword,
    themeColors,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [activeTab, setActiveTab] = useState('All Tasks');
  const [filterType, setFilterType] = useState('Date');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [showNoteDetailModal, setShowNoteDetailModal] = useState(false);
  const [showNoteSecurityModal, setShowNoteSecurityModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteToUnlock, setNoteToUnlock] = useState(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState([]);

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
    setDatePickerMonth(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setTimePickerTarget(null);
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

    await addTask({
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      priority: taskPriority,
      date: taskDate,
      time: taskTime,
    });

    resetTaskForm();
    setShowTaskModal(false);
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

  const handleDeleteTask = async () => {
    if (selectedTask) {
      await deleteTask(selectedTask.id);
      setShowTaskDetailModal(false);
      setSelectedTask(null);
    }
  };

  const handleCompleteTask = async () => {
    if (selectedTask) {
      await toggleTaskCompletion(selectedTask.id);
      setShowTaskDetailModal(false);
      setSelectedTask(null);
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
  };

  const handleDeleteNote = async () => {
    if (selectedNote) {
      await deleteNote(selectedNote.id);
      setShowNoteDetailModal(false);
      setSelectedNote(null);
    }
  };

  const handleUnlockNote = () => {
    if (!noteToUnlock) return;
    setShowUnlockModal(false);
    setShowNoteDetailModal(true);
    setSelectedNote(noteToUnlock);
    setUnlockedNoteIds([...unlockedNoteIds, noteToUnlock.id]);
    setNoteToUnlock(null);
  };

  const handleManageSecurity = (note) => {
    setSelectedNote(note);
    resetSecurityForm();
    setShowNoteSecurityModal(true);
  };

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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return colors.danger;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.textLight;
      default:
        return colors.textLight;
    }
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

  const getMonthMatrix = (monthDate) => {
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const startDay = start.getDay();
    const daysInMonth = end.getDate();
    const days = [];

    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
    }
    while (days.length % 7 !== 0) days.push(null);

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  const monthMatrix = useMemo(() => getMonthMatrix(datePickerMonth), [datePickerMonth]);

  const handleSelectDate = (date) => {
    setTaskDate(formatISODate(date));
    setShowDatePicker(false);
  };

  const openDatePicker = () => {
    setShowTimePicker(false);
    setTimePickerTarget(null);
    const base = taskDate ? new Date(taskDate) : new Date();
    setDatePickerMonth(base);
    setShowDatePicker(true);
  };

  const openTimePicker = (target) => {
    setShowDatePicker(false);
    setTimePickerTarget(target);
    setShowTimePicker(true);
  };

  const handleSelectTime = (value) => {
    if (timePickerTarget === 'task') {
      setTaskTime(value);
    }
    if (timePickerTarget === 'sleep') {
      updateTodayHealth({ sleepTime: value });
    }
    if (timePickerTarget === 'wake') {
      updateTodayHealth({ wakeTime: value });
    }
    setShowTimePicker(false);
    setTimePickerTarget(null);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            title="Add Task"
            icon="add"
            onPress={() => setShowTaskModal(true)}
            style={styles.addTaskButton}
          />
          <Button
            title="Create Note"
            variant="secondary"
            icon="document-text-outline"
            onPress={() => setShowNoteModal(true)}
            style={styles.addNoteButton}
          />
          <TouchableOpacity
            style={styles.calendarButton}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          <Ionicons name="filter-outline" size={18} color={colors.textLight} />
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                filterType === filter && styles.filterChipActive,
              ]}
              onPress={() => setFilterType(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterType === filter && styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tasks List */}
        <Card style={styles.tasksCard}>
          <Text style={styles.sectionTitle}>Tasks</Text>
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={colors.primaryLight}
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
                style={styles.taskItem}
                onPress={() => handleTaskPress(task)}
                activeOpacity={0.7}
              >
                <TouchableOpacity
                  style={[
                    styles.checkbox,
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
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: `${getPriorityColor(task.priority)}20` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityText,
                          { color: getPriorityColor(task.priority) },
                        ]}
                      >
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.taskDate}>{formatDate(task.date)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Notes Section */}
        <Card style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TouchableOpacity
              style={styles.addNewButton}
              onPress={() => setShowNoteModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addNewText}>Add new</Text>
            </TouchableOpacity>
          </View>

          {notes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.primaryLight} />
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
                  style={styles.noteItem}
                  onPress={() => handleNotePress(note)}
                  activeOpacity={0.7}
                >
                  <Feather name="file-text" size={18} color={colors.tasks} />
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle} numberOfLines={1}>
                      {note.title}
                    </Text>
                    {note.password && (
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={12} color={colors.primary} />
                        <Text style={styles.lockBadgeText}>Locked</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.lockButton}
                  onPress={() => handleManageSecurity(note)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={note.password ? 'lock-closed' : 'lock-open'}
                    size={18}
                    color={note.password ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>
        </ScrollView>

        {/* Add Task Modal */}
        <Modal
          visible={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            resetTaskForm();
          }}
          title="New Task"
          fullScreen
        >
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
                color={colors.textLight}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.timeInput}>
            <Text style={styles.inputLabel}>Time (Optional)</Text>
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
                {taskTime || '--:--'}
              </Text>
              <Ionicons name="time-outline" size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <View style={styles.inlinePicker}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.calendarNav}
                onPress={() =>
                  setDatePickerMonth((prev) => {
                    const next = new Date(prev);
                    next.setMonth(prev.getMonth() - 1);
                    return next;
                  })
                }
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>
                {datePickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                style={styles.calendarNav}
                onPress={() =>
                  setDatePickerMonth((prev) => {
                    const next = new Date(prev);
                    next.setMonth(prev.getMonth() + 1);
                    return next;
                  })
                }
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekDays}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <Text key={`${day}-${idx}`} style={styles.weekDayLabel}>
                  {day}
                </Text>
              ))}
            </View>
            {monthMatrix.map((week, idx) => (
              <View key={idx} style={styles.weekRow}>
                {week.map((day, dayIdx) => {
                  const isSelected =
                    day && formatISODate(day) === formatISODate(new Date(taskDate));
                  return (
                    <TouchableOpacity
                      key={dayIdx}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        !day && styles.dayCellEmpty,
                      ]}
                      disabled={!day}
                      onPress={() => day && handleSelectDate(day)}
                      activeOpacity={day ? 0.8 : 1}
                    >
                      {day && (
                        <Text
                          style={[
                            styles.dayLabel,
                            isSelected && styles.dayLabelSelected,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <Button
              title="Close"
              variant="secondary"
              onPress={() => setShowDatePicker(false)}
              style={styles.pickerCloseButton}
            />
          </View>
        )}

        {showTimePicker && (
          <View style={styles.inlinePicker}>
            <Text style={styles.pickerTitle}>Select Time</Text>
            <ScrollView contentContainerStyle={styles.timeList} style={{ maxHeight: 260 }}>
              {timeOptions.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={styles.timeOption}
                  onPress={() => handleSelectTime(time)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.timeOptionText}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Close"
              variant="secondary"
              onPress={() => setShowTimePicker(false)}
              style={styles.pickerCloseButton}
            />
          </View>
        )}

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
            disabled={!taskTitle.trim()}
            style={styles.modalButton}
          />
        </View>
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
            <View
              style={[
                styles.priorityBadgeLarge,
                {
                  backgroundColor: `${getPriorityColor(selectedTask.priority)}20`,
                },
              ]}
            >
              <Text
                style={[
                  styles.priorityTextLarge,
                  { color: getPriorityColor(selectedTask.priority) },
                ]}
              >
                {selectedTask.priority.charAt(0).toUpperCase() +
                  selectedTask.priority.slice(1)}{' '}
                Priority
              </Text>
            </View>

            {selectedTask.description && (
              <>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailDescription}>
                  {selectedTask.description}
                </Text>
              </>
            )}

            <View style={styles.scheduleBox}>
              <Ionicons name="calendar" size={20} color={colors.info} />
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
              title="Mark Complete"
              variant="success"
              icon="checkmark"
              onPress={handleCompleteTask}
              style={styles.completeButton}
            />
          </>
        )}
        </Modal>

        {/* Note Detail Modal */}
        <Modal
          visible={showNoteDetailModal}
          onClose={() => {
            setShowNoteDetailModal(false);
            setSelectedNote(null);
          }}
          title="Note"
          fullScreen
        >
        {selectedNote && (
          <>
            <Text style={styles.detailTitle}>{selectedNote.title}</Text>
            <Text style={styles.noteContentText}>{selectedNote.content}</Text>

            <View style={styles.modalButtons}>
              <Button
                title="Close"
                variant="secondary"
                onPress={() => {
                  setShowNoteDetailModal(false);
                  setSelectedNote(null);
                }}
                style={styles.modalButton}
              />
              <Button
                title="Delete"
                variant="danger"
                icon="trash-outline"
                onPress={handleDeleteNote}
                style={styles.modalButton}
              />
            </View>
          </>
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
    </TouchableWithoutFeedback>
  );
};

const createStyles = (themeColors) => {
  const backgroundColor = (themeColors && themeColors.background) || colors.background;
  const textColor = (themeColors && themeColors.text) || colors.text;

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  addTaskButton: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    marginRight: spacing.sm,
  },
  addNoteButton: {
    flex: 1,
    marginLeft: 0,
    paddingHorizontal: spacing.xl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  calendarButton: {
    width: 48,
    height: 48,
    marginLeft: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  tab: {
    marginRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.inputBackground,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: '600',
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
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textLight,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskDate: {
    ...typography.caption,
  },
  notesCard: {
    marginBottom: spacing.xxxl,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flex: 1,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  noteTitle: {
    flex: 1,
    ...typography.body,
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
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  createNoteEmptyButton: {
    marginTop: spacing.lg,
  },
  lockButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.inputBackground,
    marginLeft: spacing.sm,
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
    backgroundColor: colors.inputBackground,
  },
  addNewText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  inputLabel: {
    ...typography.label,
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
    backgroundColor: colors.inputBackground,
    marginHorizontal: spacing.xs,
  },
  priorityOptionActive: {
    borderWidth: 0,
  },
  priorityOptionText: {
    ...typography.body,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  priorityOptionTextActive: {
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  dateButtonText: {
    ...typography.body,
  },
  placeholderText: {
    color: colors.placeholder,
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
    marginBottom: spacing.sm,
  },
  priorityBadgeLarge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
  },
  priorityTextLarge: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  detailDescription: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  scheduleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  scheduleContent: {
    marginLeft: spacing.md,
  },
  scheduleLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  scheduleValue: {
    ...typography.body,
    fontWeight: '500',
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
    marginVertical: spacing.lg,
    lineHeight: 24,
  },
  noteContentInput: {
    minHeight: 240,
    textAlignVertical: 'top',
  },
  securitySection: {
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  calendarTitle: {
    ...typography.h3,
  },
  calendarNav: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.inputBackground,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekDayLabel: {
    ...typography.caption,
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayCell: {
    width: `${100 / 7 - 2}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
  },
  dayCellEmpty: {
    backgroundColor: 'transparent',
  },
  dayCellSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayLabel: {
    ...typography.body,
    color: colors.text,
  },
  dayLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  timeList: {
    paddingBottom: spacing.xxxl,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  timeOptionText: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  inlinePicker: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    ...shadows.small,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerSheet: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '75%',
    width: '90%',
    alignItems: 'stretch',
  },
  centerSheet: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '75%',
    width: '90%',
    alignItems: 'stretch',
  },
  pickerTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  pickerCloseButton: {
    marginTop: spacing.md,
  },
});
};

export default TasksScreen;
