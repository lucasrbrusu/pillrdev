import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, PlatformScrollView } from '../components';
import { borderRadius, spacing, typography } from '../utils/theme';

const RoutineDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    routines,
    groupRoutines,
    groups,
    addTaskToRoutine,
    addTaskToGroupRoutine,
    removeTaskFromRoutine,
    removeTaskFromGroupRoutine,
    reorderRoutineTasks,
    reorderGroupRoutineTasks,
    deleteRoutine,
    deleteGroupRoutine,
    themeName,
    themeColors,
  } = useApp();
  const { routineId, isGroup } = route.params || {};
  const isDark = themeName === 'dark';

  const routine = useMemo(() => {
    if (!routineId) return null;
    return isGroup
      ? groupRoutines.find((item) => item.id === routineId)
      : routines.find((item) => item.id === routineId);
  }, [groupRoutines, isGroup, routineId, routines]);

  const groupName = useMemo(() => {
    if (!isGroup || !routine?.groupId) return null;
    const match = (groups || []).find((group) => group.id === routine.groupId);
    return match?.name || 'Group';
  }, [groups, isGroup, routine?.groupId]);

  const detailTheme = useMemo(() => {
    if (isGroup) {
      return isDark
        ? {
            card: '#232447',
            header: '#2E2B56',
            border: '#3C3B69',
            accent: themeColors.tasks,
            actionBg: '#2E2B56',
            actionText: '#DDE1FF',
            itemBg: '#303158',
            itemBorder: 'rgba(99, 102, 241, 0.45)',
            muted: '#C8CEFF',
          }
        : {
            card: '#EEF0FF',
            header: '#DDE2FF',
            border: '#C9D1FF',
            accent: themeColors.tasks,
            actionBg: '#E4E8FF',
            actionText: themeColors.tasks,
            itemBg: '#FFFFFF',
            itemBorder: '#D5DBFF',
            muted: '#5157B7',
          };
    }
    return isDark
      ? {
          card: '#2E2538',
          header: '#3C2E4A',
          border: '#4B3A5E',
          accent: themeColors.routine,
          actionBg: '#4A3560',
          actionText: '#F4E5FF',
          itemBg: '#3C304A',
          itemBorder: 'rgba(245, 158, 11, 0.45)',
          muted: '#E2C48C',
        }
      : {
          card: '#FFF4E3',
          header: '#FFE8C6',
          border: '#F6D7A7',
          accent: themeColors.routine,
          actionBg: '#EFE5FF',
          actionText: themeColors.primary,
          itemBg: '#FFFDF7',
          itemBorder: '#F3D5A2',
          muted: '#8B6F45',
        };
  }, [isDark, isGroup, themeColors]);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskName, setTaskName] = useState('');

  const handleAddTask = async () => {
    if (!taskName.trim() || !routine) return;
    if (isGroup) {
      await addTaskToGroupRoutine(routine.id, { name: taskName.trim() });
    } else {
      await addTaskToRoutine(routine.id, { name: taskName.trim() });
    }
    setTaskName('');
    setShowTaskModal(false);
  };

  const handleDeleteRoutine = () => {
    if (!routine) return;
    Alert.alert(
      'Delete routine',
      'Are you sure you want to delete this routine and all tasks?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isGroup) {
              await deleteGroupRoutine(routine.id);
            } else {
              await deleteRoutine(routine.id);
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleMoveTask = (index, direction) => {
    if (!routine?.tasks?.length) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= routine.tasks.length) return;
    const newOrder = [...routine.tasks];
    const [item] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, item);
    if (isGroup) {
      reorderGroupRoutineTasks(routine.id, newOrder);
    } else {
      reorderRoutineTasks(routine.id, newOrder);
    }
  };

  const handleRemoveTask = (taskId) => {
    if (!routine || !taskId) return;
    if (isGroup) {
      removeTaskFromGroupRoutine(routine.id, taskId);
    } else {
      removeTaskFromRoutine(routine.id, taskId);
    }
  };

  const formattedDate = routine?.createdAt
    ? new Date(routine.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  if (!routine) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Routine not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.navButton, { borderColor: themeColors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Routine Details</Text>
          <TouchableOpacity
            style={[styles.navButton, { borderColor: detailTheme.itemBorder }]}
            onPress={handleDeleteRoutine}
          >
            <Ionicons name="trash-outline" size={18} color={detailTheme.accent} />
          </TouchableOpacity>
        </View>

        <Card
          style={[
            styles.infoCard,
            { backgroundColor: detailTheme.card, borderColor: detailTheme.border },
          ]}
        >
          <Text style={[styles.infoTitle, { color: detailTheme.accent }]}>
            {routine.name}
          </Text>
          <Text style={[styles.infoMeta, { color: detailTheme.muted }]}>
            {formattedDate ? `Created ${formattedDate}` : 'Created date unavailable'}
          </Text>
          {groupName ? (
            <Text style={[styles.infoMeta, { color: detailTheme.muted }]}>
              Group: {groupName}
            </Text>
          ) : null}
          <View style={styles.infoStats}>
            <View style={styles.infoStat}>
              <Text style={[styles.infoStatLabel, { color: detailTheme.muted }]}>Tasks</Text>
              <Text style={[styles.infoStatValue, { color: themeColors.text }]}>
                {routine.tasks?.length || 0}
              </Text>
            </View>
            <View style={styles.infoStat}>
              <Text style={[styles.infoStatLabel, { color: detailTheme.muted }]}>
                Routine type
              </Text>
              <Text style={[styles.infoStatValue, { color: themeColors.text }]}>
                {isGroup ? 'Group' : 'Personal'}
              </Text>
            </View>
          </View>
        </Card>

        <Card
          style={[
            styles.tasksCard,
            { backgroundColor: detailTheme.card, borderColor: detailTheme.border },
          ]}
        >
          <View style={styles.tasksHeader}>
            <Text style={[styles.tasksTitle, { color: themeColors.text }]}>Tasks</Text>
            <TouchableOpacity
              style={[styles.addTaskButton, { backgroundColor: detailTheme.actionBg }]}
              onPress={() => setShowTaskModal(true)}
            >
              <Ionicons name="add" size={16} color={detailTheme.actionText} />
              <Text style={[styles.addTaskText, { color: detailTheme.actionText }]}>
                Add Task
              </Text>
            </TouchableOpacity>
          </View>

          {routine.tasks?.length ? (
            routine.tasks.map((task, index) => (
              <View
                key={task.id || `${task.name}-${index}`}
                style={[
                  styles.taskRow,
                  {
                    backgroundColor: detailTheme.itemBg,
                    borderColor: detailTheme.itemBorder,
                  },
                ]}
              >
                <View style={styles.taskOrderControls}>
                  <TouchableOpacity
                    style={[styles.orderButton, { borderColor: detailTheme.itemBorder }]}
                    onPress={() => handleMoveTask(index, -1)}
                    disabled={index === 0}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={16}
                      color={index === 0 ? themeColors.textLight : detailTheme.accent}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.orderButton, { borderColor: detailTheme.itemBorder }]}
                    onPress={() => handleMoveTask(index, 1)}
                    disabled={index === routine.tasks.length - 1}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={
                        index === routine.tasks.length - 1
                          ? themeColors.textLight
                          : detailTheme.accent
                      }
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.taskText, { color: themeColors.text }]}>
                  {task.name}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveTask(task.id)}>
                  <Ionicons name="close" size={18} color={themeColors.textLight} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyTaskText}>No tasks yet. Add your first one.</Text>
          )}
        </Card>
      </PlatformScrollView>

      <Modal
        visible={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskName('');
        }}
        title="Add Task"
      >
        <Input
          label="Task Name"
          value={taskName}
          onChangeText={setTaskName}
          placeholder="e.g., Brush teeth"
        />
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowTaskModal(false);
              setTaskName('');
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add"
            onPress={handleAddTask}
            disabled={!taskName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColors) => StyleSheet.create({
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: themeColors.text,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  infoMeta: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  infoStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  infoStat: {
    flex: 1,
  },
  infoStatLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  infoStatValue: {
    ...typography.body,
    fontWeight: '600',
  },
  tasksCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tasksTitle: {
    ...typography.h3,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  addTaskText: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  taskOrderControls: {
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  orderButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 2,
  },
  taskText: {
    flex: 1,
    ...typography.body,
  },
  emptyTaskText: {
    ...typography.bodySmall,
    color: themeColors.textLight,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
});

export default RoutineDetailScreen;
