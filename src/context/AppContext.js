import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../utils/theme';
import themePresets from '../utils/themePresets.json';
import { supabase } from '../utils/supabaseClient';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

const STORAGE_KEYS = {
  HABITS: '@pillr_habits',
  TASKS: '@pillr_tasks',
  NOTES: '@pillr_notes',
  HEALTH: '@pillr_health',
  ROUTINES: '@pillr_routines',
  CHORES: '@pillr_chores',
  REMINDERS: '@pillr_reminders',
  GROCERIES: '@pillr_groceries',
  FINANCES: '@pillr_finances',
  PROFILE: '@pillr_profile',
  THEME: '@pillr_theme',
  AUTH_USER: '@pillr_auth_user',
  AUTH_USERS: '@pillr_auth_users',
  ONBOARDING: '@pillr_onboarding_complete',
};

const defaultProfile = {
  name: 'User',
  email: 'user@pillr.app',
  photo: null,
  dailyCalorieGoal: 2000,
  dailyWaterGoal: 8,
  dailySleepGoal: 8,
};


export const AppProvider = ({ children }) => {
  // Habits State
  const [habits, setHabits] = useState([]);
  const [habitCompletions, setHabitCompletions] = useState({});

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);

  // Health State
  const [healthData, setHealthData] = useState({});
  const [todayHealth, setTodayHealth] = useState({
    mood: null,
    energy: 3,
    waterIntake: 0,
    sleepTime: null,
    wakeTime: null,
    sleepQuality: null,
    calories: 0,
    foods: [],
  });

  // Routine State
  const [routines, setRoutines] = useState([]);
  const [chores, setChores] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [groceries, setGroceries] = useState([]);

  // Finance State
  const [finances, setFinances] = useState([]);

  // Profile State
  const [profile, setProfile] = useState(defaultProfile);

  // Auth State
  const [authUser, setAuthUser] = useState(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [themeName, setThemeName] = useState('default');
  const [themeColors, setThemeColors] = useState({ ...colors });

  // Loading State
  const [isLoading, setIsLoading] = useState(true);

  // Immutable snapshots of the original palettes and typography
  const defaultPaletteRef = useRef(
    JSON.parse(JSON.stringify(themePresets?.default?.colors || colors))
  );
  const darkPaletteRef = useRef(
    JSON.parse(JSON.stringify(themePresets?.dark?.colors || colors))
  );
  const baseTypographySnapshot = useRef(JSON.parse(JSON.stringify(typography)));

  const applyTheme = (name) => {
    const palette =
      name === 'dark' ? darkPaletteRef.current : defaultPaletteRef.current;

    // Reset shared colors to pristine default, then apply chosen palette
    Object.entries(defaultPaletteRef.current).forEach(([key, value]) => {
      colors[key] = value;
    });
    Object.entries(palette).forEach(([key, value]) => {
      colors[key] = value;
    });
    setThemeColors({ ...palette });

    // Reset typography and apply palette text colors
    Object.entries(baseTypographySnapshot.current).forEach(([key, value]) => {
      const isMuted = key === 'bodySmall' || key === 'caption';
      typography[key] = {
        ...value,
        color: isMuted ? (palette.textSecondary || palette.text) : palette.text,
      };
    });
  };

  // Load data from AsyncStorage on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
  try {
    const [
      storedHabits,
      storedTasks,
      storedNotes,
      storedHealth,
      storedRoutines,
      storedChores,
      storedReminders,
      storedGroceries,
      storedFinances,
      storedProfile,
      storedOnboarding,
      storedTheme,
    ] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.HABITS),
      AsyncStorage.getItem(STORAGE_KEYS.TASKS),
      AsyncStorage.getItem(STORAGE_KEYS.NOTES),
      AsyncStorage.getItem(STORAGE_KEYS.HEALTH),
      AsyncStorage.getItem(STORAGE_KEYS.ROUTINES),
      AsyncStorage.getItem(STORAGE_KEYS.CHORES),
      AsyncStorage.getItem(STORAGE_KEYS.REMINDERS),
      AsyncStorage.getItem(STORAGE_KEYS.GROCERIES),
      AsyncStorage.getItem(STORAGE_KEYS.FINANCES),
      AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
      AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
      AsyncStorage.getItem(STORAGE_KEYS.THEME),
    ]);

    if (storedHabits) setHabits(JSON.parse(storedHabits));
    if (storedTasks) setTasks(JSON.parse(storedTasks));
    if (storedNotes) setNotes(JSON.parse(storedNotes));

    if (storedHealth) {
      const healthParsed = JSON.parse(storedHealth);
      setHealthData(healthParsed);
      const todayKey = new Date().toDateString();
      if (healthParsed[todayKey]) {
        setTodayHealth(healthParsed[todayKey]);
      }
    }

    if (storedRoutines) setRoutines(JSON.parse(storedRoutines));
    if (storedChores) setChores(JSON.parse(storedChores));
    if (storedReminders) setReminders(JSON.parse(storedReminders));
    if (storedGroceries) setGroceries(JSON.parse(storedGroceries));
    if (storedFinances) setFinances(JSON.parse(storedFinances));
    if (storedProfile) setProfile(JSON.parse(storedProfile));

    if (storedOnboarding) {
      setHasOnboarded(storedOnboarding === 'true');
    }

    const chosenTheme = storedTheme ? storedTheme : 'default';
    setThemeName(chosenTheme);
    applyTheme(chosenTheme);

    // 🔐 NEW: restore Supabase auth session if one exists
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.log('Error getting Supabase session:', sessionError);
    } else if (session?.user) {
      await setActiveUser(session.user);
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    setIsLoading(false);
  }
};


  // Save helpers
  const saveToStorage = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // HABIT FUNCTIONS
  const addHabit = async (habit) => {
    const newHabit = {
      ...habit,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      streak: 0,
      completedDates: [],
    };
    const updatedHabits = [...habits, newHabit];
    setHabits(updatedHabits);
    await saveToStorage(STORAGE_KEYS.HABITS, updatedHabits);
    return newHabit;
  };

  const updateHabit = async (habitId, updates) => {
    const updatedHabits = habits.map((h) =>
      h.id === habitId ? { ...h, ...updates } : h
    );
    setHabits(updatedHabits);
    await saveToStorage(STORAGE_KEYS.HABITS, updatedHabits);
  };

  const deleteHabit = async (habitId) => {
    const updatedHabits = habits.filter((h) => h.id !== habitId);
    setHabits(updatedHabits);
    await saveToStorage(STORAGE_KEYS.HABITS, updatedHabits);
  };

  const toggleHabitCompletion = async (habitId) => {
    const today = new Date().toDateString();
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    const isCompletedToday = habit.completedDates?.includes(today);
    let updatedHabit;

    if (isCompletedToday) {
      // Unmark completion
      updatedHabit = {
        ...habit,
        completedDates: habit.completedDates.filter((d) => d !== today),
        streak: Math.max(0, habit.streak - 1),
      };
    } else {
      // Mark as complete
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const wasCompletedYesterday = habit.completedDates?.includes(
        yesterday.toDateString()
      );

      updatedHabit = {
        ...habit,
        completedDates: [...(habit.completedDates || []), today],
        streak: wasCompletedYesterday ? habit.streak + 1 : 1,
      };
    }

    const updatedHabits = habits.map((h) =>
      h.id === habitId ? updatedHabit : h
    );
    setHabits(updatedHabits);
    await saveToStorage(STORAGE_KEYS.HABITS, updatedHabits);
  };

  const isHabitCompletedToday = (habitId) => {
    const habit = habits.find((h) => h.id === habitId);
    const today = new Date().toDateString();
    return habit?.completedDates?.includes(today) || false;
  };

  // TASK FUNCTIONS
  const addTask = async (task) => {
    const newTask = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      completed: false,
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    await saveToStorage(STORAGE_KEYS.TASKS, updatedTasks);
    return newTask;
  };

  const updateTask = async (taskId, updates) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates } : t
    );
    setTasks(updatedTasks);
    await saveToStorage(STORAGE_KEYS.TASKS, updatedTasks);
  };

  const deleteTask = async (taskId) => {
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(updatedTasks);
    await saveToStorage(STORAGE_KEYS.TASKS, updatedTasks);
  };

  const toggleTaskCompletion = async (taskId) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setTasks(updatedTasks);
    await saveToStorage(STORAGE_KEYS.TASKS, updatedTasks);
  };

  // NOTE FUNCTIONS
  const addNote = async (note) => {
    const newNote = {
      ...note,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      password: null,
    };
    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    await saveToStorage(STORAGE_KEYS.NOTES, updatedNotes);
    return newNote;
  };

  const updateNote = async (noteId, updates) => {
    const updatedNotes = notes.map((n) =>
      n.id === noteId
        ? { ...n, ...updates, updatedAt: new Date().toISOString() }
        : n
    );
    setNotes(updatedNotes);
    await saveToStorage(STORAGE_KEYS.NOTES, updatedNotes);
  };

  const deleteNote = async (noteId) => {
    const updatedNotes = notes.filter((n) => n.id !== noteId);
    setNotes(updatedNotes);
    await saveToStorage(STORAGE_KEYS.NOTES, updatedNotes);
  };

  const verifyNotePassword = (noteId, password) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return false;
    if (!note.password) return true;
    return note.password === password;
  };

  const setNotePassword = async (noteId, newPassword, currentPassword) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) throw new Error('Note not found');

    if (note.password && note.password !== currentPassword) {
      throw new Error('Incorrect password');
    }

    const updatedNotes = notes.map((n) =>
      n.id === noteId
        ? { ...n, password: newPassword || null, updatedAt: new Date().toISOString() }
        : n
    );
    setNotes(updatedNotes);
    await saveToStorage(STORAGE_KEYS.NOTES, updatedNotes);
  };

  // HEALTH FUNCTIONS
  const updateTodayHealth = async (updates) => {
    const today = new Date().toDateString();
    const newTodayHealth = { ...todayHealth, ...updates };
    setTodayHealth(newTodayHealth);

    const updatedHealthData = {
      ...healthData,
      [today]: newTodayHealth,
    };
    setHealthData(updatedHealthData);
    await saveToStorage(STORAGE_KEYS.HEALTH, updatedHealthData);
  };

  const addFoodEntry = async (food) => {
    const newFood = {
      ...food,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    const updatedFoods = [...(todayHealth.foods || []), newFood];
    const totalCalories = updatedFoods.reduce((sum, f) => sum + (f.calories || 0), 0);
    await updateTodayHealth({
      foods: updatedFoods,
      calories: totalCalories,
    });
  };

  const getAverageWater = () => {
    const entries = Object.values(healthData);
    if (entries.length === 0) return 0;
    const total = entries.reduce((sum, day) => sum + (day.waterIntake || 0), 0);
    return (total / entries.length).toFixed(1);
  };

  const getAverageSleep = () => {
    const entries = Object.values(healthData).filter(
      (day) => day.sleepTime && day.wakeTime
    );
    if (entries.length === 0) return 0;
    // Simplified calculation - would need proper time parsing in production
    return 7.5; // Placeholder
  };

  // ROUTINE FUNCTIONS
  const addRoutine = async (routine) => {
    const newRoutine = {
      ...routine,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      tasks: [],
    };
    const updatedRoutines = [...routines, newRoutine];
    setRoutines(updatedRoutines);
    await saveToStorage(STORAGE_KEYS.ROUTINES, updatedRoutines);
    return newRoutine;
  };

  const updateRoutine = async (routineId, updates) => {
    const updatedRoutines = routines.map((r) =>
      r.id === routineId ? { ...r, ...updates } : r
    );
    setRoutines(updatedRoutines);
    await saveToStorage(STORAGE_KEYS.ROUTINES, updatedRoutines);
  };

  const deleteRoutine = async (routineId) => {
    const updatedRoutines = routines.filter((r) => r.id !== routineId);
    setRoutines(updatedRoutines);
    await saveToStorage(STORAGE_KEYS.ROUTINES, updatedRoutines);
  };

  const addTaskToRoutine = async (routineId, task) => {
    const newTask = {
      ...task,
      id: Date.now().toString(),
    };
    const updatedRoutines = routines.map((r) =>
      r.id === routineId ? { ...r, tasks: [...r.tasks, newTask] } : r
    );
    setRoutines(updatedRoutines);
    await saveToStorage(STORAGE_KEYS.ROUTINES, updatedRoutines);
  };

  const removeTaskFromRoutine = async (routineId, taskId) => {
    const updatedRoutines = routines.map((r) =>
      r.id === routineId
        ? { ...r, tasks: r.tasks.filter((t) => t.id !== taskId) }
        : r
    );
    setRoutines(updatedRoutines);
    await saveToStorage(STORAGE_KEYS.ROUTINES, updatedRoutines);
  };

  const reorderRoutineTasks = async (routineId, newTaskOrder) => {
    const updatedRoutines = routines.map((r) =>
      r.id === routineId ? { ...r, tasks: newTaskOrder } : r
    );
    setRoutines(updatedRoutines);
    await saveToStorage(STORAGE_KEYS.ROUTINES, updatedRoutines);
  };

  // CHORE FUNCTIONS
  const addChore = async (chore) => {
    const newChore = {
      ...chore,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      completed: false,
    };
    const updatedChores = [...chores, newChore];
    setChores(updatedChores);
    await saveToStorage(STORAGE_KEYS.CHORES, updatedChores);
    return newChore;
  };

  const updateChore = async (choreId, updates) => {
    const updatedChores = chores.map((c) =>
      c.id === choreId ? { ...c, ...updates } : c
    );
    setChores(updatedChores);
    await saveToStorage(STORAGE_KEYS.CHORES, updatedChores);
  };

  const deleteChore = async (choreId) => {
    const updatedChores = chores.filter((c) => c.id !== choreId);
    setChores(updatedChores);
    await saveToStorage(STORAGE_KEYS.CHORES, updatedChores);
  };

  // REMINDER FUNCTIONS
  const addReminder = async (reminder) => {
    const newReminder = {
      ...reminder,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const updatedReminders = [...reminders, newReminder];
    setReminders(updatedReminders);
    await saveToStorage(STORAGE_KEYS.REMINDERS, updatedReminders);
    return newReminder;
  };

  const deleteReminder = async (reminderId) => {
    const updatedReminders = reminders.filter((r) => r.id !== reminderId);
    setReminders(updatedReminders);
    await saveToStorage(STORAGE_KEYS.REMINDERS, updatedReminders);
  };

  // GROCERY FUNCTIONS
  const addGroceryItem = async (item) => {
    const newItem = {
      name: item,
      id: Date.now().toString(),
      completed: false,
    };
    const updatedGroceries = [...groceries, newItem];
    setGroceries(updatedGroceries);
    await saveToStorage(STORAGE_KEYS.GROCERIES, updatedGroceries);
    return newItem;
  };

  const toggleGroceryItem = async (itemId) => {
    const updatedGroceries = groceries.map((g) =>
      g.id === itemId ? { ...g, completed: !g.completed } : g
    );
    setGroceries(updatedGroceries);
    await saveToStorage(STORAGE_KEYS.GROCERIES, updatedGroceries);
  };

  const deleteGroceryItem = async (itemId) => {
    const updatedGroceries = groceries.filter((g) => g.id !== itemId);
    setGroceries(updatedGroceries);
    await saveToStorage(STORAGE_KEYS.GROCERIES, updatedGroceries);
  };

  const clearCompletedGroceries = async () => {
    const updatedGroceries = groceries.filter((g) => !g.completed);
    setGroceries(updatedGroceries);
    await saveToStorage(STORAGE_KEYS.GROCERIES, updatedGroceries);
  };

  // FINANCE FUNCTIONS
  const addTransaction = async (transaction) => {
    const newTransaction = {
      ...transaction,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const updatedFinances = [...finances, newTransaction];
    setFinances(updatedFinances);
    await saveToStorage(STORAGE_KEYS.FINANCES, updatedFinances);
    return newTransaction;
  };

  const deleteTransaction = async (transactionId) => {
    const updatedFinances = finances.filter((f) => f.id !== transactionId);
    setFinances(updatedFinances);
    await saveToStorage(STORAGE_KEYS.FINANCES, updatedFinances);
  };

  const getTransactionsForDate = (date) => {
    const dateString = new Date(date).toDateString();
    return finances.filter(
      (f) => new Date(f.date).toDateString() === dateString
    );
  };

  const getFinanceSummaryForDate = (date) => {
    const transactions = getTransactionsForDate(date);
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      income,
      expenses,
      balance: income - expenses,
    };
  };

  // PROFILE FUNCTIONS
  const updateProfile = async (updates) => {
    const updatedProfile = { ...profile, ...updates };
    setProfile(updatedProfile);
    await saveToStorage(STORAGE_KEYS.PROFILE, updatedProfile);
  };

  // AUTH FUNCTIONS
const persistOnboarding = async (value) => {
  setHasOnboarded(value);
  await AsyncStorage.setItem(
    STORAGE_KEYS.ONBOARDING,
    value ? 'true' : 'false'
  );
};

const setActiveUser = async (user) => {
  // `user` is a Supabase auth user object
  setAuthUser(user);

  // optional: keep a copy of the user object if you ever want it offline
  await saveToStorage(STORAGE_KEYS.AUTH_USER, user);

  setProfile((prev) => ({
    ...prev,
    name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      prev.name,
    email: user.email || prev.email,
  }));

  await persistOnboarding(true);
};

const signIn = async ({ identifier, password }) => {
  // `identifier` is now the EMAIL the user signed up with
  const email = identifier?.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message || 'Unable to sign in.');
  }

  const { user } = data;
  await setActiveUser(user);
  return user;
};

const signUp = async ({ fullName, username, email, password }) => {
  const trimmedEmail = email?.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: {
        full_name: fullName,
        username,
      },
    },
  });

  if (error) {
    throw new Error(error.message || 'Unable to create account.');
  }

  const { user } = data;

  // Depending on your email confirmation settings,
  // user may be null until they confirm – but your UI will still show a success.
  if (user) {
    await setActiveUser(user);
  }

  return user;
};

const signOut = async () => {
  await supabase.auth.signOut();
  setAuthUser(null);
  await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_USER);

  await persistOnboarding(false);
  setProfile(defaultProfile);
  await saveToStorage(STORAGE_KEYS.PROFILE, defaultProfile);
};


  const changeTheme = async (name) => {
    setThemeName(name);
    applyTheme(name);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, name);
  };

  // COMPUTED VALUES
  const getBestStreak = () => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map((h) => h.streak || 0));
  };

  const getTodayHabitsCount = () => {
    const today = new Date().toDateString();
    const completedToday = habits.filter((h) =>
      h.completedDates?.includes(today)
    ).length;
    return `${completedToday}/${habits.length}`;
  };

  const getTodayTasks = () => {
    const today = new Date().toDateString();
    return tasks.filter(
      (t) => new Date(t.date).toDateString() === today && !t.completed
    );
  };

  const getUpcomingTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks
      .filter((t) => new Date(t.date) >= today && !t.completed)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const value = {
    // Loading
    isLoading,

    // Habits
    habits,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    isHabitCompletedToday,
    getBestStreak,
    getTodayHabitsCount,

    // Tasks
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    getTodayTasks,
    getUpcomingTasks,

    // Notes
    notes,
    addNote,
    updateNote,
    deleteNote,
    verifyNotePassword,
    setNotePassword,

    // Health
    healthData,
    todayHealth,
    updateTodayHealth,
    addFoodEntry,
    getAverageWater,
    getAverageSleep,

    // Routines
    routines,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    addTaskToRoutine,
    removeTaskFromRoutine,
    reorderRoutineTasks,

    // Chores
    chores,
    addChore,
    updateChore,
    deleteChore,

    // Reminders
    reminders,
    addReminder,
    deleteReminder,

    // Groceries
    groceries,
    addGroceryItem,
    toggleGroceryItem,
    deleteGroceryItem,
    clearCompletedGroceries,

    // Finances
    finances,
    addTransaction,
    deleteTransaction,
    getTransactionsForDate,
    getFinanceSummaryForDate,

    // Profile
    profile,
    updateProfile,

    // Auth
    authUser,
    authUsers,
    hasOnboarded,
    signIn,
    signUp,
    signOut,
    persistOnboarding,

    // Theme
    themeName,
    themeColors,
    changeTheme,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
