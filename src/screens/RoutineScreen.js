import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import {
  Card,
  Modal,
  Input,
  ChipGroup,
  PlatformScrollView,
  PlatformDatePicker,
  PlatformTimePicker,
} from '../components';
import { formatTimeFromDate } from '../utils/notifications';
import {
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../utils/theme';

const REMINDER_TIME_OPTIONS = Array.from({ length: 48 }).map((_, idx) => {
  const h = Math.floor(idx / 2);
  const m = idx % 2 === 0 ? '00' : '30';
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${m} ${suffix}`;
});

const CHORE_QUICK_OPTIONS = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'Next Week', offset: 7 },
];

const REMINDER_QUICK_TIMES = ['09:00', '12:00', '15:00', '18:00', '20:00'];

const ROUTINE_SUGGESTIONS = [
  'Morning Routine',
  'Night Routine',
  'Workout Flow',
  'Study Session',
];

const getISODateWithOffset = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
};

const normalizeTimeValue = (value) => {
  if (!value || typeof value !== 'string') return '';
  const match = value.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return value;
  let hour = parseInt(match[1], 10);
  const minute = match[2] ?? '00';
  const suffix = match[3]?.toUpperCase();
  if (suffix === 'PM' && hour < 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;
  const paddedHour = hour.toString().padStart(2, '0');
  return `${paddedHour}:${minute}`;
};

const RoutineScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
    const {
      routines,
      groupRoutines,
      chores,
      reminders,
    groceries,
    addRoutine,
    addGroupRoutine,
    addChore,
    updateChore,
      deleteChore,
      addReminder,
      deleteReminder,
      addGroceryItem,
      toggleGroceryItem,
      deleteGroceryItem,
      clearCompletedGroceries,
      groups,
      themeName,
      themeColors,
      ensureRoutinesLoaded,
      ensureChoresLoaded,
      ensureRemindersLoaded,
      ensureGroceriesLoaded,
    } = useApp();
    const isDark = themeName === 'dark';
    const modalTopPadding = Math.max(spacing.lg, insets.top);
    const sectionThemes = useMemo(
      () => ({
        routine: isDark
          ? {
              card: '#2E2538',
              header: '#3C2E4A',
              border: '#4B3A5E',
              accent: themeColors.routine,
              iconBg: '#F59E0B',
              iconColor: '#1F1305',
              actionBg: '#4A3560',
              actionText: '#F4E5FF',
              sectionBg: '#372B44',
              itemBg: '#3C304A',
              itemBorder: 'rgba(245, 158, 11, 0.45)',
              muted: '#E2C48C',
            }
          : {
              card: '#FFF4E3',
              header: '#FFE8C6',
              border: '#F6D7A7',
              accent: themeColors.routine,
              iconBg: '#FF9F1C',
              iconColor: '#FFFFFF',
              actionBg: '#EFE5FF',
              actionText: themeColors.primary,
              sectionBg: '#FFF8ED',
              itemBg: '#FFFDF7',
              itemBorder: '#F3D5A2',
              muted: '#8B6F45',
            },
        group: isDark
          ? {
              card: '#232447',
              header: '#2E2B56',
              border: '#3C3B69',
              accent: themeColors.tasks,
              iconBg: themeColors.tasks,
              iconColor: '#FFFFFF',
              actionBg: '#2E2B56',
              actionText: '#DDE1FF',
              sectionBg: '#292A4D',
              itemBg: '#303158',
              itemBorder: 'rgba(99, 102, 241, 0.45)',
              muted: '#C8CEFF',
            }
          : {
              card: '#EEF0FF',
              header: '#DDE2FF',
              border: '#C9D1FF',
              accent: themeColors.tasks,
              iconBg: themeColors.tasks,
              iconColor: '#FFFFFF',
              actionBg: '#E4E8FF',
              actionText: themeColors.tasks,
              sectionBg: '#F6F7FF',
              itemBg: '#FFFFFF',
              itemBorder: '#D5DBFF',
              muted: '#5157B7',
            },
        chores: isDark
          ? {
              card: '#1F2E49',
              header: '#2A3A5A',
              border: '#3B4F75',
              accent: themeColors.info,
              iconBg: themeColors.info,
              iconColor: '#FFFFFF',
              actionBg: '#2A3A5A',
              actionText: '#D6E4FF',
              itemBg: '#283A58',
              itemBorder: 'rgba(59, 130, 246, 0.45)',
            }
          : {
              card: '#EAF6FF',
              header: '#D9ECFF',
              border: '#C6E2FF',
              accent: themeColors.info,
              iconBg: themeColors.info,
              iconColor: '#FFFFFF',
              actionBg: '#DDEBFF',
              actionText: '#1D4ED8',
              itemBg: '#F4FAFF',
              itemBorder: '#CFE7FF',
            },
        reminders: isDark
          ? {
              card: '#352137',
              header: '#43253E',
              border: '#56304F',
              accent: themeColors.health,
              iconBg: themeColors.health,
              iconColor: '#FFFFFF',
              actionBg: '#43253E',
              actionText: '#FFD7ED',
              itemBg: '#3E2843',
              itemBorder: 'rgba(236, 72, 153, 0.45)',
            }
          : {
              card: '#FFF0F7',
              header: '#FFE0EF',
              border: '#F7C9DF',
              accent: themeColors.health,
              iconBg: themeColors.health,
              iconColor: '#FFFFFF',
              actionBg: '#FFD6E8',
              actionText: '#C02672',
              itemBg: '#FFF7FB',
              itemBorder: '#F4C5DD',
            },
        groceries: isDark
          ? {
              card: '#1F3530',
              header: '#25443A',
              border: '#345B4A',
              accent: themeColors.finance,
              iconBg: themeColors.finance,
              iconColor: '#FFFFFF',
              itemBg: '#263D36',
              itemBorder: 'rgba(16, 185, 129, 0.45)',
            }
          : {
              card: '#EAFBF2',
              header: '#D9F5E7',
              border: '#BFEBD5',
              accent: themeColors.finance,
              iconBg: themeColors.finance,
              iconColor: '#FFFFFF',
              itemBg: '#F3FFF8',
              itemBorder: '#CDEEDD',
            },
      }),
      [isDark, themeColors]
    );
    const modalThemes = useMemo(
      () => ({
        chore: {
          gradient: isDark ? ['#0F172A', '#1D4ED8'] : ['#38BDF8', '#2563EB'],
          surface: isDark ? '#0B1220' : '#FFFFFF',
          border: isDark ? 'rgba(59, 130, 246, 0.4)' : '#CFE7FF',
          fieldBg: isDark ? '#0F172A' : '#EFF6FF',
          fieldBorder: isDark ? 'rgba(59, 130, 246, 0.4)' : '#BBDDFE',
          headerText: '#FFFFFF',
          headerSubText: 'rgba(255, 255, 255, 0.85)',
          iconBg: 'rgba(255, 255, 255, 0.2)',
          closeBg: 'rgba(255, 255, 255, 0.22)',
          chipBg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#DBEDFF',
          chipBorder: isDark ? 'rgba(59, 130, 246, 0.35)' : '#C1DDFF',
          chipText: isDark ? '#BFDBFE' : '#1E3A8A',
          chipActiveBg: isDark ? '#2563EB' : '#60A5FA',
          chipActiveBorder: isDark ? '#3B82F6' : '#3B82F6',
          chipActiveText: '#FFFFFF',
          actionGradient: isDark ? ['#2563EB', '#38BDF8'] : ['#60A5FA', '#38BDF8'],
          secondaryBg: isDark ? '#0F172A' : '#F3F4F6',
          secondaryBorder: isDark ? '#1F2937' : '#E5E7EB',
          secondaryText: themeColors.text,
          accent: themeColors.info,
        },
        reminder: {
          gradient: isDark ? ['#7C2D12', '#BE185D'] : ['#FB923C', '#F43F5E'],
          surface: isDark ? '#1B0B12' : '#FFFFFF',
          border: isDark ? 'rgba(236, 72, 153, 0.4)' : '#F9C6D9',
          fieldBg: isDark ? '#2A0E1B' : '#FFF5F2',
          fieldBorder: isDark ? 'rgba(236, 72, 153, 0.4)' : '#F6C1D4',
          headerText: '#FFFFFF',
          headerSubText: 'rgba(255, 255, 255, 0.85)',
          iconBg: 'rgba(255, 255, 255, 0.2)',
          closeBg: 'rgba(255, 255, 255, 0.22)',
          chipBg: isDark ? 'rgba(249, 115, 22, 0.2)' : '#FFE7D5',
          chipBorder: isDark ? 'rgba(249, 115, 22, 0.35)' : '#FFD5B5',
          chipText: isDark ? '#FDBA74' : '#C2410C',
          chipActiveBg: isDark ? '#F97316' : '#FB923C',
          chipActiveBorder: isDark ? '#FDBA74' : '#FB923C',
          chipActiveText: '#FFFFFF',
          actionGradient: isDark ? ['#F97316', '#EC4899'] : ['#FB923C', '#F472B6'],
          secondaryBg: isDark ? '#1F1419' : '#F3F4F6',
          secondaryBorder: isDark ? '#2D1B22' : '#E5E7EB',
          secondaryText: themeColors.text,
          accent: themeColors.health,
        },
        routine: {
          gradient: isDark ? ['#4C1D95', '#DB2777'] : ['#A855F7', '#EC4899'],
          surface: isDark ? '#1C1330' : '#FFFFFF',
          border: isDark ? 'rgba(168, 85, 247, 0.4)' : '#E8D5FF',
          fieldBg: isDark ? '#2A1B3D' : '#F7F0FF',
          fieldBorder: isDark ? 'rgba(168, 85, 247, 0.4)' : '#E0C7FF',
          headerText: '#FFFFFF',
          headerSubText: 'rgba(255, 255, 255, 0.85)',
          iconBg: 'rgba(255, 255, 255, 0.2)',
          closeBg: 'rgba(255, 255, 255, 0.22)',
          chipBg: isDark ? 'rgba(168, 85, 247, 0.18)' : '#F0DBFF',
          chipBorder: isDark ? 'rgba(168, 85, 247, 0.35)' : '#E6C6FF',
          chipText: isDark ? '#E9D5FF' : '#6D28D9',
          chipActiveBg: isDark ? '#A855F7' : '#C084FC',
          chipActiveBorder: isDark ? '#C084FC' : '#A855F7',
          chipActiveText: '#FFFFFF',
          actionGradient: isDark ? ['#A855F7', '#EC4899'] : ['#C084FC', '#F472B6'],
          secondaryBg: isDark ? '#201727' : '#F3F4F6',
          secondaryBorder: isDark ? '#302236' : '#E5E7EB',
          secondaryText: themeColors.text,
          accent: themeColors.primary,
        },
      }),
      [isDark, themeColors]
    );
    const routineModal = modalThemes.routine;
    const choreModal = modalThemes.chore;
    const reminderModal = modalThemes.reminder;
    const styles = useMemo(() => createStyles(themeColors), [themeColors]);

    useEffect(() => {
      ensureRoutinesLoaded();
      ensureChoresLoaded();
      ensureRemindersLoaded();
      ensureGroceriesLoaded();
    }, [ensureChoresLoaded, ensureGroceriesLoaded, ensureRemindersLoaded, ensureRoutinesLoaded]);

    const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showChoreModal, setShowChoreModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showGroceryModal, setShowGroceryModal] = useState(false);

  const [routineName, setRoutineName] = useState('');
  const [routineGroupId, setRoutineGroupId] = useState(null);
  const [choreName, setChoreName] = useState('');
  const [choreDate, setChoreDate] = useState(new Date().toISOString().split('T')[0]);
  const [showChoreDatePicker, setShowChoreDatePicker] = useState(false);
  const [reminderName, setReminderName] = useState('');
  const [reminderDescription, setReminderDescription] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderTime, setReminderTime] = useState('');
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [groceryInput, setGroceryInput] = useState('');
  const normalizedReminderTime = useMemo(
    () => normalizeTimeValue(reminderTime),
    [reminderTime]
  );

  const groupNameMap = useMemo(() => {
    const map = new Map();
    (groups || []).forEach((group) => {
      map.set(group.id, group.name);
    });
    return map;
  }, [groups]);

  const handleCreateRoutine = async () => {
    if (!routineName.trim()) return;
    if (routineGroupId) {
      await addGroupRoutine({ name: routineName.trim(), groupId: routineGroupId });
    } else {
      await addRoutine({ name: routineName.trim() });
    }
    setRoutineName('');
    setRoutineGroupId(null);
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
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(false);
    setShowReminderModal(false);
  };

  const closeRoutineModal = () => {
    setShowRoutineModal(false);
    setRoutineName('');
  };

  const closeChoreModal = () => {
    setShowChoreModal(false);
    setChoreName('');
    setShowChoreDatePicker(false);
  };

  const closeReminderModal = () => {
    setShowReminderModal(false);
    setReminderName('');
    setReminderDescription('');
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(false);
  };

  const handleQuickChoreDate = (offset) => {
    setChoreDate(getISODateWithOffset(offset));
    setShowChoreDatePicker(false);
  };

  const handleQuickReminderTime = (value) => {
    setReminderTime(value);
    setShowReminderTimePicker(false);
  };

  const handleRoutineSuggestion = (label) => {
    setRoutineName(label);
  };

  const handleAddGroceryItem = async () => {
    if (!groceryInput.trim()) return;
    await addGroceryItem(groceryInput.trim());
    setGroceryInput('');
  };

  const openRoutineDetail = (routineId, isGroup) => {
    navigation.navigate('RoutineDetail', { routineId, isGroup });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatISODate = (date) => date.toISOString().split('T')[0];

  const reminderTimeOptions = REMINDER_TIME_OPTIONS;

  const openReminderDatePicker = () => {
    setShowReminderTimePicker(false);
    setShowReminderDatePicker(true);
  };

  const handleSelectReminderDate = (date) => {
    setReminderDate(formatISODate(date));
  };

  const openReminderTimePicker = () => {
    setShowReminderDatePicker(false);
    setShowReminderTimePicker(true);
  };

  const handleSelectReminderTime = (value) => {
    const normalized =
      value instanceof Date ? formatTimeFromDate(value) : value;
    setReminderTime(normalized);
  };

  const openChoreDatePicker = () => {
    setShowChoreDatePicker(true);
  };

  const handleSelectChoreDate = (date) => {
    setChoreDate(formatISODate(date));
  };

  const completedGroceries = groceries.filter((g) => g.completed);
  const activeGroceries = groceries.filter((g) => !g.completed);
  const choreGroups = useMemo(() => {
    const map = new Map();
    chores.forEach((chore) => {
      const key = chore.date
        ? new Date(chore.date).toISOString().slice(0, 10)
        : 'no-date';
      const list = map.get(key) || [];
      list.push(chore);
      map.set(key, list);
    });

    const sortedKeys = Array.from(map.keys()).sort((a, b) => {
      if (a === 'no-date') return 1;
      if (b === 'no-date') return -1;
      return new Date(a) - new Date(b);
    });

    return sortedKeys.map((key) => ({
      key,
      label: key === 'no-date' ? 'No date' : formatDate(key),
      items: (map.get(key) || []).sort(
        (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
      ),
    }));
  }, [chores]);

  const renderGroceryList = () => (
    <>
      {groceries.length === 0 ? (
        <Text style={styles.emptyText}>Your grocery list is empty</Text>
      ) : (
        <>
          {activeGroceries.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.groceryItem,
                {
                  backgroundColor: groceriesTheme.itemBg,
                  borderColor: groceriesTheme.itemBorder,
                },
              ]}
              onPress={() => toggleGroceryItem(item.id)}
            >
              <View
                style={[
                  styles.groceryCheckbox,
                  { borderColor: groceriesTheme.itemBorder },
                ]}
              />
              <Text style={styles.groceryText}>{item.name}</Text>
              <TouchableOpacity onPress={() => deleteGroceryItem(item.id)}>
                <Ionicons name="close" size={16} color={themeColors.textLight} />
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
                  style={[
                    styles.groceryItem,
                    {
                      backgroundColor: groceriesTheme.itemBg,
                      borderColor: groceriesTheme.itemBorder,
                    },
                  ]}
                  onPress={() => toggleGroceryItem(item.id)}
                >
                  <View
                    style={[
                      styles.groceryCheckbox,
                      styles.groceryCheckboxChecked,
                      { borderColor: groceriesTheme.itemBorder },
                    ]}
                  >
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
    </>
  );

  const routineTheme = sectionThemes.routine;
  const groupTheme = sectionThemes.group;
  const choresTheme = sectionThemes.chores;
  const remindersTheme = sectionThemes.reminders;
  const groceriesTheme = sectionThemes.groceries;

  return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <PlatformScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical
          bounces
        >
        {/* Routine Manager Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: routineTheme.card, borderColor: routineTheme.border },
          ]}
        >
          <View
            style={[
              styles.sectionHeader,
              {
                backgroundColor: routineTheme.header,
                borderBottomColor: routineTheme.border,
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: routineTheme.iconBg },
                ]}
              >
                <Ionicons name="sunny" size={18} color={routineTheme.iconColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                Routine Manager
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.sectionAction,
                { backgroundColor: routineTheme.actionBg },
              ]}
              onPress={() => setShowRoutineModal(true)}
            >
              <Ionicons name="add" size={16} color={routineTheme.actionText} />
              <Text style={[styles.sectionActionText, { color: routineTheme.actionText }]}>
                Create
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionBody}>
            {routines.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="clipboard-list-outline"
                  size={40}
                  color={routineTheme.accent}
                />
                <Text style={styles.emptyText}>No routines yet</Text>
              </View>
            ) : (
              routines.map((routine) => {
                const taskCount = routine.tasks?.length || 0;
                return (
                  <TouchableOpacity
                    key={routine.id}
                    style={[
                      styles.routineSection,
                      {
                        backgroundColor: routineTheme.sectionBg,
                        borderColor: routineTheme.itemBorder,
                      },
                    ]}
                    onPress={() => openRoutineDetail(routine.id, false)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.routineHeader}>
                      <View style={styles.routineTitleRow}>
                        <View
                          style={[
                            styles.routineBadge,
                            {
                              borderColor: routineTheme.itemBorder,
                              backgroundColor: routineTheme.itemBg,
                            },
                          ]}
                        >
                          <Ionicons
                            name="sparkles"
                            size={12}
                            color={routineTheme.accent}
                          />
                        </View>
                        <Text style={[styles.routineName, { color: routineTheme.accent }]}>
                          {routine.name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={routineTheme.accent} />
                    </View>
                    <Text style={[styles.routineMeta, { color: routineTheme.muted }]}>
                      {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </Card>

        {(groupRoutines.length > 0 || groups.length > 0) ? (
          <Card
            style={[
              styles.sectionCard,
              { backgroundColor: groupTheme.card, borderColor: groupTheme.border },
            ]}
          >
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: groupTheme.header, borderBottomColor: groupTheme.border },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: groupTheme.iconBg }]}>
                  <Ionicons name="people" size={18} color={groupTheme.iconColor} />
                </View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                  Group Routines
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.sectionAction, { backgroundColor: groupTheme.actionBg }]}
                onPress={() => setShowRoutineModal(true)}
              >
                <Ionicons name="add" size={16} color={groupTheme.actionText} />
                <Text style={[styles.sectionActionText, { color: groupTheme.actionText }]}>
                  Create
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionBody}>
              {groupRoutines.length === 0 ? (
                <Text style={styles.emptyText}>No group routines yet</Text>
              ) : (
                groupRoutines.map((routine) => {
                  const taskCount = routine.tasks?.length || 0;
                  const groupName = groupNameMap.get(routine.groupId) || 'Group';
                  return (
                    <TouchableOpacity
                      key={routine.id}
                      style={[
                        styles.routineSection,
                        {
                          backgroundColor: groupTheme.sectionBg,
                          borderColor: groupTheme.itemBorder,
                        },
                      ]}
                      onPress={() => openRoutineDetail(routine.id, true)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.routineHeader}>
                        <View>
                          <Text style={[styles.routineName, { color: groupTheme.accent }]}>
                            {routine.name}
                          </Text>
                          <Text style={[styles.routineMeta, { color: groupTheme.muted }]}>
                            {groupName} • {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={groupTheme.accent} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </Card>
        ) : null}

        {/* Chores Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: choresTheme.card, borderColor: choresTheme.border },
          ]}
        >
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: choresTheme.header, borderBottomColor: choresTheme.border },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: choresTheme.iconBg }]}>
                <Ionicons name="home" size={18} color={choresTheme.iconColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Chores</Text>
            </View>
            <TouchableOpacity
              style={[styles.sectionAction, { backgroundColor: choresTheme.actionBg }]}
              onPress={() => setShowChoreModal(true)}
            >
              <Ionicons name="add" size={16} color={choresTheme.actionText} />
              <Text style={[styles.sectionActionText, { color: choresTheme.actionText }]}>
                Add
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionBody}>
            {chores.length === 0 ? (
              <Text style={styles.emptyText}>No chores scheduled</Text>
            ) : (
              choreGroups.map((group) => (
                <View key={group.key} style={styles.choreGroup}>
                  <Text style={styles.choreGroupLabel}>{group.label}</Text>
                  {group.items.map((chore) => (
                    <TouchableOpacity
                      key={chore.id}
                      style={[
                        styles.choreItem,
                        {
                          backgroundColor: choresTheme.itemBg,
                          borderColor: choresTheme.itemBorder,
                        },
                      ]}
                      onPress={() => updateChore(chore.id, { completed: !chore.completed })}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: choresTheme.itemBorder },
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
                        <Ionicons name="close" size={18} color={themeColors.textLight} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </View>
        </Card>

        {/* Reminders Section */}
        <Card
          style={[
            styles.sectionCard,
            { backgroundColor: remindersTheme.card, borderColor: remindersTheme.border },
          ]}
        >
          <View
            style={[
              styles.sectionHeader,
              {
                backgroundColor: remindersTheme.header,
                borderBottomColor: remindersTheme.border,
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: remindersTheme.iconBg }]}>
                <Ionicons name="notifications" size={18} color={remindersTheme.iconColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Reminders</Text>
            </View>
            <TouchableOpacity
              style={[styles.sectionAction, { backgroundColor: remindersTheme.actionBg }]}
              onPress={() => setShowReminderModal(true)}
            >
              <Ionicons name="add" size={16} color={remindersTheme.actionText} />
              <Text style={[styles.sectionActionText, { color: remindersTheme.actionText }]}>
                Add
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionBody}>
            {reminders.length === 0 ? (
              <Text style={styles.emptyText}>No reminders set</Text>
            ) : (
              reminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={[
                    styles.reminderItem,
                    {
                      backgroundColor: remindersTheme.itemBg,
                      borderColor: remindersTheme.itemBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.reminderIconBadge,
                      { backgroundColor: remindersTheme.iconBg },
                    ]}
                  >
                    <Ionicons
                      name="notifications"
                      size={16}
                      color={remindersTheme.iconColor}
                    />
                  </View>
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
                    <Ionicons name="close" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </Card>

        {/* Grocery List Section */}
        <Card
          style={[
            styles.sectionCard,
            styles.lastCard,
            { backgroundColor: groceriesTheme.card, borderColor: groceriesTheme.border },
          ]}
          onPress={() => setShowGroceryModal(true)}
        >
          <View
            style={[
              styles.sectionHeader,
              {
                backgroundColor: groceriesTheme.header,
                borderBottomColor: groceriesTheme.border,
              },
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: groceriesTheme.iconBg }]}>
                <Ionicons name="cart" size={18} color={groceriesTheme.iconColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Grocery List</Text>
            </View>
          </View>

          <View style={styles.sectionBody}>
            <View style={styles.groceryInputContainer}>
              <TextInput
                style={[
                  styles.groceryInput,
                  {
                    backgroundColor: groceriesTheme.itemBg,
                    borderColor: groceriesTheme.itemBorder,
                    color: themeColors.text,
                  },
                ]}
                value={groceryInput}
                placeholder="Tap to add item..."
                placeholderTextColor={themeColors.placeholder}
                editable={false}
                onPressIn={() => setShowGroceryModal(true)}
              />
              <TouchableOpacity
                style={[
                  styles.groceryAddButton,
                  { backgroundColor: groceriesTheme.itemBg, borderColor: groceriesTheme.itemBorder },
                ]}
                onPress={() => setShowGroceryModal(true)}
              >
                <Ionicons name="add" size={20} color={groceriesTheme.accent} />
              </TouchableOpacity>
            </View>

            {renderGroceryList()}
          </View>
        </Card>
        </PlatformScrollView>

        {/* Create Routine Modal */}
        <Modal
          visible={showRoutineModal}
          onClose={closeRoutineModal}
          title="Create Routine"
          fullScreen
          hideHeader
          showCloseButton={false}
        >
          <View style={[styles.modalScreen, { paddingTop: modalTopPadding }]}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: routineModal.surface, borderColor: routineModal.border },
              ]}
            >
              <LinearGradient colors={routineModal.gradient} style={styles.modalHeader}>
                <View style={styles.modalHeaderContent}>
                  <View style={[styles.modalIconBadge, { backgroundColor: routineModal.iconBg }]}>
                    <Ionicons name="sparkles" size={18} color={routineModal.headerText} />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={[styles.modalTitle, { color: routineModal.headerText }]}>
                      Create Routine
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: routineModal.headerSubText }]}>
                      Build your perfect daily flow
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: routineModal.closeBg }]}
                  onPress={closeRoutineModal}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={routineModal.headerText} />
                </TouchableOpacity>
              </LinearGradient>
              <View style={styles.modalBody}>
                <Input
                  label="Routine Name"
                  value={routineName}
                  onChangeText={setRoutineName}
                  placeholder="e.g., Morning Routine"
                  containerStyle={styles.modalInputContainer}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: routineModal.fieldBg,
                      borderColor: routineModal.fieldBorder,
                    },
                  ]}
                  inputStyle={styles.modalInputText}
                />
                <Text style={styles.quickLabel}>Quick suggestions</Text>
                <View style={styles.quickGroup}>
                  {ROUTINE_SUGGESTIONS.map((label) => {
                    const selected = routineName.trim() === label;
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected
                              ? routineModal.chipActiveBg
                              : routineModal.chipBg,
                            borderColor: selected
                              ? routineModal.chipActiveBorder
                              : routineModal.chipBorder,
                          },
                        ]}
                        onPress={() => handleRoutineSuggestion(label)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            {
                              color: selected
                                ? routineModal.chipActiveText
                                : routineModal.chipText,
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {groups.length > 0 ? (
                  <>
                    <Text style={styles.inputLabel}>Share with group</Text>
                    <ChipGroup
                      options={[
                        { label: 'Personal', value: null },
                        ...groups.map((g) => ({ label: g.name, value: g.id })),
                      ]}
                      selectedValue={routineGroupId}
                      onSelect={setRoutineGroupId}
                      style={styles.chipGroup}
                      color={routineModal.chipActiveBg}
                    />
                  </>
                ) : null}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.secondaryButton,
                      {
                        backgroundColor: routineModal.secondaryBg,
                        borderColor: routineModal.secondaryBorder,
                      },
                    ]}
                    onPress={closeRoutineModal}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        { color: routineModal.secondaryText },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.primaryButton,
                      !routineName.trim() && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleCreateRoutine}
                    disabled={!routineName.trim()}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={routineModal.actionGradient}
                      style={styles.primaryButtonInner}
                    >
                      <Text style={styles.primaryButtonText}>Create</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Chore Modal */}
        <Modal
          visible={showChoreModal}
          onClose={closeChoreModal}
          title="Add Chore"
          fullScreen
          hideHeader
          showCloseButton={false}
        >
          <View style={[styles.modalScreen, { paddingTop: modalTopPadding }]}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: choreModal.surface, borderColor: choreModal.border },
              ]}
            >
              <LinearGradient colors={choreModal.gradient} style={styles.modalHeader}>
                <View style={styles.modalHeaderContent}>
                  <View style={[styles.modalIconBadge, { backgroundColor: choreModal.iconBg }]}>
                    <Ionicons name="list" size={18} color={choreModal.headerText} />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={[styles.modalTitle, { color: choreModal.headerText }]}>
                      Add Chore
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: choreModal.headerSubText }]}>
                      Stay on top of your tasks
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: choreModal.closeBg }]}
                  onPress={closeChoreModal}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={choreModal.headerText} />
                </TouchableOpacity>
              </LinearGradient>
              <View style={styles.modalBody}>
                <Input
                  label="Chore Name"
                  value={choreName}
                  onChangeText={setChoreName}
                  placeholder="e.g., Clean bathroom"
                  containerStyle={styles.modalInputContainer}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: choreModal.fieldBg,
                      borderColor: choreModal.fieldBorder,
                    },
                  ]}
                  inputStyle={styles.modalInputText}
                />
                <Text style={styles.inputLabel}>Due Date</Text>
                <TouchableOpacity
                  style={[
                    styles.dateButton,
                    {
                      backgroundColor: choreModal.fieldBg,
                      borderColor: choreModal.fieldBorder,
                    },
                  ]}
                  onPress={openChoreDatePicker}
                >
                  <Text style={styles.dateButtonText}>{formatDate(choreDate)}</Text>
                  <Ionicons name="calendar-outline" size={18} color={themeColors.textLight} />
                </TouchableOpacity>
                <Text style={styles.quickLabel}>Quick select</Text>
                <View style={styles.quickGroup}>
                  {CHORE_QUICK_OPTIONS.map((option) => {
                    const quickDate = getISODateWithOffset(option.offset);
                    const selected = choreDate === quickDate;
                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: selected
                              ? choreModal.chipActiveBg
                              : choreModal.chipBg,
                            borderColor: selected
                              ? choreModal.chipActiveBorder
                              : choreModal.chipBorder,
                          },
                        ]}
                        onPress={() => handleQuickChoreDate(option.offset)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            {
                              color: selected
                                ? choreModal.chipActiveText
                                : choreModal.chipText,
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.secondaryButton,
                      {
                        backgroundColor: choreModal.secondaryBg,
                        borderColor: choreModal.secondaryBorder,
                      },
                    ]}
                    onPress={closeChoreModal}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        { color: choreModal.secondaryText },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.primaryButton,
                      !choreName.trim() && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleCreateChore}
                    disabled={!choreName.trim()}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={choreModal.actionGradient}
                      style={styles.primaryButtonInner}
                    >
                      <Text style={styles.primaryButtonText}>Add Chore</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <PlatformDatePicker
            visible={showChoreDatePicker}
            value={choreDate}
            onChange={handleSelectChoreDate}
            onClose={() => setShowChoreDatePicker(false)}
            accentColor={choreModal.accent}
          />
        </Modal>

      {/* Grocery Fullscreen Modal */}
      <Modal
        visible={showGroceryModal}
        onClose={() => setShowGroceryModal(false)}
        title="Grocery List"
        fullScreen
      >
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.groceryInputContainer}>
            <TextInput
              style={[
                styles.groceryInput,
                {
                  backgroundColor: groceriesTheme.itemBg,
                  borderColor: groceriesTheme.itemBorder,
                  color: themeColors.text,
                },
              ]}
              value={groceryInput}
              onChangeText={setGroceryInput}
              placeholder="Add item..."
              placeholderTextColor={themeColors.placeholder}
              onSubmitEditing={handleAddGroceryItem}
              returnKeyType="done"
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.groceryAddButton,
                { backgroundColor: groceriesTheme.itemBg, borderColor: groceriesTheme.itemBorder },
              ]}
              onPress={handleAddGroceryItem}
            >
              <Ionicons name="add" size={20} color={groceriesTheme.accent} />
            </TouchableOpacity>
          </View>

          {renderGroceryList()}
        </View>
      </Modal>

      {/* Add Reminder Modal */}
      <Modal
        visible={showReminderModal}
        onClose={closeReminderModal}
        title="Add Reminder"
        fullScreen
        hideHeader
        showCloseButton={false}
      >
        <View style={[styles.modalScreen, { paddingTop: modalTopPadding }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: reminderModal.surface, borderColor: reminderModal.border },
            ]}
          >
            <LinearGradient colors={reminderModal.gradient} style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <View style={[styles.modalIconBadge, { backgroundColor: reminderModal.iconBg }]}>
                  <Ionicons name="notifications" size={18} color={reminderModal.headerText} />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={[styles.modalTitle, { color: reminderModal.headerText }]}>
                    Add Reminder
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: reminderModal.headerSubText }]}>
                    Never forget important things
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseButton, { backgroundColor: reminderModal.closeBg }]}
                onPress={closeReminderModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={reminderModal.headerText} />
              </TouchableOpacity>
            </LinearGradient>
            <View style={styles.modalBody}>
              <Input
                label="Reminder Name"
                value={reminderName}
                onChangeText={setReminderName}
                placeholder="e.g., Call mom"
                containerStyle={styles.modalInputContainer}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: reminderModal.fieldBg,
                    borderColor: reminderModal.fieldBorder,
                  },
                ]}
                inputStyle={styles.modalInputText}
              />
              <Input
                label="Description (Optional)"
                value={reminderDescription}
                onChangeText={setReminderDescription}
                placeholder="Add details..."
                multiline
                numberOfLines={2}
                containerStyle={styles.modalInputContainer}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: reminderModal.fieldBg,
                    borderColor: reminderModal.fieldBorder,
                  },
                ]}
                inputStyle={styles.modalInputText}
              />
              <View style={styles.dateTimeRow}>
                <View style={styles.dateInput}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        backgroundColor: reminderModal.fieldBg,
                        borderColor: reminderModal.fieldBorder,
                      },
                    ]}
                    onPress={openReminderDatePicker}
                  >
                    <Text style={styles.dateButtonText}>{formatDate(reminderDate)}</Text>
                    <Ionicons name="calendar-outline" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                </View>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>Time</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      {
                        backgroundColor: reminderModal.fieldBg,
                        borderColor: reminderModal.fieldBorder,
                      },
                    ]}
                    onPress={openReminderTimePicker}
                  >
                    <Text style={[styles.dateButtonText, !reminderTime && styles.placeholderText]}>
                      {reminderTime || '--:--'}
                    </Text>
                    <Ionicons name="time-outline" size={18} color={themeColors.textLight} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.quickLabel}>Quick times</Text>
              <View style={styles.quickGroup}>
                {REMINDER_QUICK_TIMES.map((time) => {
                  const selected = normalizedReminderTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: selected
                            ? reminderModal.chipActiveBg
                            : reminderModal.chipBg,
                          borderColor: selected
                            ? reminderModal.chipActiveBorder
                            : reminderModal.chipBorder,
                        },
                      ]}
                      onPress={() => handleQuickReminderTime(time)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          {
                            color: selected
                              ? reminderModal.chipActiveText
                              : reminderModal.chipText,
                          },
                        ]}
                      >
                        {time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.secondaryButton,
                    {
                      backgroundColor: reminderModal.secondaryBg,
                      borderColor: reminderModal.secondaryBorder,
                    },
                  ]}
                  onPress={closeReminderModal}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: reminderModal.secondaryText },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.primaryButton,
                    !reminderName.trim() && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleCreateReminder}
                  disabled={!reminderName.trim()}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={reminderModal.actionGradient}
                    style={styles.primaryButtonInner}
                  >
                    <Text style={styles.primaryButtonText}>Add Reminder</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <PlatformDatePicker
          visible={showReminderDatePicker}
          value={reminderDate}
          onChange={handleSelectReminderDate}
          onClose={() => setShowReminderDatePicker(false)}
          accentColor={reminderModal.accent}
        />

        <PlatformTimePicker
          visible={showReminderTimePicker}
          value={reminderTime}
          onChange={handleSelectReminderTime}
          onClose={() => setShowReminderTimePicker(false)}
          options={reminderTimeOptions}
          accentColor={reminderModal.accent}
        />
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
    paddingTop: spacing.lg,
    paddingBottom: 100,
    flexGrow: 1,
  },
  sectionCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  lastCard: {
    marginBottom: spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    marginBottom: spacing.md,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionBody: {
    paddingTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: themeColors.text,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  sectionActionText: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.bodySmall,
    color: themeColors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  routineSection: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routineBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  routineName: {
    ...typography.label,
    color: themeColors.text,
  },
  routineMeta: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  routineActions: {
    flexDirection: 'row',
  },
  routineActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    borderWidth: 1,
  },
  routineTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
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
  routineTaskText: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
  },
  noTasksText: {
    ...typography.bodySmall,
    color: themeColors.textLight,
    fontStyle: 'italic',
    paddingLeft: spacing.xl,
  },
  choreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  choreGroup: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  choreGroupLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
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
  choreContent: {
    flex: 1,
  },
  choreTitle: {
    ...typography.body,
    color: themeColors.text,
  },
  choreTitleCompleted: {
    textDecorationLine: 'line-through',
    color: themeColors.textLight,
  },
  choreDate: {
    ...typography.caption,
    color: themeColors.textLight,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  reminderIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  reminderTitle: {
    ...typography.body,
    fontWeight: '500',
    color: themeColors.text,
  },
  reminderDescription: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  reminderDate: {
    ...typography.caption,
    color: themeColors.textLight,
    marginTop: spacing.xs,
  },
  groceryInputContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  groceryInput: {
    flex: 1,
    height: 44,
    backgroundColor: themeColors.inputBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: themeColors.text,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  groceryAddButton: {
    width: 44,
    height: 44,
    marginLeft: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: themeColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  groceryCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: themeColors.border,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryCheckboxChecked: {
    backgroundColor: themeColors.success,
    borderColor: themeColors.success,
  },
  groceryText: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
  },
  groceryTextCompleted: {
    textDecorationLine: 'line-through',
    color: themeColors.textLight,
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: themeColors.divider,
  },
  completedLabel: {
    ...typography.caption,
    color: themeColors.textLight,
  },
  clearText: {
    ...typography.bodySmall,
    color: themeColors.danger,
  },
  modalScreen: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.large,
  },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    minHeight: 96,
    justifyContent: 'center',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    ...typography.h2,
    color: '#FFFFFF',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  modalCloseButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalInputContainer: {
    marginBottom: spacing.md,
  },
  modalInput: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    backgroundColor: themeColors.inputBackground,
  },
  modalInputText: {
    color: themeColors.text,
  },
  quickLabel: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  quickGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  quickChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  secondaryButton: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  primaryButtonInner: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  inputLabel: {
    ...typography.label,
    color: themeColors.text,
    marginBottom: spacing.sm,
  },
  chipGroup: {
    marginBottom: spacing.lg,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: themeColors.border,
    backgroundColor: themeColors.inputBackground,
    marginBottom: spacing.md,
  },
  dateButtonText: {
    ...typography.body,
    color: themeColors.text,
  },
  placeholderText: {
    color: themeColors.placeholder,
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
