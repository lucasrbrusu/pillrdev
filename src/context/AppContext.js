import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../utils/theme';
import themePresets from '../utils/themePresets';
import { supabase } from '../utils/supabaseClient';
import { translate } from '../utils/i18n';
import { addAppUsageMs, splitDurationByLocalDay } from '../utils/insightsTracking';
import {
  requestNotificationPermissionAsync,
  cancelAllScheduledNotificationsAsync,
  scheduleLocalNotificationAsync,
  buildDateWithTime,
  formatFriendlyDateTime,
  formatTimeFromDate,
} from '../utils/notifications';
import uuid from 'react-native-uuid';

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
  BUDGETS: '@pillr_budgets',
  BUDGET_ASSIGNMENTS: '@pillr_budget_assignments',
  PROFILE: '@pillr_profile',
  THEME: '@pillr_theme',
  AUTH_USER: '@pillr_auth_user',
  AUTH_USERS: '@pillr_auth_users',
  ONBOARDING: '@pillr_onboarding_complete',
  STREAK_FROZEN_PREFIX: '@pillr_streak_frozen_',
  LAST_ACTIVE_PREFIX: '@pillr_last_active_',
};

const SUPABASE_STORAGE_KEYS = [
  'supabase.auth.token',
  'sb-ueiptamivkuwhswotwpn-auth-token',
];

const defaultProfile = {
  name: 'User',
  username: '',
  email: 'user@pillr.app',
  photo: null,
  dailyCalorieGoal: 2000,
  dailyWaterGoal: 8,
  dailySleepGoal: 8,
  profileId: null,
  plan: 'free',
  premiumExpiresAt: null,
  isPremium: false,
};

const defaultHealthDay = () => ({
  mood: null,
  waterIntake: 0,
  sleepTime: null,
  wakeTime: null,
  sleepQuality: null,
  calories: 0,
  foods: [],
  healthDayId: null,
  createdAt: null,
  updatedAt: null,
});

const defaultUserSettings = {
  id: null,
  themeName: 'default',
  notificationsEnabled: true,
  habitRemindersEnabled: true,
  taskRemindersEnabled: true,
  healthRemindersEnabled: true,
  defaultCurrencyCode: 'USD',
  language: 'en',
};

const DEFAULT_EVENT_TIME = { hour: 9, minute: 0 };
const HABIT_REMINDER_TIME = { hour: 8, minute: 0 };
const ROUTINE_REMINDER_TIME = { hour: 7, minute: 30 };
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
const STATUS_POLL_INTERVAL_MS = 45 * 1000;

const computeIsPremium = (plan, premiumExpiresAt) => {
  const normalizedPlan = (plan || '').toLowerCase();
  const isPremiumPlan = normalizedPlan === 'premium' || normalizedPlan === 'pro';
  if (!isPremiumPlan) return false;

  if (!premiumExpiresAt) return true;

  const coerceExpiryMs = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') {
      // Heuristic: seconds vs milliseconds
      return value < 1e12 ? value * 1000 : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        if (!Number.isFinite(n)) return null;
        return n < 1e12 ? n * 1000 : n;
      }
      const parsed = new Date(trimmed).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const expiryMs = coerceExpiryMs(premiumExpiresAt);
  if (!expiryMs) return true;
  return expiryMs > Date.now();
};

const getLastActiveKey = (userId) => `${STORAGE_KEYS.LAST_ACTIVE_PREFIX}${userId}`;
const getStreakFrozenKey = (userId) => `${STORAGE_KEYS.STREAK_FROZEN_PREFIX}${userId}`;
const getFoodLogsKey = (userId) => `${STORAGE_KEYS.HEALTH_FOOD_LOGS}_${userId || 'anon'}`;

const readLastActive = async (userId) => {
  if (!userId) return null;
  const value = await AsyncStorage.getItem(getLastActiveKey(userId));
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const writeLastActive = async (userId, date = new Date()) => {
  if (!userId) return;
  await AsyncStorage.setItem(getLastActiveKey(userId), date.toISOString());
};

const readStreakFrozen = async (userId) => {
  if (!userId) return false;
  const value = await AsyncStorage.getItem(getStreakFrozenKey(userId));
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'boolean') return parsed;
    return !!parsed?.frozen;
  } catch (e) {
    return false;
  }
};

const writeStreakFrozen = async (userId, frozen) => {
  if (!userId) return;
  if (frozen) {
    await AsyncStorage.setItem(
      getStreakFrozenKey(userId),
      JSON.stringify({ frozen: true, updatedAt: new Date().toISOString() })
    );
    return;
  }
  await AsyncStorage.removeItem(getStreakFrozenKey(userId));
};

const asNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const mapHealthRow = (row, fallback = defaultHealthDay()) => {
  if (!row) return { ...defaultHealthDay(), ...fallback };
  return {
    ...fallback,
    mood: asNumber(row.mood, fallback.mood),
    waterIntake: asNumber(row.water_intake, fallback.waterIntake),
    sleepTime: row.sleep_time ?? fallback.sleepTime,
    wakeTime: row.wake_time ?? fallback.wakeTime,
    sleepQuality: row.sleep_quality ?? fallback.sleepQuality,
    calories: asNumber(row.calories, fallback.calories),
    foods: Array.isArray(row.foods) ? row.foods : fallback.foods,
    healthDayId: row.id ?? fallback.healthDayId,
    createdAt: row.created_at ?? fallback.createdAt,
    updatedAt: row.updated_at ?? fallback.updatedAt,
  };
};

const normalizeDateKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const parseDateTimeParts = (value) => {
  if (!value) return { date: null, time: '', dateTimeISO: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: value, time: '', dateTimeISO: null };
  }
  return {
    date: parsed.toISOString().slice(0, 10),
    time: formatTimeFromDate(parsed),
    dateTimeISO: parsed.toISOString(),
  };
};

const getAvatarPublicUrl = (path) => {
  if (!path) return null;
  if (typeof path !== 'string') return null;
  // Allow direct data URIs or remote URLs to be used as-is
  if (
    path.startsWith('data:image') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  return null;
};

const pruneUndefined = (obj = {}) => {
  const clean = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  return clean;
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
  const [todayHealth, setTodayHealth] = useState(defaultHealthDay());
  const [foodLogs, setFoodLogs] = useState({});

  // Routine State
  const [routines, setRoutines] = useState([]);
  const [chores, setChores] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [groceries, setGroceries] = useState([]);

  // Finance State
  const [finances, setFinances] = useState([]);
  const [budgetGroups, setBudgetGroups] = useState([]);
  const [budgetAssignments, setBudgetAssignments] = useState({});

  // Social/Friends State
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [], responses: [] });
  const [taskInvites, setTaskInvites] = useState({ incoming: [], outgoing: [], responses: [] });
  const [groups, setGroups] = useState([]);
  const [groupInvites, setGroupInvites] = useState({ incoming: [], outgoing: [], responses: [] });
  const [groupHabits, setGroupHabits] = useState([]);
  const [groupHabitCompletions, setGroupHabitCompletions] = useState({});
  const [groupRoutines, setGroupRoutines] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const friendResponseSignatureRef = useRef('');
  const taskInviteResponseSignatureRef = useRef('');
  const groupInviteSignatureRef = useRef('');

 // Profile State
  const [profile, setProfile] = useState(defaultProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [userSettings, setUserSettings] = useState(defaultUserSettings);
  const [language, setLanguage] = useState(defaultUserSettings.language);
  const isPremiumUser = useMemo(
    () =>
      profile?.isPremium ||
      computeIsPremium(profile?.plan, profile?.premiumExpiresAt || profile?.premium_expires_at),
    [profile]
  );

  // Auth State
  const [authUser, setAuthUser] = useState(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [themeName, setThemeName] = useState('default');
  const [themeColors, setThemeColors] = useState({ ...colors });
  const [themeReady, setThemeReady] = useState(false);

  // Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const streakCheckRanRef = useRef(false);
  const [streakFrozen, setStreakFrozen] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const appSessionStartMsRef = useRef(null);

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
    const cachedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
    if (cachedTheme) {
      setThemeName(cachedTheme);
      applyTheme(cachedTheme);
      setThemeReady(true);
    } else {
      // Apply default once so UI has a theme before async fetches return
      applyTheme('default');
      setThemeReady(true);
    }
    const storedRoutines = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);

    if (storedRoutines) {
      try {
        setRoutines(JSON.parse(storedRoutines));
      } catch (err) {
        console.log('Error parsing stored routines', err);
      }
    }

    // 🔐 Restore Supabase session (if user was logged in before)
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.log('Error getting Supabase session:', error);
      const isInvalidRefresh =
        typeof error.message === 'string' &&
        error.message.toLowerCase().includes('invalid refresh token');
      if (isInvalidRefresh) {
        await supabase.auth.signOut();
        await clearCachedSession();
        applyTheme('default');
      }
    } else if (session?.user) {
      await setActiveUser(session.user);
    } else {
      applyTheme('default');
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    if (!themeReady) setThemeReady(true);
    setIsLoading(false);
  }
};

const loadUserDataFromSupabase = async (userId) => {
  try {
    const groupList = await fetchGroups(userId);
    await Promise.all([
      fetchProfileFromSupabase(userId),
      fetchUserSettings(userId),
      refreshFriendData(userId),
      fetchGroupInvites(userId),
      fetchGroupHabits(userId, groupList),
      fetchGroupRoutines(userId, groupList),
      fetchTaskInvites(userId),
      fetchHabitsFromSupabase(userId, groupList),
      fetchTasksFromSupabase(userId),
      fetchNotesFromSupabase(userId),
      fetchHealthFromSupabase(userId),
      fetchRoutinesFromSupabase(userId),
      fetchChoresFromSupabase(userId),
      fetchRemindersFromSupabase(userId),
      fetchGroceriesFromSupabase(userId),
      fetchFinancesFromSupabase(userId),
      fetchBudgetGroupsFromSupabase(userId),
      fetchBudgetAssignmentsFromSupabase(userId),
    ]);

    // Load user-scoped cached food logs (offline entries) after Supabase fetch
    const storedFoodLogs = await AsyncStorage.getItem(getFoodLogsKey(userId));
    if (storedFoodLogs) {
      try {
        setFoodLogs(JSON.parse(storedFoodLogs));
      } catch (err) {
        console.log('Error parsing stored food logs', err);
      }
    }
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
      setTodayHealth(defaultHealthDay());
      setRoutines([]);
      setChores([]);
      setReminders([]);
      setGroceries([]);
      setFinances([]);
      setBudgetGroups([]);
      setBudgetAssignments({});
      setFriends([]);
      setFriendRequests({ incoming: [], outgoing: [], responses: [] });
      setTaskInvites({ incoming: [], outgoing: [], responses: [] });
      setGroups([]);
      setGroupInvites({ incoming: [], outgoing: [], responses: [] });
      setGroupHabits([]);
      setGroupHabitCompletions({});
      setGroupRoutines([]);
      setUserStatuses({});
      setFoodLogs({});
      setProfile(defaultProfile);
      setProfileLoaded(false);
      setUserSettings(defaultUserSettings);
      setHasOnboarded(false);
      setThemeName('default');
      applyTheme('default');
    }
  }, [authUser]);

  // Track time spent in-app (foreground time) for Insights.
  useEffect(() => {
    const userId = authUser?.id;
    appStateRef.current = AppState.currentState;

    const flushSession = (endMs) => {
      if (!userId) return;
      const startMs = appSessionStartMsRef.current;
      if (!startMs || !endMs || endMs <= startMs) return;
      const parts = splitDurationByLocalDay(startMs, endMs);
      Object.entries(parts).forEach(([dateKey, ms]) => {
        addAppUsageMs(userId, dateKey, ms);
      });
    };

    if (!userId) {
      appSessionStartMsRef.current = null;
      return undefined;
    }

    if (AppState.currentState === 'active') {
      appSessionStartMsRef.current = Date.now();
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'active' && nextState !== 'active') {
        flushSession(Date.now());
        appSessionStartMsRef.current = null;
        return;
      }

      if (prevState !== 'active' && nextState === 'active') {
        appSessionStartMsRef.current = Date.now();
      }
    });

    return () => {
      flushSession(Date.now());
      appSessionStartMsRef.current = null;
      sub?.remove?.();
    };
  }, [authUser?.id]);

  useEffect(() => {
    let isMounted = true;
    const hydrateStreakFreeze = async () => {
      if (!authUser?.id) {
        if (isMounted) setStreakFrozen(false);
        return;
      }
      const savedFrozen = await readStreakFrozen(authUser.id);
      if (isMounted) setStreakFrozen(!!savedFrozen);
    };

    hydrateStreakFreeze();
    return () => {
      isMounted = false;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return undefined;

    let isCancelled = false;

    const tick = async () => {
      if (isCancelled) return;
      await updateUserPresence();
      await refreshFriendStatuses();
      await fetchFriendRequests(authUser.id);
      await fetchTaskInvites(authUser.id);
    };

    tick();
    const interval = setInterval(tick, STATUS_POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [authUser?.id, fetchFriendRequests, fetchTaskInvites, refreshFriendStatuses, updateUserPresence]);

  // Save helpers
  const saveToStorage = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const cacheThemeLocally = async (name) => {
    try {
      if (!name) {
        await AsyncStorage.removeItem(STORAGE_KEYS.THEME);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, name);
    } catch (err) {
      console.log('Error caching theme:', err);
    }
  };

  const clearCachedSession = async () => {
    try {
      await AsyncStorage.multiRemove([
        ...SUPABASE_STORAGE_KEYS,
        STORAGE_KEYS.AUTH_USER,
      ]);
    } catch (err) {
      console.log('Error clearing cached session keys:', err);
    }
  };

  const persistStreakFrozenState = useCallback(
    async (nextFrozen) => {
      setStreakFrozen(nextFrozen);
      if (authUser?.id) {
        await writeStreakFrozen(authUser.id, nextFrozen);
      }
    },
    [authUser?.id]
  );

  const persistRoutinesLocally = async (data) => {
    await saveToStorage(STORAGE_KEYS.ROUTINES, data);
  };

  const persistFoodLogsLocally = async (data, userId) => {
    if (!userId) return;
    await saveToStorage(getFoodLogsKey(userId), data);
  };

const mapProfileSummary = (row) => ({
  id: row?.id || null,
  username: row?.username || '',
  name: row?.full_name || row?.name || row?.email || 'Unknown user',
  avatarUrl: getAvatarPublicUrl(row?.photo || row?.avatar_url || row?.avatar) || null,
});

  const updateUserPresence = useCallback(async () => {
    if (!authUser?.id) return;
    const nowISO = new Date().toISOString();
    setUserStatuses((prev) => ({ ...prev, [authUser.id]: nowISO }));
    try {
      const { error } = await supabase
        .from('user_status')
        .upsert({ user_id: authUser.id, last_seen: nowISO }, { onConflict: 'user_id' });

      // If FK fails because profile is missing, attempt to create the profile then retry once
      if (error?.code === '23503') {
        await upsertProfileRow({
          id: authUser.id,
          username: authUser?.user_metadata?.username || profile.username,
          full_name:
            authUser?.user_metadata?.full_name ||
            authUser?.user_metadata?.name ||
            profile.name ||
            authUser?.email,
          email: authUser?.email || profile.email,
        });
        const retry = await supabase
          .from('user_status')
          .upsert({ user_id: authUser.id, last_seen: nowISO }, { onConflict: 'user_id' });
        if (retry.error) {
          console.log('Error updating user status after profile upsert:', retry.error);
        }
      } else if (error) {
        console.log('Error updating user status:', error);
      }
    } catch (err) {
      console.log('Error updating user status:', err);
    }
  }, [authUser?.id, profile.name, profile.username, profile.email]);

  const fetchFriendships = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching friendships:', error);
        return [];
      }

      const friendIds = Array.from(
        new Set(
          (data || [])
            .map((row) => (row.user_id === userId ? row.friend_id : row.user_id))
            .filter(Boolean)
        )
      );

      let profileRows = [];
      if (friendIds.length) {
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', friendIds);

        if (profileError) {
          console.log('Error fetching friend profiles:', profileError);
        } else {
          profileRows = profilesData || [];
        }
      }

      let statusRows = [];
      if (friendIds.length) {
        const { data: statusesData, error: statusError } = await supabase
          .from('user_status')
          .select('user_id, last_seen')
          .in('user_id', friendIds);
        if (statusError) {
          console.log('Error fetching friend statuses:', statusError);
        } else {
          statusRows = statusesData || [];
        }
      }

      const statusMap = {};
      statusRows.forEach((row) => {
        if (row?.user_id) statusMap[row.user_id] = row.last_seen;
      });
      if (Object.keys(statusMap).length) {
        setUserStatuses((prev) => ({ ...prev, ...statusMap }));
      }

      const mapped = friendIds.map((id) => {
        const profileRow = profileRows.find((p) => p.id === id) || {};
        return {
          id,
          ...mapProfileSummary(profileRow),
          lastSeen: statusMap[id] || null,
        };
      });

      setFriends(mapped);
      return mapped;
    },
    [authUser?.id]
  );

  const fetchFriendRequests = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return { incoming: [], outgoing: [], responses: [] };

      const { data, error } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching friend requests:', error);
        return { incoming: [], outgoing: [] };
      }

      const involvedIds = Array.from(
        new Set(
          (data || [])
            .flatMap((row) => [row.from_user_id, row.to_user_id])
            .filter(Boolean)
        )
      );

      let profileRows = [];
      if (involvedIds.length) {
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', involvedIds);

        if (profileError) {
          console.log('Error fetching friend request profiles:', profileError);
        } else {
          profileRows = profilesData || [];
        }
      }

      const profileLookup = {};
      profileRows.forEach((row) => {
        profileLookup[row.id] = mapProfileSummary(row);
      });

      const mapped = (data || []).map((row) => ({
        ...row,
        fromUser: profileLookup[row.from_user_id] || null,
        toUser: profileLookup[row.to_user_id] || null,
      }));

      const incoming = mapped.filter(
        (row) => row.to_user_id === userId && row.status === 'pending'
      );
      const outgoing = mapped.filter(
        (row) => row.from_user_id === userId && row.status === 'pending'
      );
      const responses = mapped.filter(
        (row) => row.from_user_id === userId && row.status !== 'pending'
      );

      setFriendRequests({ incoming, outgoing, responses });

      const signature = responses.map((r) => `${r.id}:${r.status}`).join('|');
      if (signature !== friendResponseSignatureRef.current) {
        friendResponseSignatureRef.current = signature;
        if (responses.length) {
          // A response happened; refresh friendships so both sides see the new link
          await fetchFriendships(userId);
          await refreshFriendStatuses();
        }
      }

      return { incoming, outgoing, responses };
    },
    [authUser?.id, fetchFriendships, refreshFriendStatuses]
  );

  const isMissingRelationError = (error, relation) => {
    if (!error) return false;
    const message = (error.message || '').toLowerCase();
    const relationName = (relation || '').toLowerCase();
    return (
      error.code === '42P01' ||
      message.includes('does not exist') ||
      (relationName && message.includes(relationName))
    );
  };

  const fetchTaskInvites = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return { incoming: [], outgoing: [], responses: [] };

      const { data, error } = await supabase
        .from('task_invites')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        if (!isMissingRelationError(error, 'task_invites')) {
          console.log('Error fetching task invites:', error);
        }
        const empty = { incoming: [], outgoing: [], responses: [] };
        setTaskInvites(empty);
        return empty;
      }

      const invites = data || [];
      const involvedIds = Array.from(
        new Set(
          invites
            .flatMap((row) => [row.from_user_id, row.to_user_id])
            .filter(Boolean)
        )
      );

      let profileRows = [];
      if (involvedIds.length) {
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, photo')
          .in('id', involvedIds);

        if (profileError) {
          console.log('Error fetching task invite profiles:', profileError);
        } else {
          profileRows = profilesData || [];
        }
      }

      const profileLookup = {};
      profileRows.forEach((row) => {
        profileLookup[row.id] = mapProfileSummary(row);
      });

      const mapped = invites.map((row) => ({
        ...row,
        fromUser: profileLookup[row.from_user_id] || null,
        toUser: profileLookup[row.to_user_id] || null,
        task: {
          id: row.task_id,
          title: row.task_title,
          description: row.task_description,
          priority: row.task_priority,
          date: row.task_date,
          time: row.task_time,
        },
      }));

      const incoming = mapped.filter(
        (row) => row.to_user_id === userId && row.status === 'pending'
      );
      const outgoing = mapped.filter(
        (row) => row.from_user_id === userId && row.status === 'pending'
      );
      const responses = mapped.filter(
        (row) => row.from_user_id === userId && row.status !== 'pending'
      );

      setTaskInvites({ incoming, outgoing, responses });

      const signature = responses.map((r) => `${r.id}:${r.status}`).join('|');
      if (signature !== taskInviteResponseSignatureRef.current) {
        taskInviteResponseSignatureRef.current = signature;
      }

      return { incoming, outgoing, responses };
    },
    [authUser?.id]
  );

  const fetchGroupMembers = useCallback(
    async (groupId) => {
      if (!authUser?.id || !groupId) return [];
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, user_id, role')
        .eq('group_id', groupId);

      if (error) {
        console.log('Error fetching group members:', error);
        return [];
      }

      const ids = Array.from(new Set((data || []).map((row) => row.user_id).filter(Boolean)));
      let profileMap = {};
      if (ids.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, photo')
          .in('id', ids);

        if (profileError) {
          console.log('Error fetching group member profiles:', profileError);
        } else {
          profileRows.forEach((row) => {
            profileMap[row.id] = mapProfileSummary(row);
          });
        }
      }

      return (data || []).map((row) => ({
        id: row.user_id,
        role: row.role || 'member',
        ...(profileMap[row.user_id] || mapProfileSummary({ id: row.user_id })),
      }));
    },
    [authUser?.id]
  );

  const fetchGroups = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, role, created_at, groups(id, name, owner_id, created_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching groups:', error);
        setGroups([]);
        return [];
      }

      const groupIds = Array.from(
        new Set((data || []).map((row) => row.group_id || row.groups?.id).filter(Boolean))
      );

      let membersByGroup = {};
      if (groupIds.length) {
        const { data: memberRows, error: memberError } = await supabase
          .from('group_members')
          .select('group_id, user_id, role')
          .in('group_id', groupIds);

        if (memberError) {
          console.log('Error fetching group member roster:', memberError);
        } else {
          const ids = Array.from(
            new Set((memberRows || []).map((row) => row.user_id).filter(Boolean))
          );
          let profileMap = {};
          if (ids.length) {
            const { data: profileRows, error: profileError } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url, photo')
              .in('id', ids);

            if (profileError) {
              console.log('Error fetching roster profiles:', profileError);
            } else {
              profileRows.forEach((row) => {
                profileMap[row.id] = mapProfileSummary(row);
              });
            }
          }

          memberRows.forEach((row) => {
            const list = membersByGroup[row.group_id] || [];
            list.push({
              id: row.user_id,
              role: row.role || 'member',
              ...(profileMap[row.user_id] || mapProfileSummary({ id: row.user_id })),
            });
            membersByGroup[row.group_id] = list;
          });
        }
      }

      const mapped = (data || []).map((row) => {
        const id = row.group_id || row.groups?.id;
        return {
          id,
          name: row.groups?.name || 'Group',
          ownerId: row.groups?.owner_id || null,
          role: row.role || 'member',
          createdAt: row.groups?.created_at || row.created_at,
          members: membersByGroup[id] || [],
        };
      });

      setGroups(mapped);
      return mapped;
    },
    [authUser?.id]
  );

  const fetchGroupInvites = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return { incoming: [], outgoing: [], responses: [] };

      const { data, error } = await supabase
        .from('group_invites')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        if (!isMissingRelationError(error, 'group_invites')) {
          console.log('Error fetching group invites:', error);
        }
        const empty = { incoming: [], outgoing: [], responses: [] };
        setGroupInvites(empty);
        return empty;
      }

      const groupIds = Array.from(new Set((data || []).map((row) => row.group_id).filter(Boolean)));
      const userIds = Array.from(
        new Set(
          (data || [])
            .flatMap((row) => [row.from_user_id, row.to_user_id])
            .filter(Boolean)
        )
      );

      let groupMap = {};
      if (groupIds.length) {
        const { data: groupRows, error: groupError } = await supabase
          .from('groups')
          .select('id, name, owner_id, created_at')
          .in('id', groupIds);

        if (groupError) {
          console.log('Error fetching invite groups:', groupError);
        } else {
          groupRows.forEach((row) => {
            groupMap[row.id] = row;
          });
        }
      }

      let profileMap = {};
      if (userIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, photo')
          .in('id', userIds);

        if (profileError) {
          console.log('Error fetching group invite profiles:', profileError);
        } else {
          profileRows.forEach((row) => {
            profileMap[row.id] = mapProfileSummary(row);
          });
        }
      }

      const mapped = (data || []).map((row) => ({
        ...row,
        group: groupMap[row.group_id] || null,
        fromUser: profileMap[row.from_user_id] || null,
        toUser: profileMap[row.to_user_id] || null,
      }));

      const incoming = mapped.filter(
        (row) => row.to_user_id === userId && row.status === 'pending'
      );
      const outgoing = mapped.filter(
        (row) => row.from_user_id === userId && row.status === 'pending'
      );
      const responses = mapped.filter(
        (row) => row.from_user_id === userId && row.status !== 'pending'
      );

      setGroupInvites({ incoming, outgoing, responses });

      const signature = responses.map((r) => `${r.id}:${r.status}`).join('|');
      if (signature !== groupInviteSignatureRef.current) {
        groupInviteSignatureRef.current = signature;
      }

      return { incoming, outgoing, responses };
    },
    [authUser?.id]
  );

  const refreshGroupData = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      const fetchedGroups = await fetchGroups(userId);
      await Promise.all([
        fetchGroupInvites(userId),
        fetchGroupHabits(userId, fetchedGroups),
        fetchGroupRoutines(userId, fetchedGroups),
      ]);
      return fetchedGroups;
    },
    [authUser?.id, fetchGroups, fetchGroupInvites, fetchGroupHabits, fetchGroupRoutines]
  );

  const createGroup = useCallback(
    async ({ name, inviteUserIds = [] }) => {
      if (!authUser?.id) throw new Error('You must be logged in to create a group.');
      if (!isPremiumUser) throw new Error('Only premium users can create groups.');
      const trimmedName = (name || '').trim();
      if (!trimmedName) throw new Error('Group name is required.');

      const { data, error } = await supabase
        .from('groups')
        .insert({ name: trimmedName, owner_id: authUser.id })
        .select()
        .single();

      if (error) {
        console.log('Error creating group:', error);
        throw error;
      }

      const groupId = data.id;

      await supabase
        .from('group_members')
        .upsert({ group_id: groupId, user_id: authUser.id, role: 'owner' }, { onConflict: 'group_id,user_id' });

      if (inviteUserIds.length) {
        await supabase.from('group_invites').insert(
          inviteUserIds.map((id) => ({
            group_id: groupId,
            from_user_id: authUser.id,
            to_user_id: id,
            status: 'pending',
          }))
        );
      }

      await refreshGroupData(authUser.id);
      return data;
    },
    [authUser?.id, isPremiumUser, refreshGroupData]
  );

  const sendGroupInvites = useCallback(
    async ({ groupId, userIds }) => {
      if (!authUser?.id || !groupId) throw new Error('Missing group.');
      if (!isPremiumUser) throw new Error('Only premium users can invite to groups.');
      const ids = Array.from(new Set(userIds || [])).filter(Boolean);
      if (!ids.length) return [];

      const { data, error } = await supabase
        .from('group_invites')
        .insert(
          ids.map((id) => ({
            group_id: groupId,
            from_user_id: authUser.id,
            to_user_id: id,
            status: 'pending',
          }))
        )
        .select();

      if (error) {
        console.log('Error sending group invites:', error);
        throw error;
      }

      await fetchGroupInvites(authUser.id);
      return data;
    },
    [authUser?.id, fetchGroupInvites]
  );

  const respondToGroupInvite = useCallback(
    async (inviteId, status) => {
      if (!authUser?.id) throw new Error('You must be logged in.');
      if (!inviteId) throw new Error('Invalid invite.');
      const normalizedStatus = (status || '').toLowerCase();
      if (!['accepted', 'declined'].includes(normalizedStatus)) {
        throw new Error('Invalid response.');
      }

      const { data: invite, error: inviteError } = await supabase
        .from('group_invites')
        .select('*')
        .eq('id', inviteId)
        .single();

      if (inviteError || !invite) {
        console.log('Error loading group invite:', inviteError);
        throw new Error('Unable to load invite.');
      }

      if (invite.to_user_id !== authUser.id) {
        throw new Error('You cannot respond to this invite.');
      }

      const respondedAt = new Date().toISOString();

      if (normalizedStatus === 'accepted') {
        await supabase
          .from('group_members')
          .upsert(
            { group_id: invite.group_id, user_id: authUser.id, role: 'member' },
            { onConflict: 'group_id,user_id' }
          );
      }

      const { error: updateError } = await supabase
        .from('group_invites')
        .update({ status: normalizedStatus, responded_at: respondedAt })
        .eq('id', inviteId);

      if (updateError) {
        console.log('Error updating group invite:', updateError);
      }

      await refreshGroupData(authUser.id);
      return true;
    },
    [authUser?.id, refreshGroupData]
  );

  const fetchGroupHabits = useCallback(
    async (userIdParam, groupListParam) => {
      const userId = userIdParam || authUser?.id;
      const groupList = groupListParam || groups;
      const groupIds = (groupList || []).map((g) => g.id).filter(Boolean);
      if (!userId || !groupIds.length) {
        setGroupHabits([]);
        setGroupHabitCompletions({});
        return [];
      }

      const { data, error } = await supabase
        .from('group_habits')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false });

      if (error) {
        if (!isMissingRelationError(error, 'group_habits')) {
          console.log('Error fetching group habits:', error);
        }
        setGroupHabits([]);
        setGroupHabitCompletions({});
        return [];
      }

      const habitIds = (data || []).map((h) => h.id).filter(Boolean);
      const completionMap = {};

      if (habitIds.length) {
        const { data: completionRows, error: completionError } = await supabase
          .from('group_habit_completions')
          .select('group_habit_id, user_id, date')
          .in('group_habit_id', habitIds);

        if (completionError) {
          if (!isMissingRelationError(completionError, 'group_habit_completions')) {
            console.log('Error fetching group habit completions:', completionError);
          }
        } else {
          (completionRows || []).forEach((row) => {
            if (!row?.group_habit_id) return;
            const list = completionMap[row.group_habit_id] || [];
            list.push({
              habitId: row.group_habit_id,
              userId: row.user_id,
              date: normalizeDateKey(row.date),
            });
            completionMap[row.group_habit_id] = list;
          });
        }
      }

      const mapped = (data || []).map((h) => ({
        id: h.id,
        groupId: h.group_id,
        title: h.title,
        category: h.category || 'Group',
        description: h.description,
        repeat: h.repeat || 'Daily',
        days: Array.isArray(h.days) ? h.days : [],
        createdAt: h.created_at,
        createdBy: h.created_by,
      }));

      setGroupHabits(mapped);
      setGroupHabitCompletions(completionMap);
      return mapped;
    },
    [authUser?.id, groups]
  );

  const addGroupHabit = useCallback(
    async ({ groupId, title, category, description, repeat, days }) => {
      if (!authUser?.id) throw new Error('You must be logged in to create a group habit.');
      if (!groupId) throw new Error('Select a group to share this habit with.');
      const trimmedTitle = (title || '').trim();
      if (!trimmedTitle) throw new Error('Habit title is required.');

      const { data, error } = await supabase
        .from('group_habits')
        .insert({
          group_id: groupId,
          created_by: authUser.id,
          title: trimmedTitle,
          category: category || 'Group',
          description: description?.trim() || null,
          repeat: repeat || 'Daily',
          days: days || [],
        })
        .select()
        .single();

      if (error) {
        console.log('Error creating group habit:', error);
        throw error;
      }

      await fetchGroupHabits(authUser.id);
      return data;
    },
    [authUser?.id, fetchGroupHabits]
  );

  const toggleGroupHabitCompletion = useCallback(
    async (habitId) => {
      if (!authUser?.id || !habitId) return;
      const todayISO = new Date().toISOString().slice(0, 10);
      const completions = groupHabitCompletions[habitId] || [];
      const existing = completions.find(
        (c) => c.userId === authUser.id && normalizeDateKey(c.date) === todayISO
      );

      if (existing) {
        const { error } = await supabase
          .from('group_habit_completions')
          .delete()
          .eq('group_habit_id', habitId)
          .eq('user_id', authUser.id)
          .eq('date', todayISO);

        if (error) {
          console.log('Error removing group habit completion:', error);
          return;
        }

        setGroupHabitCompletions((prev) => {
          const list = prev[habitId] || [];
          return {
            ...prev,
            [habitId]: list.filter(
              (c) => !(c.userId === authUser.id && normalizeDateKey(c.date) === todayISO)
            ),
          };
        });
        return;
      }

      const { error } = await supabase
        .from('group_habit_completions')
        .insert({ group_habit_id: habitId, user_id: authUser.id, date: todayISO });

      if (error) {
        console.log('Error adding group habit completion:', error);
        return;
      }

      setGroupHabitCompletions((prev) => {
        const list = prev[habitId] || [];
        return {
          ...prev,
          [habitId]: [...list, { habitId, userId: authUser.id, date: todayISO }],
        };
      });
    },
    [authUser?.id, groupHabitCompletions]
  );

  const fetchGroupRoutines = useCallback(
    async (userIdParam, groupListParam) => {
      const userId = userIdParam || authUser?.id;
      const groupList = groupListParam || groups;
      const groupIds = (groupList || []).map((g) => g.id).filter(Boolean);
      if (!userId || !groupIds.length) {
        setGroupRoutines([]);
        return [];
      }

      const { data, error } = await supabase
        .from('group_routines')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: true });

      if (error) {
        if (!isMissingRelationError(error, 'group_routines')) {
          console.log('Error fetching group routines:', error);
        }
        setGroupRoutines([]);
        return [];
      }

      const routineIds = (data || []).map((r) => r.id).filter(Boolean);
      let tasksByRoutine = {};
      if (routineIds.length) {
        const { data: taskRows, error: taskError } = await supabase
          .from('group_routine_tasks')
          .select('*')
          .in('group_routine_id', routineIds)
          .order('position', { ascending: true });

        if (taskError) {
          if (!isMissingRelationError(taskError, 'group_routine_tasks')) {
            console.log('Error fetching group routine tasks:', taskError);
          }
        } else {
          tasksByRoutine = (taskRows || []).reduce((acc, row) => {
            const list = acc[row.group_routine_id] || [];
            list.push({
              id: row.id,
              name: row.name,
              position: row.position ?? list.length,
              createdAt: row.created_at,
              addedBy: row.created_by || row.user_id,
            });
            acc[row.group_routine_id] = list.sort(
              (a, b) => (a.position ?? 0) - (b.position ?? 0)
            );
            return acc;
          }, {});
        }
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        groupId: row.group_id,
        name: row.name,
        createdAt: row.created_at,
        createdBy: row.created_by,
        tasks: tasksByRoutine[row.id] || [],
      }));

      setGroupRoutines(mapped);
      return mapped;
    },
    [authUser?.id, groups]
  );

  const addGroupRoutine = useCallback(
    async ({ groupId, name }) => {
      if (!authUser?.id) throw new Error('You must be logged in to create a group routine.');
      if (!groupId) throw new Error('Select a group for this routine.');
      const trimmedName = (name || '').trim();
      if (!trimmedName) throw new Error('Routine name is required.');

      const { data, error } = await supabase
        .from('group_routines')
        .insert({
          group_id: groupId,
          name: trimmedName,
          created_by: authUser.id,
        })
        .select()
        .single();

      if (error) {
        console.log('Error creating group routine:', error);
        throw error;
      }

      await fetchGroupRoutines(authUser.id);
      return data;
    },
    [authUser?.id, fetchGroupRoutines]
  );

  const deleteGroupRoutine = useCallback(
    async (routineId) => {
      if (!authUser?.id || !routineId) return;

      await supabase.from('group_routine_tasks').delete().eq('group_routine_id', routineId);
      const { error } = await supabase.from('group_routines').delete().eq('id', routineId);
      if (error && !isMissingRelationError(error, 'group_routines')) {
        console.log('Error deleting group routine:', error);
      }

      setGroupRoutines((prev) => prev.filter((r) => r.id !== routineId));
    },
    [authUser?.id]
  );

  const addTaskToGroupRoutine = useCallback(
    async (routineId, task) => {
      if (!authUser?.id || !routineId) return;

      const routine = groupRoutines.find((r) => r.id === routineId);
      if (!routine) return;

      const nextPosition = routine.tasks?.length || 0;
      const { data, error } = await supabase
        .from('group_routine_tasks')
        .insert({
          group_routine_id: routineId,
          name: task.name,
          position: nextPosition,
          created_by: authUser.id,
        })
        .select()
        .single();

      if (error) {
        console.log('Error adding task to group routine:', error);
        return;
      }

      const newTask = {
        id: data.id,
        name: data.name,
        position: data.position ?? nextPosition,
        createdAt: data.created_at,
        addedBy: data.created_by,
      };

      const updatedTasks = [...(routine.tasks || []), newTask].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      );

      setGroupRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, tasks: updatedTasks } : r))
      );
    },
    [authUser?.id, groupRoutines]
  );

  const removeTaskFromGroupRoutine = useCallback(
    async (routineId, taskId) => {
      if (!authUser?.id || !routineId || !taskId) return;

      const routine = groupRoutines.find((r) => r.id === routineId);
      if (!routine) return;

      const updatedTasks = (routine.tasks || []).filter((t) => t.id !== taskId);
      const resequenced = updatedTasks.map((t, idx) => ({ ...t, position: idx }));

      await supabase.from('group_routine_tasks').delete().eq('id', taskId);
      await Promise.all(
        resequenced.map((t) =>
          supabase.from('group_routine_tasks').update({ position: t.position }).eq('id', t.id)
        )
      );

      setGroupRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, tasks: resequenced } : r))
      );
    },
    [authUser?.id, groupRoutines]
  );

  const reorderGroupRoutineTasks = useCallback(
    async (routineId, newTaskOrder) => {
      if (!authUser?.id || !routineId) return;

      const routine = groupRoutines.find((r) => r.id === routineId);
      if (!routine) return;

      const resequenced = (newTaskOrder || []).map((t, idx) => ({ ...t, position: idx }));

      await Promise.all(
        resequenced.map((t) =>
          supabase.from('group_routine_tasks').update({ position: t.position }).eq('id', t.id)
        )
      );

      setGroupRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, tasks: resequenced } : r))
      );
    },
    [authUser?.id, groupRoutines]
  );

  const ensureTaskParticipant = async (taskId, participantTaskId, role = 'participant') => {
    if (!authUser?.id || !taskId) return;
    const { error } = await supabase
      .from('task_participants')
      .upsert(
        pruneUndefined({
          task_id: taskId,
          user_id: authUser.id,
          participant_task_id: participantTaskId ?? null,
          role,
        }),
        { onConflict: 'task_id,user_id' }
      );

    if (error && !isMissingRelationError(error, 'task_participants')) {
      console.log('Error ensuring task participant:', error);
    }
  };

  const sendTaskInvite = async ({ task, toUserId }) => {
    if (!authUser?.id) throw new Error('You must be logged in to invite someone.');
    if (!task?.id) throw new Error('Task is required.');
    if (!toUserId) throw new Error('Invalid user.');
    if (toUserId === authUser.id) throw new Error('You cannot invite yourself.');

    await ensureTaskParticipant(task.id, task.id, 'owner');

    const { data, error } = await supabase
      .from('task_invites')
      .insert(
        pruneUndefined({
          task_id: task.id,
          from_user_id: authUser.id,
          to_user_id: toUserId,
          task_title: task.title,
          task_description: task.description || null,
          task_priority: task.priority || 'medium',
          task_date: task.date || null,
          task_time: task.time || null,
          status: 'pending',
        })
      )
      .select()
      .single();

    if (error) {
      console.log('Error sending task invite:', error);
      throw error;
    }

    await fetchTaskInvites(authUser.id);
    return data;
  };

  const respondToTaskInvite = async (inviteId, status) => {
    if (!authUser?.id) throw new Error('You must be logged in.');
    if (!inviteId) throw new Error('Invalid invite.');

    const normalizedStatus = (status || '').toLowerCase();
    if (!['accepted', 'declined'].includes(normalizedStatus)) {
      throw new Error('Invalid response.');
    }

    const { data: invite, error: inviteError } = await supabase
      .from('task_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      console.log('Error loading task invite:', inviteError);
      throw new Error('Unable to load invite.');
    }

    if (invite.to_user_id !== authUser.id) {
      throw new Error('You cannot respond to this invite.');
    }

    const respondedAt = new Date().toISOString();

    if (normalizedStatus === 'accepted') {
      if (!invite.task_date || !invite.task_time) {
        throw new Error('This invite is missing a date/time and cannot be scheduled.');
      }
      const { data: newRow, error: createError } = await supabase
        .from('tasks')
        .insert({
          user_id: authUser.id,
          title: invite.task_title,
          description: invite.task_description || null,
          priority: invite.task_priority || 'medium',
          date: invite.task_date,
          time: invite.task_time,
          completed: false,
        })
        .select()
        .single();

      if (createError) {
        console.log('Error creating invited task:', createError);
        throw new Error('Unable to create task.');
      }

      await ensureTaskParticipant(invite.task_id, newRow?.id, 'participant');

      const newTask = {
        id: newRow.id,
        title: newRow.title,
        description: newRow.description,
        priority: newRow.priority || 'medium',
        date: newRow.date,
        time: newRow.time,
        completed: newRow.completed,
        createdAt: newRow.created_at,
        sharedTaskId: invite.task_id,
      };

      setTasks((prev) => {
        if (prev.some((t) => t.id === newTask.id)) return prev;
        return [...prev, newTask];
      });
    }

    const { error: updateError } = await supabase
      .from('task_invites')
      .update({ status: normalizedStatus, responded_at: respondedAt })
      .eq('id', inviteId);

    if (updateError) {
      console.log('Error updating task invite:', updateError);
    }

    await fetchTaskInvites(authUser.id);
    return true;
  };

  const fetchTaskParticipants = useCallback(
    async (taskId) => {
      if (!taskId || !authUser?.id) return [];

      // Resolve the shared/base task id even when we're looking at a participant's "copy"
      // task (participant_task_id). This avoids relying on local `sharedTaskId` being set.
      let baseTaskId = taskId;
      try {
        const { data: linkRow, error: linkError } = await supabase
          .from('task_participants')
          .select('task_id')
          .eq('user_id', authUser.id)
          .or(`task_id.eq.${taskId},participant_task_id.eq.${taskId}`)
          .limit(1)
          .maybeSingle();

        if (!linkError && linkRow?.task_id) {
          baseTaskId = linkRow.task_id;
        } else if (linkError && !isMissingRelationError(linkError, 'task_participants')) {
          console.log('Error resolving shared task id:', linkError);
        }
      } catch (err) {
        // ignore
      }

      const { data, error } = await supabase
        .from('task_participants')
        .select('user_id')
        .eq('task_id', baseTaskId);

      if (error) {
        if (!isMissingRelationError(error, 'task_participants')) {
          console.log('Error fetching task participants:', error);
        }
        return [];
      }

      const userIds = Array.from(new Set((data || []).map((r) => r.user_id).filter(Boolean)));
      if (!userIds.length) return [];

      // Profiles schema can be either id=auth.uid() or user_id=auth.uid(); try both without
      // assuming the non-existent column. Start with id-based select to avoid 42703 logs.
      const byIdSelect = 'id, username, full_name, avatar_url, photo';

      const { data: byIdData, error: byIdError } = await supabase
        .from('profiles')
        .select(byIdSelect)
        .in('id', userIds);

      if (!byIdError && Array.isArray(byIdData) && byIdData.length) {
        return byIdData.map((row) => mapProfileSummary(row));
      }

      if (byIdError && !isMissingColumnError(byIdError, 'id')) {
        console.log('Error fetching participant profiles (by id):', byIdError);
      }

      // Fallback for schemas that use user_id as the PK
      const userIdSelect = 'user_id, username, full_name, avatar_url, photo';
      const { data: byUserIdData, error: byUserIdError } = await supabase
        .from('profiles')
        .select(userIdSelect)
        .in('user_id', userIds);

      if (byUserIdError) {
        if (!isMissingColumnError(byUserIdError, 'user_id')) {
        console.log('Error fetching participant profiles (by user_id):', byUserIdError);
        }
        return [];
      }

      return (byUserIdData || []).map((row) =>
        mapProfileSummary({ ...row, id: row.user_id || row.id })
      );
    },
    [authUser?.id]
  );

  const refreshFriendStatuses = useCallback(
    async (friendListParam) => {
      const list = friendListParam || friends;
      const ids = list.map((f) => f.id).filter(Boolean);
      if (!ids.length) return;

      const { data, error } = await supabase
        .from('user_status')
        .select('user_id, last_seen')
        .in('user_id', ids);

      if (error) {
        console.log('Error refreshing friend statuses:', error);
        return;
      }

      const statusMap = {};
      (data || []).forEach((row) => {
        if (row?.user_id) statusMap[row.user_id] = row.last_seen;
      });
      if (Object.keys(statusMap).length) {
        setUserStatuses((prev) => ({ ...prev, ...statusMap }));
        setFriends((prev) =>
          prev.map((friend) =>
            statusMap[friend.id] ? { ...friend, lastSeen: statusMap[friend.id] } : friend
          )
        );
      }
    },
    [friends]
  );

  const refreshFriendData = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return;
      const friendList = await fetchFriendships(userId);
      await fetchFriendRequests(userId);
      await refreshFriendStatuses(friendList);
    },
    [authUser?.id, fetchFriendships, fetchFriendRequests, refreshFriendStatuses]
  );

  const isUserOnline = useCallback(
    (userId) => {
      const lastSeen = userStatuses[userId];
      if (!lastSeen) return false;
      const last = new Date(lastSeen).getTime();
      if (Number.isNaN(last)) return false;
      return Date.now() - last <= ONLINE_THRESHOLD_MS;
    },
    [userStatuses]
  );

  const getFriendRelationship = useCallback(
    (userId) => {
      const isFriend = friends.some((f) => f.id === userId);
      const incoming = friendRequests.incoming.find(
        (r) => r.from_user_id === userId && r.status === 'pending'
      );
      const outgoing = friendRequests.outgoing.find(
        (r) => r.to_user_id === userId && r.status === 'pending'
      );
      return { isFriend, incoming, outgoing };
    },
    [friends, friendRequests]
  );

  const searchUsersByUsername = useCallback(
    async (query) => {
      if (!authUser?.id) return [];
      const trimmed = (query || '').trim();
      if (trimmed.length < 2) return [];
      const exactPattern = trimmed; // exact match (case-insensitive)
      const prefixPattern = `${trimmed}%`; // prefix search hits index on username

      // Try exact match first (fast, small result)
      const { data: exactData, error: exactError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', exactPattern)
        .order('username', { ascending: true })
        .limit(5);

      let rows = exactData || [];

      // Primary: fast prefix search if exact returned nothing
      let error = exactError;
      if (!rows.length) {
        const { data, error: prefixError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', prefixPattern)
        .order('username', { ascending: true })
        .limit(20);
        rows = data || [];
        error = prefixError || exactError;
      }
      if (error) {
        console.log('Error searching users:', error);
      }

      return (rows || [])
        .filter((row) => row.id !== authUser.id)
        .map((row) => {
          const relationship = getFriendRelationship(row.id);
          return {
            ...mapProfileSummary(row),
            isFriend: relationship.isFriend,
            pendingIncoming: !!relationship.incoming,
            pendingOutgoing: !!relationship.outgoing,
          };
        });
    },
    [authUser?.id, getFriendRelationship]
  );

  const sendFriendRequest = useCallback(
    async (toUserId) => {
      if (!authUser?.id) throw new Error('You must be logged in to add a friend.');
      if (!toUserId) throw new Error('Invalid user.');
      if (toUserId === authUser.id) throw new Error('You cannot add yourself.');
      const existing = getFriendRelationship(toUserId);
      if (existing.isFriend) throw new Error('Already friends.');
      if (existing.incoming) {
        await respondToFriendRequest(existing.incoming.id, 'accepted');
        return existing.incoming;
      }
      if (existing.outgoing) return existing.outgoing;

      const { data, error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: authUser.id,
          to_user_id: toUserId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.log('Error sending friend request:', error);
        throw new Error(error.message || 'Unable to send friend request.');
      }

      await fetchFriendRequests(authUser.id);
      return data;
    },
    [authUser?.id, getFriendRelationship, fetchFriendRequests, respondToFriendRequest]
  );

  const respondToFriendRequest = useCallback(
    async (requestId, responseStatus = 'declined') => {
      if (!authUser?.id) throw new Error('You must be logged in to respond.');
      const normalized = responseStatus === 'accepted' ? 'accepted' : 'declined';
      const nowISO = new Date().toISOString();

      const { data, error } = await supabase
        .from('friend_requests')
        .update({ status: normalized, responded_at: nowISO })
        .eq('id', requestId)
        .eq('to_user_id', authUser.id)
        .select()
        .single();

      if (error) {
        console.log('Error responding to friend request:', error);
        throw new Error(error.message || 'Unable to respond to request.');
      }

      if (normalized === 'accepted' && data?.from_user_id) {
        const { error: friendError } = await supabase
          .from('friendships')
          .upsert(
            { user_id: authUser.id, friend_id: data.from_user_id, created_at: nowISO },
            { onConflict: 'user_id,friend_id' }
          );

        if (friendError && friendError.code !== '23505') {
          console.log('Error creating friendship:', friendError);
        }
      }

      await refreshFriendData(authUser.id);
      return data;
    },
    [authUser?.id, refreshFriendData]
  );

  const deleteFriend = useCallback(
    async (friendId) => {
      if (!authUser?.id || !friendId) return;
      const ids = [authUser.id, friendId];
      try {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .or(
            `and(user_id.eq.${ids[0]},friend_id.eq.${ids[1]}),and(user_id.eq.${ids[1]},friend_id.eq.${ids[0]})`
          );
        if (error) {
          console.log('Error deleting friendship:', error);
          throw error;
        }
      } catch (err) {
        console.log('Error deleting friendship:', err);
        throw err;
      }
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      await refreshFriendData(authUser.id);
    },
    [authUser?.id, refreshFriendData]
  );

  const onlineFriends = useMemo(
    () => friends.filter((f) => isUserOnline(f.id)),
    [friends, isUserOnline]
  );

const fetchHabitsFromSupabase = async (userId, _groupListParam) => {
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

  const resetAllHabitStreaks = useCallback(async () => {
    if (!authUser?.id) return;
    await persistStreakFrozenState(false);
    setHabits((prev) => prev.map((h) => ({ ...h, streak: 0 })));
    const { error } = await supabase
      .from('habits')
      .update({ streak: 0 })
      .eq('user_id', authUser.id);
    if (error) {
      console.log('Error resetting habit streaks:', error);
    }
  }, [authUser?.id, persistStreakFrozenState]);



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

  if (streakFrozen) {
    await persistStreakFrozenState(false);
  }
};

const isHabitCompletedToday = (habitId) => {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return false;
  const today = new Date().toDateString();
  return habit.completedDates?.includes(today) || false;
};

  const applyStreakFreezeIfNeeded = useCallback(async () => {
    if (!authUser?.id || !profileLoaded) return;

    const userId = authUser.id;
    const lastActive = await readLastActive(userId);
    const now = new Date();
    const todayStart = new Date(now.toDateString());

    if (!lastActive) {
      await writeLastActive(userId, now);
      return;
    }

    const hasAnyStreak = habits.some((h) => (h.streak || 0) > 0);
    if (!hasAnyStreak) {
      // Nothing to freeze; ensure we aren't stuck in a frozen state and record activity.
      if (streakFrozen) {
        await persistStreakFrozenState(false);
      }
      await writeLastActive(userId, now);
      return;
    }

    const lastActiveStart = new Date(lastActive.toDateString());
    const dayDiff = Math.max(
      Math.floor((todayStart.getTime() - lastActiveStart.getTime()) / (24 * 60 * 60 * 1000)),
      0
    );

    const isPremiumUser =
      profile?.isPremium ||
      computeIsPremium(profile?.plan, profile?.premiumExpiresAt || profile?.premium_expires_at);

    // Premium users get a 24h freeze window; streak resets only after 48h away.
    const resetThreshold = isPremiumUser ? 2 : 1;

    if (isPremiumUser && dayDiff === 1) {
      await persistStreakFrozenState(true);
    } else if (!isPremiumUser && streakFrozen) {
      await persistStreakFrozenState(false);
    }

    if (dayDiff > resetThreshold) {
      await resetAllHabitStreaks();
    }

    await writeLastActive(userId, now);
  }, [authUser?.id, profile?.isPremium, profile?.plan, profile?.premiumExpiresAt, profile?.premium_expires_at, profileLoaded, resetAllHabitStreaks, persistStreakFrozenState, streakFrozen, habits]);

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

  let mappedTasks = (data || []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority || 'medium',
    date: t.date, // stored as date string YYYY-MM-DD
    time: t.time,
    completed: t.completed,
    createdAt: t.created_at,
    sharedTaskId: t.shared_task_id || t.id,
  }));

  if (mappedTasks.length) {
    try {
      const taskIds = mappedTasks.map((t) => t.id).filter(Boolean);
      const { data: linkRows, error: linkError } = await supabase
        .from('task_participants')
        .select('task_id, participant_task_id')
        .eq('user_id', userId)
        .in('participant_task_id', taskIds);

      if (!linkError && Array.isArray(linkRows) && linkRows.length) {
        const linkMap = {};
        linkRows.forEach((row) => {
          if (row?.participant_task_id && row?.task_id) {
            linkMap[row.participant_task_id] = row.task_id;
          }
        });
        mappedTasks = mappedTasks.map((task) => ({
          ...task,
          sharedTaskId: linkMap[task.id] || task.sharedTaskId,
        }));
      } else if (linkError && !isMissingRelationError(linkError, 'task_participants')) {
        console.log('Error fetching task participant links:', linkError);
      }
    } catch (err) {
      console.log('Error enriching tasks with participant links:', err);
    }
  }

  setTasks(mappedTasks);
};



  // TASK FUNCTIONS
  const addTask = async (task) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a task.');
  }
  if (!task?.date || Number.isNaN(new Date(task.date).getTime())) {
    throw new Error('A date is required to schedule a task.');
  }
  if (!task?.time) {
    throw new Error('A time is required to schedule a task.');
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: authUser.id,
      title: task.title,
      description: task.description || null,
      priority: task.priority || 'medium',
      date: task.date,
      time: task.time,
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
    sharedTaskId: data.shared_task_id || data.id,
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

  // Best-effort cleanup for collaboration links if this task is a shared copy.
  try {
    await supabase
      .from('task_participants')
      .delete()
      .eq('participant_task_id', taskId)
      .eq('user_id', authUser.id);
  } catch (err) {
    // ignore
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
    const key = normalizeDateKey(row.date);
    if (!key) return;
    healthMap[key] = mapHealthRow(row);
  });

  const foodMap = {};
  (foodEntries || []).forEach((row) => {
    const key = normalizeDateKey(row.date);
    if (!key) return;
    if (!foodMap[key]) foodMap[key] = [];
    foodMap[key].push({
      id: row.id,
      name: row.name,
      calories: row.calories,
      proteinGrams: asNumber(row.protein_grams, null),
      carbsGrams: asNumber(row.carbs_grams, null),
      fatGrams: asNumber(row.fat_grams, null),
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
    setTodayHealth(defaultHealthDay());
  }
};



  // HEALTH FUNCTIONS
  // HEALTH FUNCTIONS
const upsertHealthDayRecord = async (dateISO, healthDay) => {
  const nowISO = new Date().toISOString();
  const createdAt = healthDay?.createdAt || nowISO;
  const payload = {
    user_id: authUser.id,
    date: dateISO,
    mood: healthDay?.mood,
    water_intake: healthDay?.waterIntake,
    sleep_time: healthDay?.sleepTime,
    wake_time: healthDay?.wakeTime,
    sleep_quality: healthDay?.sleepQuality,
    calories: healthDay?.calories,
    foods: healthDay?.foods,
    created_at: createdAt,
    updated_at: nowISO,
  };

  // Only include primary key when we actually have one; sending null violates NOT NULL.
  if (healthDay?.healthDayId) {
    payload.id = healthDay.healthDayId;
  }

  const { data, error } = await supabase
    .from('health_daily')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) {
    console.log('Error saving health data:', error);
  }

  return data || null;
};

  const updateHealthForDate = async (dateISO, updates = {}) => {
    if (!authUser?.id) {
      throw new Error('You must be logged in to update health data.');
    }

  const normalizedDate = normalizeDateKey(dateISO);
  const base = healthData[normalizedDate] || defaultHealthDay();
  const { energy: _ignoreEnergy, ...updatesWithoutEnergy } = updates || {};
  const { energy: _ignoreBaseEnergy, ...baseWithoutEnergy } = base;
  const nowISO = new Date().toISOString();
  const createdAt = baseWithoutEnergy.createdAt || updatesWithoutEnergy?.createdAt || nowISO;
  const newHealth = {
    ...baseWithoutEnergy,
    ...updatesWithoutEnergy,
    mood: asNumber(updatesWithoutEnergy.mood, baseWithoutEnergy.mood),
    waterIntake: asNumber(updatesWithoutEnergy.waterIntake, baseWithoutEnergy.waterIntake),
    createdAt,
    updatedAt: nowISO,
  };
  const newHealthData = { ...healthData, [normalizedDate]: newHealth };
  setHealthData(newHealthData);

  // Update todayHealth if this is the current day
  const todayISO = new Date().toISOString().slice(0, 10);
  if (normalizedDate === todayISO) {
    setTodayHealth(newHealth);
  }

    // Persist food logs locally so they survive logout/app close
    if (updates.foods !== undefined) {
      const updatedFoodLogs = { ...(foodLogs || {}) };
      updatedFoodLogs[normalizedDate] = updates.foods;
      setFoodLogs(updatedFoodLogs);
      await persistFoodLogsLocally(updatedFoodLogs, authUser.id);
    }

  const healthDayRecord = await upsertHealthDayRecord(normalizedDate, newHealth);
  if (healthDayRecord) {
    const persistedHealth = mapHealthRow(healthDayRecord, newHealth);
    setHealthData((prev) => ({
      ...prev,
      [normalizedDate]: persistedHealth,
    }));
    if (normalizedDate === todayISO) {
      setTodayHealth(persistedHealth);
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
  const dayKey = normalizeDateKey(dateISO);
  const baseDay = healthData[dayKey] || defaultHealthDay();

  const healthDayRecord = await upsertHealthDayRecord(dayKey, baseDay);
  const healthDayId = healthDayRecord?.id || baseDay.healthDayId;
  const normalizeMacro = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizedFood = {
    ...food,
    calories: asNumber(food.calories, 0) || 0,
    proteinGrams: normalizeMacro(food.proteinGrams),
    carbsGrams: normalizeMacro(food.carbsGrams),
    fatGrams: normalizeMacro(food.fatGrams),
  };

  const nowISO = new Date().toISOString();
  const newFood = {
    ...normalizedFood,
    id: Date.now().toString(),
    timestamp: nowISO,
  };

  const insertPayload = pruneUndefined({
    user_id: authUser?.id,
    health_day_id: healthDayId,
    date: dayKey,
    name: newFood.name,
    calories: newFood.calories,
    protein_grams: newFood.proteinGrams,
    carbs_grams: newFood.carbsGrams,
    fat_grams: newFood.fatGrams,
    created_at: nowISO,
  });

  const insertFoodEntry = async (payload) =>
    supabase.from('health_food_entries').insert(payload).select().single();

  let foodRow = null;
  let insertError = null;
  const firstInsert = await insertFoodEntry(insertPayload);
  foodRow = firstInsert.data;
  insertError = firstInsert.error;

  // If macro columns are missing in the DB, retry without them so food logging still works
  if (insertError && insertError.code === '42703') {
    const fallbackPayload = {
      user_id: authUser?.id,
      health_day_id: healthDayId,
      date: dayKey,
      name: newFood.name,
      calories: newFood.calories,
      created_at: nowISO,
    };
    const retry = await insertFoodEntry(fallbackPayload);
    foodRow = retry.data;
    insertError = retry.error;
  }

  if (insertError) {
    console.log('Error saving food entry:', insertError);
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

  await updateHealthForDate(dayKey, {
    healthDayId,
    foods: updatedFoods,
    calories: totalCalories,
    createdAt: healthDayRecord?.created_at || baseDay.createdAt,
    updatedAt: healthDayRecord?.updated_at || baseDay.updatedAt,
  });
};

const deleteFoodEntryForDate = async (dateISO, foodId) => {
  if (!authUser?.id) return;
  const dayKey = normalizeDateKey(dateISO);
  const baseDay = healthData[dayKey] || defaultHealthDay();
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

  await updateHealthForDate(dayKey, {
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





const ROUTINE_TASKS_TABLE = 'routine_tasks';

const fetchRoutinesFromSupabase = async (userId) => {
  const { data: routineRows, error } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching routines:', error);
    return;
  }

  const routinesMap = (routineRows || []).map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    tasks: [],
  }));

  const routineIds = routinesMap.map((r) => r.id).filter(Boolean);

  let tasksByRoutine = {};
  if (routineIds.length > 0) {
    const { data: taskRows, error: taskError } = await supabase
      .from(ROUTINE_TASKS_TABLE)
      .select('*')
      .in('routine_id', routineIds)
      .order('position', { ascending: true });

    if (taskError) {
      console.log('Error fetching routine tasks:', taskError);
    } else {
      tasksByRoutine = (taskRows || []).reduce((acc, row) => {
        const list = acc[row.routine_id] || [];
        list.push({
          id: row.id,
          name: row.name,
          position: row.position ?? list.length,
          createdAt: row.created_at,
        });
        acc[row.routine_id] = list.sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
        return acc;
      }, {});
    }
  }

  const combined = routinesMap.map((r) => ({
    ...r,
    tasks: tasksByRoutine[r.id] || [],
  }));

  setRoutines(combined);
  await persistRoutinesLocally(combined);
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

    setRoutines((prev) => {
      const next = [...prev, newRoutine];
      persistRoutinesLocally(next);
      return next;
    });
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

    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === routineId ? updated : r));
      persistRoutinesLocally(next);
      return next;
    });
  };

const deleteRoutine = async (routineId) => {
  if (!authUser?.id) return;

  // Remove tasks first to keep data clean
  await supabase.from(ROUTINE_TASKS_TABLE).delete().eq('routine_id', routineId).eq('user_id', authUser.id);

  const { error } = await supabase
    .from('routines')
    .delete()
      .eq('id', routineId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error deleting routine:', error);
    }

    setRoutines((prev) => {
      const next = prev.filter((r) => r.id !== routineId);
      persistRoutinesLocally(next);
      return next;
    });
  };

const addTaskToRoutine = async (routineId, task) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const nextPosition = (routine.tasks?.length || 0);
  const { data, error } = await supabase
    .from(ROUTINE_TASKS_TABLE)
    .insert({
      user_id: authUser.id,
      routine_id: routineId,
      name: task.name,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding task to routine:', error);
    return;
  }

  const newTask = {
    id: data.id,
    name: data.name,
    position: data.position ?? nextPosition,
    createdAt: data.created_at,
  };

  const updatedTasks = [...(routine.tasks || []), newTask].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const updatedRoutine = { ...routine, tasks: updatedTasks };

  setRoutines((prev) => {
    const next = prev.map((r) => (r.id === routineId ? updatedRoutine : r));
    persistRoutinesLocally(next);
    return next;
  });
};

const removeTaskFromRoutine = async (routineId, taskId) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const updatedTasks = (routine.tasks || []).filter((t) => t.id !== taskId);
  const resequenced = updatedTasks.map((t, idx) => ({ ...t, position: idx }));
  const updatedRoutine = { ...routine, tasks: resequenced };

  await supabase.from(ROUTINE_TASKS_TABLE).delete().eq('id', taskId).eq('user_id', authUser.id);

  // update positions for remaining tasks
  await Promise.all(
    resequenced.map((t) =>
      supabase
        .from(ROUTINE_TASKS_TABLE)
        .update({ position: t.position })
        .eq('id', t.id)
        .eq('user_id', authUser.id)
    )
  );

  setRoutines((prev) => {
    const next = prev.map((r) => (r.id === routineId ? updatedRoutine : r));
    persistRoutinesLocally(next);
    return next;
  });
};

const reorderRoutineTasks = async (routineId, newTaskOrder) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const resequenced = (newTaskOrder || []).map((t, idx) => ({
    ...t,
    position: idx,
  }));

  await Promise.all(
    resequenced.map((t) =>
      supabase
        .from(ROUTINE_TASKS_TABLE)
        .update({ position: t.position })
        .eq('id', t.id)
        .eq('user_id', authUser.id)
    )
  );

  const updatedRoutine = { ...routine, tasks: resequenced };

  setRoutines((prev) => {
    const next = prev.map((r) => (r.id === routineId ? updatedRoutine : r));
    persistRoutinesLocally(next);
    return next;
  });
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

const mapReminderRow = (row) => {
  const parts = parseDateTimeParts(row?.date || null);
  return {
    id: row?.id,
    title: row?.title,
    description: row?.description || '',
    date: parts.date,
    time: row?.time || parts.time,
    dateTime: parts.dateTimeISO,
    createdAt: row?.created_at,
  };
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

  const mapped = (data || []).map((r) => mapReminderRow(r));

  setReminders(mapped);
};

  // REMINDER FUNCTIONS
const addReminder = async (reminder) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a reminder.');
  }

  const combinedDate = buildDateWithTime(
    reminder.date || reminder.dateTime,
    reminder.time,
    DEFAULT_EVENT_TIME.hour,
    DEFAULT_EVENT_TIME.minute
  );

  const payload = {
    user_id: authUser.id,
    title: reminder.title,
    description: reminder.description || null,
  };

  if (combinedDate) {
    payload.date = combinedDate.toISOString().slice(0, 10);
    payload.time = reminder.time || formatTimeFromDate(combinedDate);
  } else {
    payload.date = reminder.dateTime || reminder.date || null;
    if (reminder.time) payload.time = reminder.time;
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.log('Error adding reminder:', error);
    throw error;
  }

  const newReminder = mapReminderRow({
    ...data,
    description: data?.description ?? reminder.description,
    time: data?.time ?? reminder.time,
  });

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





const getBudgetStorageKey = (userId) =>
  `${STORAGE_KEYS.BUDGETS}_${userId || 'anon'}`;

const persistBudgetGroupsLocally = async (data, userIdParam) => {
  const userId = userIdParam || authUser?.id;
  if (!userId) return;
  await saveToStorage(getBudgetStorageKey(userId), data);
};

const hydrateBudgetGroups = async (userId) => {
  if (!userId) {
    setBudgetGroups([]);
    return;
  }

  const stored = await AsyncStorage.getItem(getBudgetStorageKey(userId));
  if (!stored) {
    setBudgetGroups([]);
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      setBudgetGroups(parsed);
    } else {
      setBudgetGroups([]);
    }
  } catch (err) {
    console.log('Error parsing cached budgets', err);
    setBudgetGroups([]);
  }
};

const fetchBudgetGroupsFromSupabase = async (userId) => {
  if (!userId) return;
  const { data, error } = await supabase
    .from('budget_groups')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching budget groups:', error);
    await hydrateBudgetGroups(userId);
    return;
  }

  const mapped = (data || []).map((row) => ({
    id: row.id,
    name: row.name || 'Budget group',
    type: row.type || 'budget',
    cadence: row.cadence || 'monthly',
    target: Number(row.target) || 0,
    categories: Array.isArray(row.categories)
      ? row.categories
      : row.categories
      ? [].concat(row.categories)
      : [],
    currency: row.currency || userSettings.defaultCurrencyCode || 'USD',
    note: row.note || '',
    recurringPayments: Array.isArray(row.recurring_payments)
      ? row.recurring_payments
      : [],
    startDate: row.start_date || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  setBudgetGroups(mapped);
  persistBudgetGroupsLocally(mapped, userId);
};

const getBudgetWindow = (cadence = 'monthly', referenceDate = new Date()) => {
  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const start = new Date(today);
  const end = new Date(today);

  if (cadence === 'weekly') {
    const day = today.getDay();
    start.setDate(today.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  if (cadence === 'yearly') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setFullYear(start.getFullYear() + 1, 0, 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  // Default monthly
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(start.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

const getBudgetAssignmentKey = (userId) =>
  `${STORAGE_KEYS.BUDGET_ASSIGNMENTS}_${userId || 'anon'}`;

const persistBudgetAssignmentsLocally = async (data, userIdParam) => {
  const userId = userIdParam || authUser?.id;
  if (!userId) return;
  await saveToStorage(getBudgetAssignmentKey(userId), data);
};

const hydrateBudgetAssignments = async (userId) => {
  if (!userId) {
    setBudgetAssignments({});
    return;
  }
  const stored = await AsyncStorage.getItem(getBudgetAssignmentKey(userId));
  if (!stored) {
    setBudgetAssignments({});
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    setBudgetAssignments(parsed && typeof parsed === 'object' ? parsed : {});
  } catch (err) {
    console.log('Error parsing budget assignments', err);
    setBudgetAssignments({});
  }
};

const fetchBudgetAssignmentsFromSupabase = async (userId) => {
  if (!userId) return;
  const { data, error } = await supabase
    .from('budget_group_transactions')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.log('Error fetching budget assignments:', error);
    await hydrateBudgetAssignments(userId);
    return;
  }

  const map = {};
  (data || []).forEach((row) => {
    const txId = row.transaction_id;
    if (!txId) return;
    if (!map[txId]) map[txId] = [];
    map[txId].push(row.group_id);
  });

  setBudgetAssignments(map);
  persistBudgetAssignmentsLocally(map, userId);
};

const getBudgetSpendForGroup = useCallback(
  (group, referenceDate = new Date()) => {
    if (!group) {
      return { spent: 0, start: null, end: null, income: 0 };
    }

    const { start, end } = getBudgetWindow(group.cadence, referenceDate);

    const inWindow = finances.filter((t) => {
      const ts = new Date(t.date || t.createdAt);
      return ts >= start && ts < end;
    });

    const spent = inWindow
      .filter((t) => t.type === 'expense')
      .filter((t) => {
        const assigned = budgetAssignments?.[t.id] || [];
        return assigned.includes(group.id);
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const income = 0;

    return { spent, start, end, income };
  },
  [finances, budgetAssignments]
);

const linkTransactionToBudgetGroups = async (transactionId, groupIds = []) => {
  if (!authUser?.id || !transactionId) return;
  const clean = Array.isArray(groupIds)
    ? groupIds.filter(Boolean)
    : [];
  try {
    await supabase
      .from('budget_group_transactions')
      .delete()
      .eq('user_id', authUser.id)
      .eq('transaction_id', transactionId);

    if (clean.length) {
      const rows = clean.map((groupId) => ({
        id: uuid.v4(),
        user_id: authUser.id,
        transaction_id: transactionId,
        group_id: groupId,
      }));
      await supabase
        .from('budget_group_transactions')
        .upsert(rows, { onConflict: 'transaction_id,group_id' });
    }
  } catch (err) {
    console.log('Error syncing budget assignments:', err);
  }

  setBudgetAssignments((prev) => {
    const next = { ...prev };
    if (!clean.length) {
      delete next[transactionId];
    } else {
      next[transactionId] = clean;
    }
    persistBudgetAssignmentsLocally(next, authUser.id);
    return next;
  });
};

const addBudgetGroup = async (payload = {}) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a budget.');
  }

  const nowISO = new Date().toISOString();
  const insertPayload = {
    user_id: authUser.id,
    name: payload.name?.trim() || 'Budget group',
    type: payload.type === 'recurring' ? 'recurring' : 'budget',
    cadence: payload.cadence || 'monthly',
    target: Number(payload.target) || 0,
    categories: Array.isArray(payload.categories)
      ? payload.categories.filter(Boolean)
      : [],
    currency: payload.currency || userSettings.defaultCurrencyCode || 'USD',
    note: payload.note || '',
    recurring_payments: Array.isArray(payload.recurringPayments)
      ? payload.recurringPayments
      : [],
    start_date: payload.startDate || nowISO,
  };

  const { data, error } = await supabase
    .from('budget_groups')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.log('Error adding budget group:', error);
    throw error;
  }

  const newGroup = {
    id: data.id,
    name: data.name,
    type: data.type,
    cadence: data.cadence,
    target: Number(data.target) || 0,
    categories: Array.isArray(data.categories) ? data.categories : [],
    currency: data.currency,
    note: data.note,
    recurringPayments: Array.isArray(data.recurring_payments)
      ? data.recurring_payments
      : [],
    startDate: data.start_date || nowISO,
    createdAt: data.created_at || nowISO,
    updatedAt: data.updated_at || nowISO,
  };

  setBudgetGroups((prev) => {
    const next = [...prev, newGroup];
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  return newGroup;
};

const updateBudgetGroup = async (groupId, updates = {}) => {
  if (!authUser?.id) return null;
  let updated = null;

  const updatePayload = {
    name: updates.name,
    type: updates.type,
    cadence: updates.cadence,
    target: updates.target,
    categories: updates.categories,
    currency: updates.currency,
    note: updates.note,
    recurring_payments: updates.recurringPayments,
    start_date: updates.startDate,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('budget_groups')
    .update(updatePayload)
    .eq('id', groupId)
    .eq('user_id', authUser.id);

  setBudgetGroups((prev) => {
    const next = prev.map((group) => {
      if (group.id !== groupId) return group;
      updated = {
        ...group,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  return updated;
};

const deleteBudgetGroup = async (groupId) => {
  if (!authUser?.id) return;

  await supabase
    .from('budget_group_transactions')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', authUser.id);

  await supabase
    .from('budget_groups')
    .delete()
    .eq('id', groupId)
    .eq('user_id', authUser.id);

  setBudgetGroups((prev) => {
    const next = prev.filter((g) => g.id !== groupId);
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  setBudgetAssignments((prev) => {
    const next = {};
    Object.entries(prev || {}).forEach(([txId, groupIds]) => {
      const filtered = (groupIds || []).filter((gid) => gid !== groupId);
      if (filtered.length) next[txId] = filtered;
    });
    persistBudgetAssignmentsLocally(next, authUser.id);
    return next;
  });
};

const addRecurringPaymentToGroup = async (groupId, payment = {}) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add recurring payments.');
  }

  const newPayment = {
    id: payment.id || uuid.v4(),
    name: payment.name?.trim() || 'Recurring payment',
    amount: Number(payment.amount) || 0,
    cadence: payment.cadence || 'monthly',
    nextDueDate: payment.nextDueDate || null,
    startDate: payment.startDate || new Date().toISOString(),
  };

  setBudgetGroups((prev) => {
    const next = prev.map((group) => {
      if (group.id !== groupId) return group;
      const recurringPayments = Array.isArray(group.recurringPayments)
        ? [...group.recurringPayments, newPayment]
        : [newPayment];
      supabase
        .from('budget_groups')
        .update({ recurring_payments: recurringPayments, updated_at: new Date().toISOString() })
        .eq('id', groupId)
        .eq('user_id', authUser.id);
      return {
        ...group,
        recurringPayments,
        updatedAt: new Date().toISOString(),
      };
    });
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  return newPayment;
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

  if (transaction.type === 'expense') {
    const budgetGroupIds = Array.isArray(transaction.budgetGroupIds)
      ? transaction.budgetGroupIds.filter(Boolean)
      : [];
    await linkTransactionToBudgetGroups(newTransaction.id, budgetGroupIds);
  }

  return newTransaction;
};

const deleteTransaction = async (transactionId) => {
  if (!authUser?.id) return;

  await supabase
    .from('budget_group_transactions')
    .delete()
    .eq('transaction_id', transactionId)
    .eq('user_id', authUser.id);

  const { error } = await supabase
    .from('finance_transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting transaction:', error);
  }

  setFinances((prev) => prev.filter((f) => f.id !== transactionId));
  setBudgetAssignments((prev) => {
    if (!prev[transactionId]) return prev;
    const next = { ...prev };
    delete next[transactionId];
    persistBudgetAssignmentsLocally(next, authUser.id);
    return next;
  });
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
  const isMissingColumnError = (error, column) => {
    if (!error) return false;
    const message = (error.message || '').toLowerCase();
    const columnName = (column || '').toLowerCase();
    return (
      error.code === '42703' ||
      message.includes('does not exist') ||
      (columnName && message.includes(columnName))
    );
  };

  const mapProfileRow = (row) => ({
    profileId: row?.id || null,
    name:
      row?.full_name ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name ||
      authUser?.email ||
      defaultProfile.name,
    username: row?.username || authUser?.user_metadata?.username || '',
    email: row?.email || authUser?.email || profile.email || defaultProfile.email,
    photo: getAvatarPublicUrl(row?.photo || row?.avatar_url || row?.avatar) || null,
    dailyCalorieGoal: row?.daily_calorie_goal ?? defaultProfile.dailyCalorieGoal,
    dailyWaterGoal: row?.daily_water_goal ?? defaultProfile.dailyWaterGoal,
    dailySleepGoal: row?.daily_sleep_goal ?? defaultProfile.dailySleepGoal,
    plan: row?.plan || defaultProfile.plan,
    premiumExpiresAt: row?.premium_expires_at || row?.premiumExpiresAt || defaultProfile.premiumExpiresAt,
    premium_expires_at: row?.premium_expires_at || row?.premiumExpiresAt || defaultProfile.premiumExpiresAt,
    isPremium: computeIsPremium(row?.plan || defaultProfile.plan, row?.premium_expires_at || row?.premiumExpiresAt),
  });

  // Ensure profile state has at least auth-derived values when we gain an auth user
  useEffect(() => {
    if (!authUser) return;
    setProfile((prev) => {
      const nextName =
        prev?.name && prev.name !== defaultProfile.name
          ? prev.name
          : authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email ||
            defaultProfile.name;
      const nextEmail =
        prev?.email && prev.email !== defaultProfile.email
          ? prev.email
          : authUser.email || defaultProfile.email;
      if (nextName === prev.name && nextEmail === prev.email) return prev;
      return { ...prev, name: nextName, email: nextEmail };
    });
  }, [authUser]);

  const fetchProfileFromSupabase = async (userId) => {
    if (!userId) return null;

    const fetchByColumn = async (column) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq(column, userId)
        .limit(1);

      if (error) return { row: null, error };
      const row = Array.isArray(data) ? data[0] : data;
      return { row: row || null, error: null };
    };

    const pickBestProfileRow = (rows) => {
      const candidates = (rows || []).filter(Boolean);
      if (!candidates.length) return null;

      const parseTime = (value) => {
        if (!value) return null;
        const ms = new Date(value).getTime();
        return Number.isNaN(ms) ? null : ms;
      };

      const normalizeExpiry = (row) =>
        row?.premium_expires_at ?? row?.premiumExpiresAt ?? row?.premiumExpires ?? null;

      const scoreRow = (row) => {
        const plan = row?.plan || '';
        const expiry = normalizeExpiry(row);
        let score = 0;

        if (computeIsPremium(plan, expiry)) score += 100;
        const normalizedPlan = String(plan || '').toLowerCase();
        if (normalizedPlan === 'premium' || normalizedPlan === 'pro') score += 25;
        if (expiry) score += 5;
        if (row?.user_id) score += 2;
        if (row?.id === userId) score += 1;

        return score;
      };

      return candidates
        .slice()
        .sort((a, b) => {
          const scoreDiff = scoreRow(b) - scoreRow(a);
          if (scoreDiff) return scoreDiff;
          const updatedDiff = (parseTime(b?.updated_at) || 0) - (parseTime(a?.updated_at) || 0);
          if (updatedDiff) return updatedDiff;
          return (parseTime(b?.created_at) || 0) - (parseTime(a?.created_at) || 0);
        })[0];
    };

    let row = null;
    let lastError = null;

    const { row: byIdRow, error: byIdError } = await fetchByColumn('id');
    if (byIdError && !isMissingColumnError(byIdError, 'id')) {
      lastError = byIdError;
    }

    const { row: byUserIdRow, error: byUserIdError } = await fetchByColumn('user_id');
    if (byUserIdError && !isMissingColumnError(byUserIdError, 'user_id')) {
      lastError = byUserIdError;
    }

    row = pickBestProfileRow([byIdRow, byUserIdRow]);

    if (!row && lastError) {
      console.log('Error fetching profile:', lastError);
    }

    if (!row) {
      row = await upsertProfileRow({
        id: userId,
        full_name:
          profile.name ||
          authUser?.user_metadata?.full_name ||
          authUser?.user_metadata?.name ||
          authUser?.email,
        email: authUser?.email || profile.email,
      });
    }

    if (row) {
      const mapped = mapProfileRow(row);
      setProfile(mapped);
      setHasOnboarded(!!row.has_onboarded);
      setProfileLoaded(true);
    }

    return row;
  };

  const upsertProfileRow = async (fields = {}) => {
    const userId = authUser?.id || fields.id;
    if (!userId) return null;
    const nowISO = new Date().toISOString();

    const basePayload = {
      id: userId,
      full_name:
        fields.full_name ??
        fields.name ??
        authUser?.user_metadata?.full_name ??
        authUser?.user_metadata?.name ??
        authUser?.email ??
        profile.name,
      username:
        fields.username ??
        authUser?.user_metadata?.username ??
      profile.username ??
      null,
    email: fields.email ?? authUser?.email ?? profile.email ?? defaultProfile.email,
    avatar_url: fields.avatar_url ?? fields.photo ?? profile.photo ?? undefined,
    photo: fields.photo ?? profile.photo ?? undefined,
    has_onboarded: fields.has_onboarded ?? hasOnboarded,
    daily_calorie_goal: fields.daily_calorie_goal ?? fields.dailyCalorieGoal ?? profile.dailyCalorieGoal,
    daily_water_goal: fields.daily_water_goal ?? fields.dailyWaterGoal ?? profile.dailyWaterGoal,
    daily_sleep_goal: fields.daily_sleep_goal ?? fields.dailySleepGoal ?? profile.dailySleepGoal,
      updated_at: nowISO,
    };

    // Don't overwrite subscription fields unless explicitly provided.
    // This prevents early boot/profile-creation upserts from resetting values
    // that may be managed externally (e.g. Supabase dashboard, webhooks).
    if (Object.prototype.hasOwnProperty.call(fields, 'plan')) {
      if (fields.plan !== undefined) basePayload.plan = fields.plan;
    }
    if (
      Object.prototype.hasOwnProperty.call(fields, 'premium_expires_at') ||
      Object.prototype.hasOwnProperty.call(fields, 'premiumExpiresAt')
    ) {
      const nextPremiumExpiresAt = Object.prototype.hasOwnProperty.call(fields, 'premium_expires_at')
        ? fields.premium_expires_at
        : fields.premiumExpiresAt;
      if (nextPremiumExpiresAt !== undefined) {
        basePayload.premium_expires_at = nextPremiumExpiresAt;
      }
    }

    const payload = pruneUndefined(basePayload);

    const attemptUpsert = async (payload, onConflict) => {
      const options = onConflict ? { onConflict } : undefined;
      return supabase.from('profiles').upsert(payload, options).select().single();
    };

    let data = null;
    let error = null;

    // First try a schema that has user_id as the unique key
    ({ data, error } = await attemptUpsert({ ...payload, user_id: userId }, 'user_id'));

    // If that fails because the column is missing or not unique, fall back to the id-based schema
    if (error) {
      if (isMissingColumnError(error, 'user_id') || error.code === '23505') {
        ({ data, error } = await attemptUpsert(payload, 'id'));
      }
    }

    if (error) {
      console.log('Error saving profile:', error);
      return null;
    }

    const mapped = mapProfileRow(data);
    setProfile(mapped);
    setHasOnboarded(!!data.has_onboarded);
    setProfileLoaded(true);
    return data;
  };

  const updateProfile = async (updates) => {
    const merged = { ...profile, ...updates };

    let avatarUrl = merged.photo;
    if (updates.photo) {
      const uploadResult = await uploadProfilePhoto(updates.photo);
      avatarUrl = uploadResult?.url || avatarUrl;
    }

    const newLocalProfile = {
      ...merged,
      photo: avatarUrl,
      avatar_url: avatarUrl,
    };
    setProfile(newLocalProfile);

    const payload = {
      ...updates,
      name: newLocalProfile.name,
      username: newLocalProfile.username,
      email: newLocalProfile.email,
      avatar_url: avatarUrl,
      photo: avatarUrl,
      dailyCalorieGoal: newLocalProfile.dailyCalorieGoal,
      dailyWaterGoal: newLocalProfile.dailyWaterGoal,
      dailySleepGoal: newLocalProfile.dailySleepGoal,
    };

    return upsertProfileRow(payload);
  };

  // USER SETTINGS FUNCTIONS
  const mapSettingsRow = (row) => ({
    id: row?.id || null,
    themeName: row?.theme_name || 'default',
    notificationsEnabled: row?.notifications_enabled ?? defaultUserSettings.notificationsEnabled,
    habitRemindersEnabled: row?.habit_reminders_enabled ?? defaultUserSettings.habitRemindersEnabled,
    taskRemindersEnabled: row?.task_reminders_enabled ?? defaultUserSettings.taskRemindersEnabled,
    healthRemindersEnabled: row?.health_reminders_enabled ?? defaultUserSettings.healthRemindersEnabled,
    defaultCurrencyCode: row?.default_currency_code || defaultUserSettings.defaultCurrencyCode,
    language: row?.language || defaultUserSettings.language,
  });

  const fetchUserSettings = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.log('Error fetching user settings:', error);
      return null;
    }

    let row = data;

    if (!row) {
      row = await upsertUserSettings({ ...defaultUserSettings }, userId);
    }

    if (row) {
      const mapped = mapSettingsRow(row);
      setUserSettings(mapped);
      const themeToApply = mapped.themeName || 'default';
      setThemeName(themeToApply);
      applyTheme(themeToApply);
      cacheThemeLocally(themeToApply);
      setLanguage(mapped.language || defaultUserSettings.language);
    }

    return row;
  };

  const upsertUserSettings = async (overrides = {}, userIdParam) => {
    const userId = userIdParam || authUser?.id;
    if (!userId) return null;
    const nowISO = new Date().toISOString();
    const payload = {
      id: overrides.id || userSettings.id || undefined,
      user_id: userId,
      theme_name: overrides.themeName ?? userSettings.themeName ?? defaultUserSettings.themeName,
      notifications_enabled: overrides.notificationsEnabled ?? userSettings.notificationsEnabled ?? defaultUserSettings.notificationsEnabled,
      habit_reminders_enabled: overrides.habitRemindersEnabled ?? userSettings.habitRemindersEnabled ?? defaultUserSettings.habitRemindersEnabled,
      task_reminders_enabled: overrides.taskRemindersEnabled ?? userSettings.taskRemindersEnabled ?? defaultUserSettings.taskRemindersEnabled,
      health_reminders_enabled: overrides.healthRemindersEnabled ?? userSettings.healthRemindersEnabled ?? defaultUserSettings.healthRemindersEnabled,
      default_currency_code: overrides.defaultCurrencyCode ?? userSettings.defaultCurrencyCode ?? defaultUserSettings.defaultCurrencyCode,
      language: overrides.language ?? userSettings.language ?? defaultUserSettings.language,
      updated_at: nowISO,
    };

    if (!payload.id) {
      delete payload.id;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.log('Error saving user settings:', error);
      return null;
    }

    const mapped = mapSettingsRow(data);
    setUserSettings(mapped);
    return data;
  };

  const updateUserSettings = async (updates) => {
    const merged = { ...userSettings, ...updates };
    setUserSettings(merged);
    if (updates.language) {
      setLanguage(updates.language);
    }
    return upsertUserSettings(merged);
  };

  const t = (text) => translate(text, language || defaultUserSettings.language);

  const uploadProfilePhoto = async (uri) => {
    if (!uri) return { url: null };
    // If already a remote URL or data URI, keep as-is (no upload)
    if (uri.startsWith('http') || uri.startsWith('data:image')) {
      return { url: uri };
    }
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onerror = reject;
        reader.onloadend = () => resolve(reader.result);
      });
      reader.readAsDataURL(blob);
      const dataUrl = (await base64Promise) || uri;
      return { url: typeof dataUrl === 'string' ? dataUrl : uri };
    } catch (err) {
      console.log('Error preparing avatar upload:', err);
      return { url: uri };
    }
  };

  // AUTH FUNCTIONS
  const persistOnboarding = async (value) => {
    setHasOnboarded(value);
    await upsertProfileRow({ has_onboarded: value });
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
        user.user_metadata?.username ||
        user.email ||
        prev.name,
      username: user.user_metadata?.username || prev.username,
      email: user.email || prev.email,
    }));
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
    await clearCachedSession();
    setAuthUser(null);

    setHasOnboarded(false);
    setProfile(defaultProfile);
    setUserSettings(defaultUserSettings);
    setThemeName('default');
    applyTheme('default');
    cacheThemeLocally('default');
  };

  const deleteAccount = async () => {
    if (!authUser?.id) {
      throw new Error('You must be signed in to delete your account.');
    }
    const userId = authUser.id;

    const safeDelete = async (table, column = 'user_id') => {
      const { error } = await supabase.from(table).delete().eq(column, userId);
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
    };

    try {
      // Child rows first
      await safeDelete('habit_completions');
      await safeDelete('health_food_entries');
      await safeDelete('health_daily');

      // Primary entities
      await safeDelete('habits');
      await safeDelete('tasks');
      await safeDelete('notes');
      await safeDelete('routines');
      await safeDelete('chores');
      await safeDelete('reminders');
      await safeDelete('groceries');
      await safeDelete('finance_transactions');

      // Settings/profile
      await safeDelete('user_settings');
      await safeDelete('profiles', 'id');
      await safeDelete('profiles');
    } catch (error) {
      const message = error?.message || 'Unable to delete account.';
      throw new Error(message);
    } finally {
      // Always sign out and clear local state
      await signOut();
    }
  };

  const changeTheme = async (name) => {
    setThemeName(name);
    applyTheme(name);
    cacheThemeLocally(name);
    await upsertUserSettings({ ...userSettings, themeName: name });
  };

  // NOTIFICATION HELPERS
  const scheduleTaskNotifications = async () => {
    const now = Date.now();
    const pendingTasks = (tasks || []).filter((t) => t.date && !t.completed);

    for (const task of pendingTasks) {
      const scheduledAt = buildDateWithTime(
        task.date,
        task.time,
        DEFAULT_EVENT_TIME.hour,
        DEFAULT_EVENT_TIME.minute
      );

      if (!scheduledAt) continue;

      const baseBody = `Due ${formatFriendlyDateTime(scheduledAt)}`;
      const oneDayBefore = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
      if (oneDayBefore.getTime() > now) {
        await scheduleLocalNotificationAsync({
          title: `Tomorrow: ${task.title}`,
          body: baseBody,
          data: { type: 'task', id: task.id },
          trigger: oneDayBefore,
        });
      }

      const thirtyBefore = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
      const triggerTime =
        thirtyBefore.getTime() > now ? thirtyBefore : scheduledAt;

      if (triggerTime.getTime() > now) {
        await scheduleLocalNotificationAsync({
          title: 'Upcoming task',
          body: `${task.title} • ${formatFriendlyDateTime(scheduledAt)}`,
          data: { type: 'task', id: task.id },
          trigger: triggerTime,
        });
      }
    }
  };

  const scheduleReminderNotifications = async () => {
    const now = Date.now();
    for (const reminder of reminders || []) {
      const reminderDate = buildDateWithTime(
        reminder.date || reminder.dateTime,
        reminder.time,
        DEFAULT_EVENT_TIME.hour,
        DEFAULT_EVENT_TIME.minute
      );

      if (!reminderDate || reminderDate.getTime() <= now) continue;

      await scheduleLocalNotificationAsync({
        title: reminder.title || 'Reminder',
        body: formatFriendlyDateTime(reminderDate),
        data: { type: 'reminder', id: reminder.id },
        trigger: reminderDate,
      });
    }
  };

  const weekdayMap = {
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
    Sat: 7,
  };

  const scheduleHabitNotifications = async () => {
    const habitsToSchedule = habits || [];

    for (const habit of habitsToSchedule) {
      const days =
        Array.isArray(habit.days) && habit.days.length
          ? habit.days
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      const content = {
        title: habit.title ? `Habit: ${habit.title}` : 'Habit reminder',
        body: 'Time to check in on your habit progress for today.',
        data: { type: 'habit', id: habit.id },
      };

      if (habit.repeat === 'Daily' || days.length === 7) {
        await scheduleLocalNotificationAsync({
          ...content,
          trigger: {
            hour: HABIT_REMINDER_TIME.hour,
            minute: HABIT_REMINDER_TIME.minute,
            repeats: true,
          },
        });
        continue;
      }

      for (const day of days) {
        const weekday = weekdayMap[day] || weekdayMap[day?.slice(0, 3)];
        if (!weekday) continue;

        await scheduleLocalNotificationAsync({
          ...content,
          trigger: {
            weekday,
            hour: HABIT_REMINDER_TIME.hour,
            minute: HABIT_REMINDER_TIME.minute,
            repeats: true,
          },
        });
      }
    }
  };

  const scheduleRoutineNotifications = async () => {
    const routineList = routines || [];

    for (const routine of routineList) {
      await scheduleLocalNotificationAsync({
        title: routine.name ? `Routine: ${routine.name}` : 'Routine check-in',
        body: 'Review your routine tasks for today.',
        data: { type: 'routine', id: routine.id },
        trigger: {
          hour: ROUTINE_REMINDER_TIME.hour,
          minute: ROUTINE_REMINDER_TIME.minute,
          repeats: true,
        },
      });
    }
  };

  const rescheduleAllNotifications = useCallback(async () => {
    if (!userSettings.notificationsEnabled || !authUser || !hasNotificationPermission) {
      await cancelAllScheduledNotificationsAsync();
      return;
    }

    await cancelAllScheduledNotificationsAsync();

    if (userSettings.taskRemindersEnabled) {
      await scheduleTaskNotifications();
    }
    if (userSettings.habitRemindersEnabled) {
      await scheduleHabitNotifications();
    }
    await scheduleRoutineNotifications();
    await scheduleReminderNotifications();
  }, [
    authUser,
    hasNotificationPermission,
    reminders,
    routines,
    tasks,
    habits,
    userSettings.notificationsEnabled,
    userSettings.taskRemindersEnabled,
    userSettings.habitRemindersEnabled,
  ]);

  useEffect(() => {
    const syncPermission = async () => {
      if (!authUser || !userSettings.notificationsEnabled) {
        setHasNotificationPermission(false);
        await cancelAllScheduledNotificationsAsync();
        return;
      }
      const granted = await requestNotificationPermissionAsync();
      setHasNotificationPermission(granted);
    };

    syncPermission();
  }, [authUser, userSettings.notificationsEnabled]);

  useEffect(() => {
    if (isLoading || !authUser?.id || !profileLoaded) return;
    applyStreakFreezeIfNeeded();
  }, [isLoading, authUser?.id, profileLoaded, applyStreakFreezeIfNeeded]);

  useEffect(() => {
    if (isLoading) return;
    rescheduleAllNotifications();
  }, [
    isLoading,
    rescheduleAllNotifications,
    tasks,
    habits,
    routines,
    reminders,
    userSettings.notificationsEnabled,
    userSettings.taskRemindersEnabled,
    userSettings.habitRemindersEnabled,
    hasNotificationPermission,
  ]);

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

  const computedProfile = useMemo(() => {
    const bestName =
      profile.name && profile.name !== defaultProfile.name
        ? profile.name
        : authUser?.user_metadata?.full_name ||
          authUser?.user_metadata?.name ||
          authUser?.user_metadata?.username ||
          authUser?.email ||
          profile.name ||
          defaultProfile.name;

    const bestEmail =
      profile.email && profile.email !== defaultProfile.email
        ? profile.email
        : authUser?.email || profile.email || defaultProfile.email;

    const bestUsername =
      profile.username ||
      authUser?.user_metadata?.username ||
      '';

    const plan = profile.plan || defaultProfile.plan;
    const premiumExpiresAt =
      profile.premiumExpiresAt || profile.premium_expires_at || defaultProfile.premiumExpiresAt;
    const isPremium = computeIsPremium(plan, premiumExpiresAt);

    return {
      ...profile,
      name: bestName,
      email: bestEmail,
      username: bestUsername,
      plan,
      premiumExpiresAt,
      premium_expires_at: premiumExpiresAt,
      isPremium,
    };
  }, [profile, authUser]);

  const value = {
    profile: computedProfile,
    isPremium: computedProfile?.isPremium,

    // Loading
    isLoading,
    themeReady,
    hasNotificationPermission,

    // Habits
    habits,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    isHabitCompletedToday,
    getBestStreak,
    getTodayHabitsCount,
    streakFrozen,

    // Tasks
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    getTodayTasks,
    getUpcomingTasks,

    // Task collaboration
    taskInvites,
    sendTaskInvite,
    respondToTaskInvite,
    fetchTaskParticipants,

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
    budgetGroups,
    budgetAssignments,
    addBudgetGroup,
    updateBudgetGroup,
    deleteBudgetGroup,
    addRecurringPaymentToGroup,
    getBudgetSpendForGroup,
    linkTransactionToBudgetGroups,
    addTransaction,
    deleteTransaction,
    getTransactionsForDate,
    getFinanceSummaryForDate,

    // Friends
    friends,
    onlineFriends,
    friendRequests,
    isUserOnline,
    deleteFriend,
    refreshFriendData,
    searchUsersByUsername,
    sendFriendRequest,
    respondToFriendRequest,
    getFriendRelationship,
    groups,
    groupInvites,
    groupHabits,
    groupHabitCompletions,
    groupRoutines,
    fetchGroupMembers,
    refreshGroupData,
    createGroup,
    sendGroupInvites,
    respondToGroupInvite,
    addGroupHabit,
    toggleGroupHabitCompletion,
    addGroupRoutine,
    deleteGroupRoutine,
    addTaskToGroupRoutine,
    removeTaskFromGroupRoutine,
    reorderGroupRoutineTasks,

    // Profile
    updateProfile,
    userSettings,
    updateUserSettings,
    language,
    setLanguage,
    t,

    // Auth
    authUser,
    hasOnboarded,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    persistOnboarding,

    // Theme
    themeName,
    themeColors,
    changeTheme,
    isPremiumUser,
  };

  if (!themeReady) {
    return null;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;
