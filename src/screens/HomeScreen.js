import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows, borderRadius, spacing, typography } from '../utils/theme';

const MOOD_OPTIONS = [
  { label: 'Depressed', emoji: '😞' },
  { label: 'Extremely Sad', emoji: '😢' },
  { label: 'Very Sad', emoji: '😔' },
  { label: 'Quite Sad', emoji: '🙁' },
  { label: 'Sad', emoji: '😟' },
  { label: 'Little Sad', emoji: '😕' },
  { label: 'Neutral', emoji: '😐' },
  { label: 'A Bit Happy', emoji: '🙂' },
  { label: 'Happy', emoji: '😊' },
  { label: 'Very Happy', emoji: '😄' },
  { label: 'Extremely Happy', emoji: '😁' },
  { label: 'Overjoyed', emoji: '🤩' },
];

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    themeColors,
    profile,
    habits,
    tasks,
    todayHealth,
    chores,
    reminders,
    groceries,
    notes,
    friends,
    onlineFriends,
    friendRequests,
    taskInvites,
    isUserOnline,
    getTodayTasks,
    getBestStreak,
    verifyNotePassword,
    updateNote,
    deleteNote,
    streakFrozen,
  } = useApp();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);
  const isPremium = React.useMemo(() => {
    const plan = (profile?.plan || '').toString().toLowerCase();
    const expiresAt = profile?.premium_expires_at ? new Date(profile.premium_expires_at) : null;
    const stillActive = expiresAt ? expiresAt > new Date() : false;
    return !!(profile?.isPremium || plan === 'premium' || plan === 'paid' || stillActive);
  }, [profile]);

  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const todayTasks = getTodayTasks();
  const recentHabits = habits.slice(-5).reverse();
  const upcomingChores = chores.filter((c) => !c.completed).slice(0, 3);
  const getReminderDate = (reminder) => {
    if (!reminder?.date) return new Date(reminder?.createdAt || Date.now());
    const dateString = reminder.time
      ? `${reminder.date}T${reminder.time}`
      : reminder.date;
    return new Date(dateString);
  };

  const upcomingReminders = reminders
    .slice()
    .sort((a, b) => getReminderDate(a) - getReminderDate(b))
    .slice(0, 3);
  const groceryPreview = groceries.filter((g) => !g.completed).slice(0, 3);

  const currentMood = todayHealth.mood
    ? MOOD_OPTIONS[Math.max(0, Math.min(MOOD_OPTIONS.length - 1, todayHealth.mood - 1))]
    : null;
  const bestStreak = getBestStreak ? getBestStreak() : 0;
  const streakFlameColor = streakFrozen ? '#4da6ff' : '#ff4d4f';
  const streakFlameBackground = streakFrozen ? 'rgba(77, 166, 255, 0.12)' : 'rgba(255, 77, 79, 0.12)';
  const consumedCalories = todayHealth?.calories || 0;
  const calorieGoal = profile?.dailyCalorieGoal || 2000;
  const remainingCalories = Math.max(calorieGoal - consumedCalories, 0);
  const pendingFriendRequests = friendRequests?.incoming?.length || 0;
  const pendingTaskInvites = taskInvites?.incoming?.length || 0;
  const getInitial = React.useCallback((nameValue, usernameValue) => {
    const source = (nameValue || usernameValue || '?').trim();
    return (source[0] || '?').toUpperCase();
  }, []);
  const displayedFriends = React.useMemo(() => {
    const enriched = (friends || []).map((f) => ({
      ...f,
      isOnline: isUserOnline ? isUserOnline(f.id) : false,
    }));
    enriched.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      const aName = (a.username || a.name || '').toLowerCase();
      const bName = (b.username || b.name || '').toLowerCase();
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });
    return enriched.slice(0, 20);
  }, [friends, isUserOnline]);
  const [selectedNote, setSelectedNote] = React.useState(null);
  const [noteToUnlock, setNoteToUnlock] = React.useState(null);
  const [notePasswordInput, setNotePasswordInput] = React.useState('');
  const [notePasswordError, setNotePasswordError] = React.useState('');
  const [unlockedNoteIds, setUnlockedNoteIds] = React.useState([]);
  const [focusToast, setFocusToast] = React.useState(route.params?.focusToast || '');
  const [noteTitleDraft, setNoteTitleDraft] = React.useState('');
  const [noteContentDraft, setNoteContentDraft] = React.useState('');
  const [showStreakFrozenModal, setShowStreakFrozenModal] = React.useState(false);

  const sortedNotes = React.useMemo(() => {
    return (notes || [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, 3);
  }, [notes]);

  React.useEffect(() => {
    if (route.params?.focusToast) {
      setFocusToast(route.params.focusToast);
      const timer = setTimeout(() => setFocusToast(''), 4500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [route.params?.focusToast]);

  React.useEffect(() => {
    if (streakFrozen) {
      setShowStreakFrozenModal(true);
    } else {
      setShowStreakFrozenModal(false);
    }
  }, [streakFrozen]);

  const sectionButtons = [
    {
      id: 'habits',
      label: 'Habits',
      icon: 'target',
      iconType: 'feather',
      color: colors.habits,
      screen: 'Habits',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: 'edit-3',
      iconType: 'feather',
      color: colors.tasks,
      screen: 'Tasks',
    },
    {
      id: 'health',
      label: 'Health',
      icon: 'heart',
      iconType: 'ionicons',
      color: colors.health,
      screen: 'Health',
    },
    {
      id: 'routine',
      label: 'Routine',
      icon: 'history',
      iconType: 'material',
      color: colors.routine,
      screen: 'Routine',
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: 'trending-up',
      iconType: 'feather',
      color: colors.finance,
      screen: 'Finance',
    },
  ];

  const renderIcon = (icon, iconType, size, color) => {
    switch (iconType) {
      case 'feather':
        return <Feather name={icon} size={size} color={color} />;
      case 'material':
        return <MaterialCommunityIcons name={icon} size={size} color={color} />;
      default:
        return <Ionicons name={icon} size={size} color={color} />;
    }
  };

  const handleNotePress = (note) => {
    if (note.password && !unlockedNoteIds.includes(note.id)) {
      setNoteToUnlock(note);
      setNotePasswordInput('');
      setNotePasswordError('');
      return;
    }
    setSelectedNote(note);
    setNoteTitleDraft(note.title || '');
    setNoteContentDraft(note.content || '');
  };

  const closeNoteModal = () => {
    setSelectedNote(null);
    setNoteTitleDraft('');
    setNoteContentDraft('');
  };

  const closeUnlockModal = () => {
    setNoteToUnlock(null);
    setNotePasswordInput('');
    setNotePasswordError('');
  };

  const handleUnlockNote = () => {
    if (!noteToUnlock) return;
    const isValid = verifyNotePassword(noteToUnlock.id, notePasswordInput);
    if (!isValid) {
      setNotePasswordError('Incorrect password. Try again.');
      return;
    }
    setUnlockedNoteIds((prev) => [...prev, noteToUnlock.id]);
    setSelectedNote(noteToUnlock);
    setNoteTitleDraft(noteToUnlock.title || '');
    setNoteContentDraft(noteToUnlock.content || '');
    closeUnlockModal();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      {!!focusToast && (
        <View style={styles.focusToast}>
          <Text style={styles.focusToastText}>{focusToast}</Text>
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <View style={[styles.logoDot, { backgroundColor: colors.habits }]} />
                <View style={[styles.logoDot, { backgroundColor: colors.tasks }]} />
                <View style={[styles.logoDot, { backgroundColor: colors.health }]} />
                <View style={[styles.logoDot, { backgroundColor: colors.routine }]} />
              </View>
              <Text style={styles.logoText}>Pillr</Text>
            </View>
            <View style={styles.headerRight}>
              {isPremium && (
                <View style={styles.premiumHeaderBadge}>
                  <Ionicons name="star" size={14} color="#f1c232" style={styles.premiumHeaderIcon} />
                  <Text style={styles.premiumHeaderText}>Premium</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.navigate('NotificationCenter')}
              >
                <View>
                  <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                  {(pendingFriendRequests > 0 || pendingTaskInvites > 0) && (
                    <View style={styles.notificationDot} />
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => navigation.navigate('Profile')}
              >
                {profile.photo ? (
                <Image source={{ uri: profile.photo }} style={styles.profileImage} />
              ) : (
                <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Shortcuts */}
        <View style={styles.sectionButtonsContainer}>
          {sectionButtons.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={styles.sectionButton}
              onPress={() => navigation.navigate(section.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.sectionIconContainer, { backgroundColor: `${section.color}15` }]}>
                {renderIcon(section.icon, section.iconType, 24, section.color)}
              </View>
              <Text style={styles.sectionLabel}>{section.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Best Streak + Calories */}
        <View style={styles.topStatsRow}>
          <Card style={[styles.sectionCard, styles.bestStreakCard]}>
            <View style={styles.bestStreakRow}>
              <View style={[styles.bestStreakIconWrap, { backgroundColor: streakFlameBackground }]}>
                <Ionicons name="flame" size={24} color={streakFlameColor} />
              </View>
              <View style={styles.bestStreakTextWrap}>
                <Text style={styles.bestStreakLabel}>Best streak</Text>
                <Text style={styles.bestStreakValue}>{bestStreak} day{bestStreak === 1 ? '' : 's'}</Text>
              </View>
            </View>
          </Card>

          <Card style={[styles.sectionCard, styles.caloriesCard]}>
            <View style={styles.caloriesRow}>
              <View style={styles.caloriesIconWrap}>
                <Ionicons name="heart" size={22} color={colors.success} />
              </View>
              <View style={styles.caloriesTextWrap}>
                <Text style={styles.caloriesLabel}>Remaining calories</Text>
                <Text style={styles.caloriesValue}>{remainingCalories}</Text>
                <Text style={styles.caloriesGoalText}>Goal {calorieGoal}</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Friends */}
        <Card style={[styles.sectionCard, styles.onlineFriendsCard]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Friends')}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, styles.onlineFriendsTitle]}>Friends</Text>
            </View>
            {friends.length === 0 ? (
              <View style={styles.onlineFriendsBody}>
                <Text style={styles.onlineFriendsText}>Find friends to see who is online.</Text>
                <Text style={styles.onlineFriendsSubtext}>Tap to search by username.</Text>
              </View>
            ) : (
              <View style={styles.onlineFriendsRow}>
                {displayedFriends.map((friend) => (
                  <View key={friend.id} style={styles.onlineFriendItem}>
                    <View style={styles.onlineAvatarWrap}>
                      {friend.avatarUrl ? (
                        <Image source={{ uri: friend.avatarUrl }} style={styles.onlineAvatar} />
                      ) : (
                        <View style={styles.onlineAvatarFallback}>
                          <Text style={styles.onlineAvatarInitial}>
                            {getInitial(friend.name, friend.username)}
                          </Text>
                        </View>
                      )}
                      {friend.isOnline && <View style={styles.onlineDot} />}
                    </View>
                    <Text style={styles.onlineName} numberOfLines={1}>
                      {friend.username || friend.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        </Card>

        {/* Focus Mode + Countdown */}
        <View style={styles.topStatsRow}>
          <Card style={[styles.sectionCard, styles.focusCard]}>
            <TouchableOpacity
              style={styles.focusRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('FocusMode')}
            >
              <View style={styles.focusIconWrap}>
                <Ionicons name="timer" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.focusTextWrap}>
                <Text style={styles.focusLabel}>Focus mode</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </Card>

          <Card style={[styles.sectionCard, styles.countdownCard]}>
            <TouchableOpacity
              style={styles.focusRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('CountdownTimer')}
            >
              <View style={styles.focusIconWrap}>
                <Ionicons name="hourglass" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.focusTextWrap}>
                <Text style={styles.focusLabel}>Countdown Timer</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Premium Upsell for free users */}
        {!isPremium && (
          <LinearGradient
            colors={['#fbe7a1', '#f5c542', '#f3b11c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumUpsell}
          >
            <View style={styles.premiumShine} />
            <View style={styles.premiumIconWrap}>
              <Ionicons name="star" size={28} color="#b8860b" />
            </View>
            <View style={styles.premiumTextWrap}>
              <Text style={styles.premiumTitle}>Upgrade to Premium!</Text>
              <Text style={styles.premiumSubtitle}>
                Unlock the AI agent and premium features tailored to power up your day.
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* Upcoming Reminders */}
        <Card
          style={[styles.sectionCard, styles.remindersCard]}
          onPress={() => navigation.navigate('Routine')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.remindersTitle]}>Reminders</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {upcomingReminders.length === 0 ? (
            <Text style={[styles.emptyText, styles.remindersText]}>No reminders available</Text>
          ) : (
            <View style={styles.reminderList}>
              {upcomingReminders.map((reminder) => (
                <View key={reminder.id} style={styles.reminderItem}>
                  <View style={styles.reminderIcon}>
                    <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.reminderContent}>
                    <Text style={[styles.reminderTitle, styles.remindersText]} numberOfLines={1}>
                      {reminder.title}
                    </Text>
                    {(reminder.date || reminder.time) && (
                      <Text style={[styles.reminderMeta, styles.remindersMeta]}>
                        {reminder.date}
                        {reminder.time ? ` • ${reminder.time}` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Today's Overview */}
        <Card
          style={[styles.sectionCard, styles.tasksOverviewCard]}
          onPress={() => navigation.navigate('Tasks')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.tasksOverviewTitle]}>Today's Overview</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          <Text style={[styles.dateText, styles.tasksOverviewMeta]}>{formattedDate}</Text>
          {todayTasks.length > 0 ? (
            <View style={styles.tasksList}>
              {todayTasks.slice(0, 3).map((task) => (
                <View key={task.id} style={styles.taskItem}>
                  <View style={[styles.taskDot, styles.tasksOverviewDot]} />
                  <Text style={[styles.taskText, styles.tasksOverviewText]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.time && (
                    <Text style={[styles.taskTime, styles.tasksOverviewMeta]}>{task.time}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, styles.tasksOverviewText]}>No tasks scheduled for today</Text>
          )}
        </Card>

        {/* Quick Notes */}
        <Card style={[styles.sectionCard, styles.quickNotesCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Quick Notes</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
          {sortedNotes.length === 0 ? (
            <Text style={styles.emptyText}>No notes yet</Text>
          ) : (
            sortedNotes.map((note) => (
              <TouchableOpacity
                key={note.id}
                style={styles.quickNoteRow}
                onPress={() => handleNotePress(note)}
                activeOpacity={0.7}
              >
                <View style={styles.quickNoteInfo}>
                  <Text style={styles.quickNoteTitle} numberOfLines={1}>
                    {note.title || 'Untitled note'}
                  </Text>
                  <Text style={styles.quickNoteExcerpt} numberOfLines={1}>
                    {note.content ? note.content : 'Tap to view'}
                  </Text>
                </View>
                {note.password && (
                  <Ionicons name="lock-closed" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Note detail modal */}
        <Modal
          visible={!!selectedNote}
          animationType="slide"
          onRequestClose={closeNoteModal}
          presentationStyle="fullScreen"
        >
          <View style={[styles.fullScreenModal, { backgroundColor: themeColors.background }]}>
            <View style={styles.noteHeader}>
              <TouchableOpacity onPress={closeNoteModal} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Close</Text>
              </TouchableOpacity>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => {
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
                            closeNoteModal();
                          },
                        },
                      ]
                    );
                  }}
                  style={[styles.headerButton, styles.headerDelete]}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!selectedNote) return;
                    await updateNote(selectedNote.id, {
                      title: noteTitleDraft || 'Untitled note',
                      content: noteContentDraft,
                    });
                    closeNoteModal();
                  }}
                  style={[styles.headerButton, styles.headerDone]}
                >
                  <Text style={[styles.headerButtonText, styles.doneButtonText]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView
              style={styles.noteDetailScroll}
              contentContainerStyle={styles.noteDetailContent}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                value={noteTitleDraft}
                onChangeText={setNoteTitleDraft}
                placeholder="Title"
                placeholderTextColor={colors.textSecondary}
                style={styles.noteTitleInput}
              />
              <TextInput
                value={noteContentDraft}
                onChangeText={setNoteContentDraft}
                placeholder="Start writing..."
                placeholderTextColor={colors.textSecondary}
                style={styles.noteContentInput}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>
          </View>
        </Modal>

        {/* Unlock modal */}
        <Modal
          visible={!!noteToUnlock}
          transparent
          animationType="fade"
          onRequestClose={closeUnlockModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Unlock note</Text>
              <Text style={styles.modalContent}>Enter the password to view this note.</Text>
              <TextInput
                value={notePasswordInput}
                onChangeText={(val) => {
                  setNotePasswordInput(val);
                  if (notePasswordError) setNotePasswordError('');
                }}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                style={styles.passwordInput}
              />
              {!!notePasswordError && (
                <Text style={styles.errorText}>{notePasswordError}</Text>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSecondary]}
                  onPress={closeUnlockModal}
                >
                  <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalPrimary]}
                  onPress={handleUnlockNote}
                >
                  <Text style={styles.modalButtonText}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Streak frozen modal */}
        <Modal
          visible={showStreakFrozenModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStreakFrozenModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, styles.streakFreezeCard]}>
              <View style={styles.streakFreezeHeader}>
                <View style={styles.streakFreezeIconWrap}>
                  <Ionicons name="flame" size={28} color="#4da6ff" />
                </View>
                <Text style={styles.modalTitle}>Streak frozen</Text>
              </View>
              <Text style={styles.modalContent}>
                Your streak is frozen. Complete a habit today to unfreeze it.
              </Text>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimary, styles.streakFreezeButton]}
                onPress={() => setShowStreakFrozenModal(false)}
              >
                <Text style={styles.modalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Today's Health */}
        <Card
          style={[styles.sectionCard, styles.healthCard]}
          onPress={() => navigation.navigate('Health')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.healthTitle]}>Today's Health</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {currentMood ? (
            <View style={styles.healthContent}>
              <Text style={styles.moodEmoji}>{currentMood.emoji}</Text>
              <Text style={[styles.moodLabel, styles.healthText]}>Today's mood</Text>
            </View>
          ) : (
            <View style={styles.healthPrompt}>
              <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.healthPromptText, styles.healthText]}>
                Check in with your health and mood today
              </Text>
            </View>
          )}
        </Card>

        {/* Your Habits */}
        <Card
          style={[styles.sectionCard, styles.habitsCard]}
          onPress={() => navigation.navigate('Habits')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.habitsTitle]}>Your Habits</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {recentHabits.length > 0 ? (
            <View style={styles.habitsList}>
              {recentHabits.map((habit) => (
                <View key={habit.id} style={styles.habitItem}>
                  <View style={[styles.habitDot, { backgroundColor: '#FFFFFF' }]} />
                  <Text style={[styles.habitText, styles.habitsText]} numberOfLines={1}>
                    {habit.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, styles.habitsText]}>No habits yet</Text>
          )}
        </Card>

        {/* Home & Chores */}
        <Card
          style={[styles.sectionCard, styles.lastCard, styles.choresCard]}
          onPress={() => navigation.navigate('Routine')}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.choresTitle]}>Home & Chores</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
          {upcomingChores.length > 0 || groceryPreview.length > 0 ? (
            <View>
              {upcomingChores.map((chore) => (
                <View key={chore.id} style={styles.choreItem}>
                  <Ionicons name="checkbox-outline" size={18} color="#FFFFFF" />
                  <Text style={[styles.choreText, styles.choresText]} numberOfLines={1}>
                    {chore.title}
                  </Text>
                </View>
              ))}
              {groceryPreview.length > 0 && (
                <View style={styles.groceryPreview}>
                  <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
                  <Text style={[styles.groceryText, styles.choresText]}>
                    {groceryPreview.length} item{groceryPreview.length !== 1 ? 's' : ''} on grocery list
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={[styles.emptyText, styles.choresText]}>No upcoming chores or grocery items</Text>
          )}
        </Card>

      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors) => {
  const sectionCardColor = themeColorsParam?.card || colors.card;
  const sectionBorderColor = themeColorsParam?.border || colors.border || '#E5E7EB';

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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoIcon: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 28,
      height: 28,
      marginRight: spacing.sm,
    },
    logoDot: {
      width: 12,
      height: 12,
      borderRadius: 3,
      margin: 1,
    },
    logoText: {
      ...typography.h2,
      color: colors.text,
    },
    profileButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    profileImage: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      ...shadows.small,
    },
    notificationDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.card,
    },
    sectionButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    premiumHeaderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff7e6',
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: '#f1c232',
      ...shadows.small,
    },
    premiumHeaderIcon: {
      marginRight: spacing.xs,
    },
    premiumHeaderText: {
      ...typography.caption,
      color: '#b8860b',
      fontWeight: '700',
    },
    sectionButton: {
      alignItems: 'center',
    },
    sectionIconContainer: {
      width: 52,
      height: 52,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    sectionCard: {
      marginBottom: spacing.lg,
    },
    topStatsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    lastCard: {
      marginBottom: spacing.xxxl,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      ...typography.h3,
    },
    dateText: {
      ...typography.bodySmall,
      marginBottom: spacing.md,
    },
    emptyText: {
      ...typography.bodySmall,
      color: colors.textLight,
    },
    tasksList: {
      marginTop: spacing.sm,
    },
    taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    taskDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    taskText: {
      flex: 1,
      ...typography.body,
    },
    taskTime: {
      ...typography.caption,
      marginLeft: spacing.sm,
    },
    tasksOverviewCard: {
      backgroundColor: colors.tasks,
      borderColor: colors.tasks,
    },
    tasksOverviewTitle: {
      color: '#FFFFFF',
    },
    tasksOverviewText: {
      color: '#FFFFFF',
    },
    tasksOverviewMeta: {
      color: '#FFFFFFCC',
    },
    tasksOverviewDot: {
      backgroundColor: '#FFFFFF',
    },
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodEmoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  moodLabel: {
    ...typography.body,
  },
  moodSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moodSummaryEmoji: {
    fontSize: 32,
    marginRight: spacing.sm,
  },
  moodSummaryText: {
    ...typography.body,
    fontWeight: '600',
  },
    healthPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    healthPromptText: {
      ...typography.bodySmall,
      color: colors.health,
      marginLeft: spacing.sm,
    },
    healthCard: {
      backgroundColor: colors.health,
      borderColor: colors.health,
    },
    healthTitle: {
      color: '#FFFFFF',
    },
    healthText: {
      color: '#FFFFFF',
    },
    habitsList: {
      marginTop: spacing.xs,
    },
    habitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    habitDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    habitText: {
      ...typography.body,
    },
    choreItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    choreText: {
      ...typography.body,
      marginLeft: spacing.sm,
      flex: 1,
    },
    reminderList: {
      marginTop: spacing.xs,
    },
    reminderItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: '#FFFFFF33',
    },
    reminderIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: '#FFFFFF22',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    reminderContent: {
      flex: 1,
    },
    reminderTitle: {
      ...typography.body,
      fontWeight: '600',
    },
    reminderMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    remindersCard: {
      backgroundColor: colors.routine,
      borderColor: colors.routine,
    },
    remindersTitle: {
      color: '#FFFFFF',
    },
    remindersText: {
      color: '#FFFFFF',
    },
    remindersMeta: {
      color: '#FFFFFFCC',
    },
    healthCard: {
      backgroundColor: colors.health,
      borderColor: colors.health,
    },
    healthTitle: {
      color: '#FFFFFF',
    },
    healthText: {
      color: '#FFFFFF',
    },
    groceryPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: '#FFFFFF33',
    },
    groceryText: {
      ...typography.bodySmall,
      marginLeft: spacing.sm,
    },
    choresCard: {
      backgroundColor: '#1f4f2b',
      borderColor: '#163821',
    },
    choresTitle: {
      color: '#FFFFFF',
    },
    choresText: {
      color: '#FFFFFF',
    },
    habitsCard: {
      backgroundColor: colors.habits,
      borderColor: colors.habits,
    },
    habitsTitle: {
      color: '#FFFFFF',
    },
    habitsText: {
      color: '#FFFFFF',
    },
    bestStreakCard: {
      backgroundColor: sectionCardColor,
      borderColor: sectionBorderColor,
      flex: 1,
    },
    bestStreakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
    },
    bestStreakIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255, 77, 79, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    bestStreakTextWrap: {
      flex: 1,
    },
    bestStreakLabel: {
      ...typography.bodySmall,
      color: themeColorsParam?.textSecondary || colors.textSecondary,
      marginBottom: 2,
    },
    bestStreakValue: {
      ...typography.h2,
      color: themeColorsParam?.text || colors.text,
    },
    caloriesCard: {
      backgroundColor: sectionCardColor,
      borderColor: sectionBorderColor,
      flex: 1,
    },
    caloriesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
    },
    onlineFriendsCard: {
      backgroundColor: sectionCardColor,
      borderColor: sectionBorderColor,
      paddingHorizontal: 0,
    },
    onlineFriendsTitle: {
      color: themeColorsParam?.text || colors.text,
      marginLeft: spacing.md,
    },
    onlineFriendsBody: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    onlineFriendsText: {
      ...typography.body,
      color: themeColorsParam?.textSecondary || colors.textSecondary,
    },
    onlineFriendsSubtext: {
      ...typography.bodySmall,
      color: themeColorsParam?.textSecondary || colors.textSecondary,
    },
    onlineFriendsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      rowGap: spacing.md,
    },
    onlineFriendItem: {
      alignItems: 'center',
      marginRight: spacing.md,
      width: 72,
    },
    onlineAvatarWrap: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    onlineAvatar: {
      width: '100%',
      height: '100%',
    },
    onlineAvatarFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.primary}15`,
    },
    onlineAvatarInitial: {
      ...typography.h4,
      color: themeColorsParam?.text || colors.text,
    },
    onlineDot: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      width: 14,
      height: 14,
      borderRadius: borderRadius.full,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: sectionCardColor,
    },
    onlineName: {
      ...typography.bodySmall,
      color: themeColorsParam?.text || colors.text,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    caloriesIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: `${colors.success}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    caloriesTextWrap: {
      flex: 1,
    },
    caloriesLabel: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    caloriesValue: {
      ...typography.h2,
      color: colors.text,
    },
    caloriesGoalText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    quickNotesCard: {
      backgroundColor: themeColorsParam?.card || colors.card,
      borderColor: themeColorsParam?.border || colors.border || '#E5E7EB',
    },
    focusCard: {
      backgroundColor: '#2e2eb8',
      borderColor: '#2e2eb8',
      flex: 1,
    },
    focusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
    },
    focusIconWrap: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    focusTextWrap: {
      flex: 1,
    },
    focusLabel: {
      ...typography.bodySmall,
      color: '#FFFFFF',
      marginBottom: 2,
    },
    focusValue: {
      ...typography.h2,
      color: '#FFFFFF',
    },
    countdownCard: {
      backgroundColor: '#4d2600',
      borderColor: '#4d2600',
      flex: 1,
    },
    focusButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
    },
    focusButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '700',
    },
    focusButtonTextSecondary: {
      ...typography.body,
      color: colors.text,
      fontWeight: '700',
    },
    focusActions: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: spacing.sm,
    },
    focusSecondary: {
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: sectionBorderColor,
    },
    focusExit: {
      backgroundColor: colors.danger,
    },
    quickNoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    quickNoteInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    quickNoteTitle: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    quickNoteExcerpt: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginTop: 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      width: '100%',
      borderRadius: borderRadius.xl,
      backgroundColor: themeColorsParam?.card || colors.card,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border || '#E5E7EB',
    },
    modalTitle: {
      ...typography.h3,
      marginBottom: spacing.sm,
      color: colors.text,
    },
    modalContent: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
    },
    modalButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
    },
    modalPrimary: {
      backgroundColor: colors.primary,
    },
    modalSecondary: {
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    modalButtonText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
    modalButtonTextSecondary: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    streakFreezeCard: {
      borderColor: '#4da6ff',
      borderWidth: 1,
    },
    streakFreezeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    streakFreezeIconWrap: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(77, 166, 255, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    streakFreezeButton: {
      marginTop: spacing.sm,
    },
    passwordInput: {
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border || '#E5E7EB',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      color: colors.text,
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
      marginBottom: spacing.sm,
    },
    fullScreenModal: {
      flex: 1,
    },
    headerButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    headerButtonText: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
    },
    doneButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    noteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl * 3 + spacing.sm,
      paddingBottom: spacing.md,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerDelete: {
      marginRight: spacing.sm,
    },
    headerDone: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    noteDetailScroll: {
      flex: 1,
    },
    noteDetailContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl + spacing.sm,
      paddingBottom: spacing.xl,
    },
    noteTitleInput: {
      ...typography.h2,
      color: colors.text,
      marginBottom: spacing.md,
    },
    noteContentInput: {
      ...typography.body,
      color: colors.text,
      flex: 1,
      padding: spacing.md,
      backgroundColor: 'transparent',
      lineHeight: 22,
    },
    deleteText: {
      ...typography.body,
      color: colors.danger,
      fontWeight: '600',
    },
    premiumUpsell: {
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: '#b8860b',
      borderWidth: 3,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      ...shadows.large,
      overflow: 'hidden',
      position: 'relative',
    },
    premiumIconWrap: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: '#f1c232',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.lg,
      borderWidth: 2,
      borderColor: '#b8860b',
    },
    premiumShine: {
      position: 'absolute',
      top: 0,
      left: -120,
      width: 160,
      height: '120%',
      backgroundColor: 'rgba(255,255,255,0.35)',
      transform: [{ rotate: '20deg' }],
    },
    premiumTextWrap: {
      flex: 1,
    },
    premiumTitle: {
      ...typography.h2,
      color: '#4a3b00',
      marginBottom: spacing.xs,
    },
    premiumSubtitle: {
      ...typography.body,
      color: '#4a3b00',
    },
    focusToast: {
      position: 'absolute',
      top: spacing.xxxl * 2,
      left: spacing.xl,
      right: spacing.xl,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xl,
      ...shadows.medium,
      zIndex: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    focusToastText: {
      ...typography.h3,
      color: colors.text,
      textAlign: 'center',
      fontWeight: '700',
    },
  });
};

export default HomeScreen;
