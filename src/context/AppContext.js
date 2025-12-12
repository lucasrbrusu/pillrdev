import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../utils/theme';
import themePresets from '../utils/themePresets';
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
  HEALTH_FOOD_LOGS: '@pillr_health_food_logs',
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
  const [foodLogs, setFoodLogs] = useState({});

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

  // Load basic cached data and restore Supabase session on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
  try {
    // Only load things we still keep in AsyncStorage:
    // profile, onboarding flag, theme, local food logs
    const [storedProfile, storedOnboarding, storedTheme, storedFoodLogs] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
      AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
      AsyncStorage.getItem(STORAGE_KEYS.THEME),
      AsyncStorage.getItem(STORAGE_KEYS.HEALTH_FOOD_LOGS),
    ]);

    if (storedProfile) {
      setProfile(JSON.parse(storedProfile));
    }

    if (storedOnboarding) {
      setHasOnboarded(storedOnboarding === 'true');
    }

    const chosenTheme = storedTheme ? storedTheme : 'default';
    setThemeName(chosenTheme);
    applyTheme(chosenTheme);

    if (storedFoodLogs) {
      try {
        setFoodLogs(JSON.parse(storedFoodLogs));
      } catch (err) {
        console.log('Error parsing stored food logs', err);
      }
    }

    // 🔐 Restore Supabase session (if user was logged in before)
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.log('Error getting Supabase session:', error);
    } else if (session?.user) {
      await setActiveUser(session.user);
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    setIsLoading(false);
  }
};

const loadUserDataFromSupabase = async (userId) => {
  try {
    await Promise.all([
      fetchHabitsFromSupabase(userId),
      fetchTasksFromSupabase(userId),
      fetchNotesFromSupabase(userId),
      fetchHealthFromSupabase(userId),
      fetchRoutinesFromSupabase(userId),
      fetchChoresFromSupabase(userId),
      fetchRemindersFromSupabase(userId),
      fetchGroceriesFromSupabase(userId),
      fetchFinancesFromSupabase(userId),
    ]);
  } catch (error) {
    console.error('Error loading user data from Supabase:', error);
  }
};

 useEffect(() => {
    if (authUser?.id) {
      // User logged in → load their data from Supabase
      loadUserDataFromSupabase(authUser.id);
    } else {
      // User logged out → clear in-memory state
      setHabits([]);
      setTasks([]);
      setNotes([]);
      setHealthData({});
      setTodayHealth({
        mood: null,
        energy: 3,
        waterIntake: 0,
        sleepTime: null,
        wakeTime: null,
        sleepQuality: null,
        calories: 0,
        foods: [],
      });
      setRoutines([]);
      setChores([]);
      setReminders([]);
      setGroceries([]);
      setFinances([]);
    }
  }, [authUser]);

  // Save helpers
  const saveToStorage = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

const fetchHabitsFromSupabase = async (userId) => {
  // Get all habits
  const { data: habitRows, error: habitError } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (habitError) {
    console.log('Error fetching habits:', habitError);
    return;
  }

  // Get all completions for this user
  const { data: completionRows, error: completionError } = await supabase
    .from('habit_completions')
    .select('habit_id, date')
    .eq('user_id', userId);

  if (completionError) {
    console.log('Error fetching habit completions:', completionError);
  }

  const completedByHabit = {};
  (completionRows || []).forEach((row) => {
    const key = row.habit_id;
    const dateString = new Date(row.date).toDateString();
    if (!completedByHabit[key]) completedByHabit[key] = [];
    completedByHabit[key].push(dateString);
  });

  const mappedHabits = (habitRows || []).map((h) => ({
    id: h.id,
    title: h.title,
    category: h.category,
    description: h.description,
    repeat: h.repeat,
    days: h.days || [],
    streak: h.streak || 0,
    createdAt: h.created_at,
    completedDates: completedByHabit[h.id] || [],
  }));

  setHabits(mappedHabits);
};



  // HABIT FUNCTIONS
const addHabit = async (habit) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a habit.');
  }

  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: authUser.id,
      title: habit.title,
      category: habit.category || 'Personal',
      description: habit.description || null,
      repeat: habit.repeat || 'Daily',
      days: habit.days || [],
      streak: 0,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding habit:', error);
    throw error;
  }

  const newHabit = {
    ...habit,
    id: data.id,
    createdAt: data.created_at,
    streak: data.streak || 0,
    completedDates: [],
  };

  setHabits((prev) => [...prev, newHabit]);
  return newHabit;
};

const updateHabit = async (habitId, updates) => {
  if (!authUser?.id) return;

  const updateData = {};
  ['title', 'category', 'description', 'repeat', 'days', 'streak'].forEach(
    (key) => {
      if (updates[key] !== undefined) {
        updateData[key] = updates[key];
      }
    }
  );

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('habits')
      .update(updateData)
      .eq('id', habitId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error updating habit:', error);
    }
  }

  setHabits((prev) =>
    prev.map((h) => (h.id === habitId ? { ...h, ...updates } : h))
  );
};

const deleteHabit = async (habitId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting habit:', error);
  }

  setHabits((prev) => prev.filter((h) => h.id !== habitId));
};

const toggleHabitCompletion = async (habitId) => {
  if (!authUser?.id) return;

  const today = new Date();
  const todayKey = today.toDateString();
  const todayISO = today.toISOString().slice(0, 10);

  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  const isCompletedToday = habit.completedDates?.includes(todayKey);

  if (isCompletedToday) {
    // Remove completion for today
    const { error } = await supabase
      .from('habit_completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('user_id', authUser.id)
      .eq('date', todayISO);

    if (error) {
      console.log('Error removing habit completion:', error);
      return;
    }

    const newCompletedDates = habit.completedDates.filter(
      (d) => d !== todayKey
    );

    const updatedHabit = {
      ...habit,
      completedDates: newCompletedDates,
      streak: Math.max((habit.streak || 0) - 1, 0),
    };

    setHabits((prev) =>
      prev.map((h) => (h.id === habitId ? updatedHabit : h))
    );

    await supabase
      .from('habits')
      .update({ streak: updatedHabit.streak })
      .eq('id', habitId)
      .eq('user_id', authUser.id);

    return;
  }

  // Mark as completed for today
  const { error } = await supabase
    .from('habit_completions')
    .insert({
      habit_id: habitId,
      user_id: authUser.id,
      date: todayISO,
    });

  if (error) {
    console.log('Error adding habit completion:', error);
    return;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();
  const wasCompletedYesterday = habit.completedDates?.includes(yesterdayKey);

  const newStreak = wasCompletedYesterday ? (habit.streak || 0) + 1 : 1;
  const newCompletedDates = [...(habit.completedDates || []), todayKey];

  const updatedHabit = {
    ...habit,
    completedDates: newCompletedDates,
    streak: newStreak,
  };

  setHabits((prev) =>
    prev.map((h) => (h.id === habitId ? updatedHabit : h))
  );

  await supabase
    .from('habits')
    .update({ streak: newStreak })
    .eq('id', habitId)
    .eq('user_id', authUser.id);
};

const isHabitCompletedToday = (habitId) => {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return false;
  const today = new Date().toDateString();
  return habit.completedDates?.includes(today) || false;
};

const fetchTasksFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.log('Error fetching tasks:', error);
    return;
  }

  const mappedTasks = (data || []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority || 'medium',
    date: t.date, // stored as date string YYYY-MM-DD
    time: t.time,
    completed: t.completed,
    createdAt: t.created_at,
  }));

  setTasks(mappedTasks);
};



  // TASK FUNCTIONS
  const addTask = async (task) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a task.');
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: authUser.id,
      title: task.title,
      description: task.description || null,
      priority: task.priority || 'medium',
      date: task.date || null,
      time: task.time || null,
      completed: false,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding task:', error);
    throw error;
  }

  const newTask = {
    id: data.id,
    title: data.title,
    description: data.description,
    priority: data.priority,
    date: data.date,
    time: data.time,
    completed: data.completed,
    createdAt: data.created_at,
  };

  setTasks((prev) => [...prev, newTask]);
  return newTask;
};


//Updates task
  const updateTask = async (taskId, updates) => {
  if (!authUser?.id) return;

  const updateData = {};
  ['title', 'description', 'priority', 'date', 'time', 'completed'].forEach(
    (key) => {
      if (updates[key] !== undefined) {
        updateData[key] = updates[key];
      }
    }
  );

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error updating task:', error);
    }
  }

  setTasks((prev) =>
    prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
  );
};




//Deletes task

  const deleteTask = async (taskId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting task:', error);
  }

  setTasks((prev) => prev.filter((t) => t.id !== taskId));
};



  //Completes task
  const toggleTaskCompletion = async (taskId) => {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !authUser?.id) return;

  const newCompleted = !task.completed;

  const { error } = await supabase
    .from('tasks')
    .update({ completed: newCompleted })
    .eq('id', taskId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error toggling task completion:', error);
    return;
  }

  setTasks((prev) =>
    prev.map((t) =>
      t.id === taskId ? { ...t, completed: newCompleted } : t
    )
  );
};

//Fetch Notes
const fetchNotesFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching notes:', error);
    return;
  }

  const mappedNotes = (data || []).map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    password: n.password_hash || null, // not secure yet, but matches your existing shape
    createdAt: n.created_at,
    updatedAt: n.updated_at || n.created_at,
  }));

  setNotes(mappedNotes);
};





  // NOTE FUNCTIONS
  // NOTE FUNCTIONS
const addNote = async (note) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a note.');
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: authUser.id,
      title: note.title,
      content: note.content || '',
      password_hash: null,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding note:', error);
    throw error;
  }

  const newNote = {
    id: data.id,
    title: data.title,
    content: data.content,
    password: data.password_hash || null,
    createdAt: data.created_at,
    updatedAt: data.updated_at || data.created_at,
  };

  setNotes((prev) => [...prev, newNote]);
  return newNote;
};

const updateNote = async (noteId, updates) => {
  if (!authUser?.id) return;

  const updateData = {};
  ['title', 'content'].forEach((key) => {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  });

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error updating note:', error);
    }
  }

  setNotes((prev) =>
    prev.map((n) =>
      n.id === noteId
        ? { ...n, ...updates, updatedAt: new Date().toISOString() }
        : n
    )
  );
};

const deleteNote = async (noteId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting note:', error);
  }

  setNotes((prev) => prev.filter((n) => n.id !== noteId));
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

  if (!authUser?.id) return;

  const { error } = await supabase
    .from('notes')
    .update({
      password_hash: newPassword || null,
    })
    .eq('id', noteId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error updating note password:', error);
  }

  const updatedNotes = notes.map((n) =>
    n.id === noteId
      ? { ...n, password: newPassword || null, updatedAt: new Date().toISOString() }
      : n
  );
  setNotes(updatedNotes);
};



const defaultHealthDay = () => ({
  mood: null,
  energy: 3,
  waterIntake: 0,
  sleepTime: null,
  wakeTime: null,
  sleepQuality: null,
  calories: 0,
  foods: [],
  healthDayId: null,
});

const fetchHealthFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('health_daily')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  const { data: foodEntries, error: foodError } = await supabase
    .from('health_food_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.log('Error fetching health data:', error);
    return;
  }

  if (foodError) {
    console.log('Error fetching food entries:', foodError);
  }

  const healthMap = {};
  (data || []).forEach((row) => {
    const key = row.date;
    healthMap[key] = {
      mood: row.mood,
      energy: row.energy ?? 3,
      waterIntake: row.water_intake ?? 0,
      sleepTime: row.sleep_time,
      wakeTime: row.wake_time,
      sleepQuality: row.sleep_quality,
      calories: row.calories ?? 0,
      foods: row.foods || [],
      healthDayId: row.id,
    };
  });

  const foodMap = {};
  (foodEntries || []).forEach((row) => {
    const key = row.date;
    if (!foodMap[key]) foodMap[key] = [];
    foodMap[key].push({
      id: row.id,
      name: row.name,
      calories: row.calories,
      timestamp: row.created_at,
      healthDayId: row.health_day_id,
      date: row.date,
    });
  });

  Object.entries(foodMap).forEach(([dateKey, foods]) => {
    const deduped = [];
    const seen = new Set();
    (foods || []).forEach((f) => {
      const key = f.id || f.timestamp || `${f.name}-${f.calories}-${f.date}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(f);
    });
    const totalCalories = deduped.reduce((sum, f) => sum + (f.calories || 0), 0);
    const base = healthMap[dateKey] || defaultHealthDay();
    healthMap[dateKey] = {
      ...base,
      foods: deduped,
      calories: totalCalories || base.calories || 0,
      healthDayId: base.healthDayId || deduped[0]?.healthDayId || null,
    };
  });

  // Merge locally cached food logs to retain entries across sessions/logouts
  Object.entries(foodLogs || {}).forEach(([dateKey, foods]) => {
    const combined = [...(healthMap[dateKey]?.foods || []), ...(foods || [])];
    const seen = new Set();
    const deduped = [];
    combined.forEach((f) => {
      const key = f.id || f.timestamp || `${f.name}-${f.calories}-${f.date}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(f);
    });
    const totalCalories = deduped.reduce((sum, f) => sum + (f.calories || 0), 0);
    const base = healthMap[dateKey] || defaultHealthDay();
    healthMap[dateKey] = {
      ...base,
      foods: deduped,
      calories: totalCalories || base.calories || 0,
    };
  });

  setHealthData(healthMap);

  const todayISO = new Date().toISOString().slice(0, 10);
  if (healthMap[todayISO]) {
    setTodayHealth(healthMap[todayISO]);
  } else {
    setTodayHealth({
      mood: null,
      energy: 3,
      waterIntake: 0,
      sleepTime: null,
      wakeTime: null,
      sleepQuality: null,
      calories: 0,
      foods: [],
    });
  }
};



  // HEALTH FUNCTIONS
  // HEALTH FUNCTIONS
const upsertHealthDayRecord = async (dateISO, healthDay) => {
  const payload = {
    id: healthDay?.healthDayId,
    user_id: authUser.id,
    date: dateISO,
    mood: healthDay?.mood,
    energy: healthDay?.energy,
    water_intake: healthDay?.waterIntake,
    sleep_time: healthDay?.sleepTime,
    wake_time: healthDay?.wakeTime,
    sleep_quality: healthDay?.sleepQuality,
    calories: healthDay?.calories,
    foods: healthDay?.foods,
  };

  const { data, error } = await supabase
    .from('health_daily')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) {
    console.log('Error saving health data:', error);
  }

  return data?.id || healthDay?.healthDayId || null;
};

const updateHealthForDate = async (dateISO, updates) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to update health data.');
  }

  const base = healthData[dateISO] || defaultHealthDay();
  const newHealth = { ...base, ...updates };
  const newHealthData = { ...healthData, [dateISO]: newHealth };
  setHealthData(newHealthData);

  // Update todayHealth if this is the current day
  const todayISO = new Date().toISOString().slice(0, 10);
  if (dateISO === todayISO) {
    setTodayHealth(newHealth);
  }

  // Persist food logs locally so they survive logout/app close
  if (updates.foods !== undefined) {
    const updatedFoodLogs = { ...(foodLogs || {}) };
    updatedFoodLogs[dateISO] = updates.foods;
    setFoodLogs(updatedFoodLogs);
    await saveToStorage(STORAGE_KEYS.HEALTH_FOOD_LOGS, updatedFoodLogs);
  }

  const healthDayId = await upsertHealthDayRecord(dateISO, newHealth);
  if (healthDayId) {
    setHealthData((prev) => ({
      ...prev,
      [dateISO]: { ...newHealth, healthDayId },
    }));
    if (dateISO === todayISO) {
      setTodayHealth((prev) => ({ ...prev, healthDayId }));
    }
  }
};

const updateTodayHealth = async (updates) => {
  const todayISO = new Date().toISOString().slice(0, 10);
  await updateHealthForDate(todayISO, updates);
};

const addFoodEntryForDate = async (dateISO, food) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to log food.');
  }
  const baseDay = healthData[dateISO] || defaultHealthDay();

  const healthDayId = await upsertHealthDayRecord(dateISO, baseDay);

  const newFood = {
    ...food,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
  };

  const insertPayload = {
    user_id: authUser?.id,
    health_day_id: healthDayId,
    date: dateISO,
    name: newFood.name,
    calories: newFood.calories,
    created_at: new Date().toISOString(),
  };

  const { data: foodRow, error } = await supabase
    .from('health_food_entries')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.log('Error saving food entry:', error);
  }

  const savedFood = {
    ...newFood,
    id: foodRow?.id || newFood.id,
  };

  const updatedFoods = [...(baseDay.foods || []), savedFood];
  const totalCalories = updatedFoods.reduce(
    (sum, f) => sum + (f.calories || 0),
    0
  );

  await updateHealthForDate(dateISO, {
    healthDayId,
    foods: updatedFoods,
    calories: totalCalories,
  });
};

const deleteFoodEntryForDate = async (dateISO, foodId) => {
  if (!authUser?.id) return;
  const baseDay = healthData[dateISO] || defaultHealthDay();
  const updatedFoods = (baseDay.foods || []).filter((f) => f.id !== foodId);
  const totalCalories = updatedFoods.reduce((sum, f) => sum + (f.calories || 0), 0);

  if (foodId) {
    const { error } = await supabase
      .from('health_food_entries')
      .delete()
      .eq('id', foodId);
    if (error) {
      console.log('Error deleting food entry:', error);
    }
  }

  await updateHealthForDate(dateISO, {
    foods: updatedFoods,
    calories: totalCalories,
  });
};

const addFoodEntry = async (food) => {
  const targetDate = new Date().toISOString().slice(0, 10);
  await addFoodEntryForDate(targetDate, food);
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





  const fetchRoutinesFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching routines:', error);
    return;
  }

  const mapped = (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    tasks: r.tasks || [],
  }));

  setRoutines(mapped);
};



  // ROUTINE FUNCTIONS
const addRoutine = async (routine) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a routine.');
  }

  const { data, error } = await supabase
    .from('routines')
    .insert({
      user_id: authUser.id,
      name: routine.name,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding routine:', error);
    throw error;
  }

  const newRoutine = {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    tasks: [],
  };

  setRoutines((prev) => [...prev, newRoutine]);
  return newRoutine;
};

const updateRoutine = async (routineId, updates) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const updated = { ...routine, ...updates };

  const { error } = await supabase
    .from('routines')
    .update({
      name: updated.name,
    })
    .eq('id', routineId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error updating routine:', error);
  }

  setRoutines((prev) =>
    prev.map((r) => (r.id === routineId ? updated : r))
  );
};

const deleteRoutine = async (routineId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', routineId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting routine:', error);
  }

  setRoutines((prev) => prev.filter((r) => r.id !== routineId));
};

const addTaskToRoutine = async (routineId, task) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const newTask = {
    ...task,
    id: Date.now().toString(),
  };

  const updatedTasks = [...(routine.tasks || []), newTask];
  const updatedRoutine = { ...routine, tasks: updatedTasks };

  setRoutines((prev) =>
    prev.map((r) => (r.id === routineId ? updatedRoutine : r))
  );
};

const removeTaskFromRoutine = async (routineId, taskId) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const updatedTasks = (routine.tasks || []).filter((t) => t.id !== taskId);
  const updatedRoutine = { ...routine, tasks: updatedTasks };

  setRoutines((prev) =>
    prev.map((r) => (r.id === routineId ? updatedRoutine : r))
  );
};

const reorderRoutineTasks = async (routineId, newTaskOrder) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const updatedRoutine = { ...routine, tasks: newTaskOrder };

  setRoutines((prev) =>
    prev.map((r) => (r.id === routineId ? updatedRoutine : r))
  );
};



const fetchChoresFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('chores')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching chores:', error);
    return;
  }

  const mapped = (data || []).map((c) => ({
    id: c.id,
    title: c.title,
    date: c.date,
    completed: c.completed,
    createdAt: c.created_at,
  }));

  setChores(mapped);
};

  // CHORE FUNCTIONS
const addChore = async (chore) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a chore.');
  }

  const { data, error } = await supabase
    .from('chores')
    .insert({
      user_id: authUser.id,
      title: chore.title,
      date: chore.date || null,
      completed: false,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding chore:', error);
    throw error;
  }

  const newChore = {
    id: data.id,
    title: data.title,
    date: data.date,
    completed: data.completed,
    createdAt: data.created_at,
  };

  setChores((prev) => [...prev, newChore]);
  return newChore;
};

const updateChore = async (choreId, updates) => {
  if (!authUser?.id) return;

  const updateData = {};
  ['title', 'date', 'completed'].forEach((key) => {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  });

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('chores')
      .update(updateData)
      .eq('id', choreId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error updating chore:', error);
    }
  }

  setChores((prev) =>
    prev.map((c) => (c.id === choreId ? { ...c, ...updates } : c))
  );
};

const deleteChore = async (choreId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('chores')
    .delete()
    .eq('id', choreId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting chore:', error);
  }

  setChores((prev) => prev.filter((c) => c.id !== choreId));
};

const fetchRemindersFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching reminders:', error);
    return;
  }

  const mapped = (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    dateTime: r.date_time || r.date || null,
    createdAt: r.created_at,
  }));

  setReminders(mapped);
};

  // REMINDER FUNCTIONS
const addReminder = async (reminder) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a reminder.');
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: authUser.id,
      title: reminder.title,
      // use 'date' column (or fallback) since date_time may not exist in schema
      date: reminder.dateTime || reminder.date || null,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding reminder:', error);
    throw error;
  }

  const newReminder = {
    id: data.id,
    title: data.title,
    dateTime: data.date_time,
    createdAt: data.created_at,
  };

  setReminders((prev) => [...prev, newReminder]);
  return newReminder;
};

const deleteReminder = async (reminderId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', reminderId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting reminder:', error);
  }

  setReminders((prev) => prev.filter((r) => r.id !== reminderId));
};



const fetchGroceriesFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('groceries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching groceries:', error);
    return;
  }

  const mapped = (data || []).map((g) => ({
    id: g.id,
    name: g.name,
    completed: g.completed,
    createdAt: g.created_at,
  }));

  setGroceries(mapped);
};


  const addGroceryItem = async (item) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add groceries.');
  }

  const { data, error } = await supabase
    .from('groceries')
    .insert({
      user_id: authUser.id,
      name: item,
      completed: false,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding grocery item:', error);
    throw error;
  }

  const newItem = {
    id: data.id,
    name: data.name,
    completed: data.completed,
    createdAt: data.created_at,
  };

  setGroceries((prev) => [...prev, newItem]);
  return newItem;
};

const toggleGroceryItem = async (itemId) => {
  if (!authUser?.id) return;

  const item = groceries.find((g) => g.id === itemId);
  if (!item) return;

  const newCompleted = !item.completed;

  const { error } = await supabase
    .from('groceries')
    .update({ completed: newCompleted })
    .eq('id', itemId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error toggling grocery item:', error);
    return;
  }

  setGroceries((prev) =>
    prev.map((g) =>
      g.id === itemId ? { ...g, completed: newCompleted } : g
    )
  );
};

const deleteGroceryItem = async (itemId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('groceries')
    .delete()
    .eq('id', itemId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting grocery item:', error);
  }

  setGroceries((prev) => prev.filter((g) => g.id !== itemId));
};

const clearCompletedGroceries = async () => {
  if (!authUser?.id) return;

  const completedIds = groceries.filter((g) => g.completed).map((g) => g.id);

  if (completedIds.length > 0) {
    const { error } = await supabase
      .from('groceries')
      .delete()
      .in('id', completedIds)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error clearing completed groceries:', error);
    }
  }

  setGroceries((prev) => prev.filter((g) => !g.completed));
};





const fetchFinancesFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('finance_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) {
    console.log('Error fetching finances:', error);
    return;
  }

  const mapped = (data || []).map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    category: t.category,
    currency: t.currency,
    date: t.date,
    note: t.note,
    createdAt: t.created_at,
  }));

  setFinances(mapped);
};



  // FINANCE FUNCTIONS
const addTransaction = async (transaction) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a transaction.');
  }

  const { data, error } = await supabase
    .from('finance_transactions')
    .insert({
      user_id: authUser.id,
      type: transaction.type, // 'income' or 'expense'
      amount: transaction.amount,
      category: transaction.category || null,
      currency: transaction.currency || 'GBP',
      date: transaction.date,
      note: transaction.note || null,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding transaction:', error);
    throw error;
  }

  const newTransaction = {
    id: data.id,
    type: data.type,
    amount: Number(data.amount),
    category: data.category,
    currency: data.currency,
    date: data.date,
    note: data.note,
    createdAt: data.created_at,
  };

  setFinances((prev) => [...prev, newTransaction]);
  return newTransaction;
};

const deleteTransaction = async (transactionId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('finance_transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting transaction:', error);
  }

  setFinances((prev) => prev.filter((f) => f.id !== transactionId));
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

  // Optional: keep a local copy (offline cache)
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
  // We now sign in with EMAIL (identifier is email)
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

  // Depending on email confirmation settings, user may be null until they confirm
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
    updateHealthForDate,
    addFoodEntry,
    addFoodEntryForDate,
    deleteFoodEntryForDate,
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
