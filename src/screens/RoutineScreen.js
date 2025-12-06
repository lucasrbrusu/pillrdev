import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} from '../utils/theme';

const RoutineScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    routines,
    chores,
    reminders,
    groceries,
    addRoutine,
    deleteRoutine,
    addTaskToRoutine,
    removeTaskFromRoutine,
    addChore,
    updateChore,
    deleteChore,
    addReminder,
    deleteReminder,
    addGroceryItem,
    toggleGroceryItem,
    deleteGroceryItem,
    clearCompletedGroceries,
  } = useApp();

  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showChoreModal, setShowChoreModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState(null);

  const [routineName, setRoutineName] = useState('');
  const [choreName, setChoreName] = useState('');
  const [choreDate, setChoreDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderName, setReminderName] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderTime, setReminderTime] = useState('');
  const [taskName, setTaskName] = useState('');
  const [groceryInput, setGroceryInput] = useState('');

  const handleCreateRoutine = async () => {
    if (!routineName.trim()) return;
    await addRoutine({ name: routineName.trim() });
    setRoutineName('');
    setShowRoutineModal(false);
  };

  const handleCreateChore = async () => {
    if (!choreName.trim()) return;
    await addChore({
      title: choreName.trim(),
      date: choreDate,
    });
    setChoreName('');
    setChoreDate(new Date().toISOString().split('T')[0]);
    setShowChoreModal(false);
  };

  const handleCreateReminder = async () => {
    if (!reminderName.trim()) return;
    await addReminder({
      title: reminderName.trim(),
      description: reminderDescription.trim(),
      date: reminderDate,
      time: reminderTime,
    });
    setReminderName('');
    setReminderDescription('');
    setReminderDate(new Date().toISOString().split('T')[0]);
    setReminderTime('');
    setShowReminderModal(false);
  };

  const handleAddTaskToRoutine = async () => {
    if (!taskName.trim() || !selectedRoutineId) return;
    await addTaskToRoutine(selectedRoutineId, { name: taskName.trim() });
    setTaskName('');
    setShowTaskModal(false);
    setSelectedRoutineId(null);
  };

  const handleAddGroceryItem = async () => {
    if (!groceryInput.trim()) return;
    await addGroceryItem(groceryInput.trim());
    setGroceryInput('');
  };

  const openAddTaskModal = (routineId) => {
    setSelectedRoutineId(routineId);
    setShowTaskModal(true);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const completedGroceries = groceries.filter((g) => g.completed);
  const activeGroceries = groceries.filter((g) => !g.completed);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Routine Manager Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Routine Manager</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowRoutineModal(true)}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>

          {routines.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={40}
                color={colors.primaryLight}
              />
              <Text style={styles.emptyText}>No routines yet</Text>
            </View>
          ) : (
            routines.map((routine) => (
              <View key={routine.id} style={styles.routineSection}>
                <View style={styles.routineHeader}>
                  <Text style={styles.routineName}>{routine.name}</Text>
                  <View style={styles.routineActions}>
                    <TouchableOpacity
                      style={styles.routineActionButton}
                      onPress={() => openAddTaskModal(routine.id)}
                    >
                      <Ionicons name="add" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.routineActionButton}
                      onPress={() => deleteRoutine(routine.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                {routine.tasks && routine.tasks.length > 0 ? (
                  routine.tasks.map((task, index) => (
                    <View key={task.id} style={styles.routineTaskItem}>
                      <View style={styles.taskOrderControls}>
                        <TouchableOpacity style={styles.orderButton}>
                          <Ionicons
                            name="chevron-up"
                            size={16}
                            color={index === 0 ? colors.border : colors.textSecondary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.orderButton}>
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color={
                              index === routine.tasks.length - 1
                                ? colors.border
                                : colors.textSecondary
                            }
                          />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.routineTaskText}>{task.name}</Text>
                      <TouchableOpacity
                        onPress={() => removeTaskFromRoutine(routine.id, task.id)}
                      >
                        <Ionicons name="close" size={18} color={colors.textLight} />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTasksText}>No tasks added</Text>
                )}
              </View>
            ))
          )}
        </Card>

        {/* Chores Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Chores</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowChoreModal(true)}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.createButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {chores.length === 0 ? (
            <Text style={styles.emptyText}>No chores scheduled</Text>
          ) : (
            chores.map((chore) => (
              <TouchableOpacity
                key={chore.id}
                style={styles.choreItem}
                onPress={() => updateChore(chore.id, { completed: !chore.completed })}
              >
                <View
                  style={[
                    styles.checkbox,
                    chore.completed && styles.checkboxChecked,
                  ]}
                >
                  {chore.completed && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.choreContent}>
                  <Text
                    style={[
                      styles.choreTitle,
                      chore.completed && styles.choreTitleCompleted,
                    ]}
                  >
                    {chore.title}
                  </Text>
                  <Text style={styles.choreDate}>{formatDate(chore.date)}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteChore(chore.id)}>
                  <Ionicons name="close" size={18} color={colors.textLight} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Reminders Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reminders</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowReminderModal(true)}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.createButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {reminders.length === 0 ? (
            <Text style={styles.emptyText}>No reminders set</Text>
          ) : (
            reminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderItem}>
                <Ionicons name="notifications-outline" size={20} color={colors.routine} />
                <View style={styles.reminderContent}>
                  <Text style={styles.reminderTitle}>{reminder.title}</Text>
                  {reminder.description && (
                    <Text style={styles.reminderDescription} numberOfLines={1}>
                      {reminder.description}
                    </Text>
                  )}
                  <Text style={styles.reminderDate}>
                    {formatDate(reminder.date)}
                    {reminder.time && ` at ${reminder.time}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteReminder(reminder.id)}>
                  <Ionicons name="close" size={18} color={colors.textLight} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        {/* Grocery List Section */}
        <Card style={[styles.sectionCard, styles.lastCard]}>
          <Text style={styles.sectionTitle}>Grocery List</Text>

          <View style={styles.groceryInputContainer}>
            <TextInput
              style={styles.groceryInput}
              value={groceryInput}
              onChangeText={setGroceryInput}
              placeholder="Add item..."
              placeholderTextColor={colors.placeholder}
              onSubmitEditing={handleAddGroceryItem}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.groceryAddButton}
              onPress={handleAddGroceryItem}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {groceries.length === 0 ? (
            <Text style={styles.emptyText}>Your grocery list is empty</Text>
          ) : (
            <>
              {activeGroceries.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.groceryItem}
                  onPress={() => toggleGroceryItem(item.id)}
                >
                  <View style={styles.groceryCheckbox} />
                  <Text style={styles.groceryText}>{item.name}</Text>
                  <TouchableOpacity onPress={() => deleteGroceryItem(item.id)}>
                    <Ionicons name="close" size={16} color={colors.textLight} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              {completedGroceries.length > 0 && (
                <>
                  <View style={styles.completedHeader}>
                    <Text style={styles.completedLabel}>Completed</Text>
                    <TouchableOpacity onPress={clearCompletedGroceries}>
                      <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  {completedGroceries.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.groceryItem}
                      onPress={() => toggleGroceryItem(item.id)}
                    >
                      <View style={[styles.groceryCheckbox, styles.groceryCheckboxChecked]}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.groceryText, styles.groceryTextCompleted]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
        </Card>
      </ScrollView>

      {/* Create Routine Modal */}
      <Modal
        visible={showRoutineModal}
        onClose={() => {
          setShowRoutineModal(false);
          setRoutineName('');
        }}
        title="Create Routine"
        fullScreen
      >
        <Input
          label="Routine Name"
          value={routineName}
          onChangeText={setRoutineName}
          placeholder="e.g., Morning Routine"
        />
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowRoutineModal(false);
              setRoutineName('');
            }}
            style={styles.modalButton}
          />
          <Button
            title="Create"
            onPress={handleCreateRoutine}
            disabled={!routineName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Add Chore Modal */}
      <Modal
        visible={showChoreModal}
        onClose={() => {
          setShowChoreModal(false);
          setChoreName('');
        }}
        title="Add Chore"
        fullScreen
      >
        <Input
          label="Chore Name"
          value={choreName}
          onChangeText={setChoreName}
          placeholder="e.g., Clean bathroom"
        />
        <Text style={styles.inputLabel}>Date</Text>
        <TouchableOpacity style={styles.dateButton}>
          <Text style={styles.dateButtonText}>{formatDate(choreDate)}</Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textLight} />
        </TouchableOpacity>
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowChoreModal(false);
              setChoreName('');
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add"
            onPress={handleCreateChore}
            disabled={!choreName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Add Reminder Modal */}
      <Modal
        visible={showReminderModal}
        onClose={() => {
          setShowReminderModal(false);
          setReminderName('');
          setReminderDescription('');
        }}
        title="Add Reminder"
        fullScreen
      >
        <Input
          label="Reminder Name"
          value={reminderName}
          onChangeText={setReminderName}
          placeholder="e.g., Call mom"
        />
        <Input
          label="Description (Optional)"
          value={reminderDescription}
          onChangeText={setReminderDescription}
          placeholder="Add details..."
          multiline
          numberOfLines={2}
        />
        <View style={styles.dateTimeRow}>
          <View style={styles.dateInput}>
            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity style={styles.dateButton}>
              <Text style={styles.dateButtonText}>{formatDate(reminderDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
          <View style={styles.timeInput}>
            <Text style={styles.inputLabel}>Time</Text>
            <TouchableOpacity style={styles.dateButton}>
              <Text style={[styles.dateButtonText, !reminderTime && styles.placeholderText]}>
                {reminderTime || '--:--'}
              </Text>
              <Ionicons name="time-outline" size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowReminderModal(false);
              setReminderName('');
              setReminderDescription('');
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add"
            onPress={handleCreateReminder}
            disabled={!reminderName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      {/* Add Task to Routine Modal */}
      <Modal
        visible={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskName('');
          setSelectedRoutineId(null);
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
              setSelectedRoutineId(null);
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add"
            onPress={handleAddTaskToRoutine}
            disabled={!taskName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  lastCard: {
    marginBottom: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  createButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  routineSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  routineName: {
    ...typography.label,
    color: colors.primary,
  },
  routineActions: {
    flexDirection: 'row',
  },
  routineActionButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  routineTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
  },
  taskOrderControls: {
    marginRight: spacing.sm,
  },
  orderButton: {
    padding: 2,
  },
  routineTaskText: {
    flex: 1,
    ...typography.body,
  },
  noTasksText: {
    ...typography.bodySmall,
    color: colors.textLight,
    fontStyle: 'italic',
    paddingLeft: spacing.xl,
  },
  choreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkbox: {
    width: 22,
    height: 22,
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
  choreContent: {
    flex: 1,
  },
  choreTitle: {
    ...typography.body,
  },
  choreTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textLight,
  },
  choreDate: {
    ...typography.caption,
    color: colors.textLight,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  reminderContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reminderTitle: {
    ...typography.body,
    fontWeight: '500',
  },
  reminderDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reminderDate: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  groceryInputContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  groceryInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groceryAddButton: {
    width: 44,
    height: 44,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  groceryCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryCheckboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  groceryText: {
    flex: 1,
    ...typography.body,
  },
  groceryTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textLight,
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  completedLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  clearText: {
    ...typography.bodySmall,
    color: colors.danger,
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
  inputLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
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
    marginBottom: spacing.lg,
  },
  dateButtonText: {
    ...typography.body,
  },
  placeholderText: {
    color: colors.placeholder,
  },
  dateTimeRow: {
    flexDirection: 'row',
  },
  dateInput: {
    flex: 1,
    marginRight: spacing.md,
  },
  timeInput: {
    flex: 1,
  },
});

export default RoutineScreen;
