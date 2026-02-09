import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { DEFAULT_WEIGHT_MANAGER_UNIT, getWeightManagerOverview } from '../utils/weightManager';

const useWeightManagerOverview = () => {
  const navigation = useNavigation();
  const {
    authUser,
    profile,
    ensureWeightManagerLogsLoaded,
    weightManagerLogs,
  } = useApp();
  const [weightManagerState, setWeightManagerState] = useState(null);

  const weightManagerStorageKey = useMemo(() => {
    const userId = authUser?.id || profile?.id || profile?.user_id || 'default';
    return `weight_manager_state:${userId}`;
  }, [authUser?.id, profile?.id, profile?.user_id]);

  useEffect(() => {
    ensureWeightManagerLogsLoaded();
  }, [ensureWeightManagerLogsLoaded]);

  useEffect(() => {
    let isMounted = true;
    const loadWeightManagerState = async () => {
      try {
        const stored = await AsyncStorage.getItem(weightManagerStorageKey);
        if (!stored) {
          const fallback = {
            weightUnit: profile?.weightManagerUnit || DEFAULT_WEIGHT_MANAGER_UNIT,
            currentWeight: profile?.weightManagerCurrentWeight,
            targetWeight: profile?.weightManagerTargetWeight,
            currentBodyType: profile?.weightManagerCurrentBodyType,
            targetBodyType: profile?.weightManagerTargetBodyType,
          };
          const hasFallback = Object.values(fallback).some(
            (value) => value !== null && value !== undefined && value !== ''
          );
          if (isMounted) setWeightManagerState(hasFallback ? fallback : null);
          return;
        }
        const parsed = JSON.parse(stored);
        if (isMounted) setWeightManagerState(parsed || null);
      } catch (err) {
        console.log('Error loading weight manager state:', err);
      }
    };

    loadWeightManagerState();
    const unsubscribe = navigation?.addListener?.('focus', loadWeightManagerState);
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [
    navigation,
    profile?.weightManagerCurrentBodyType,
    profile?.weightManagerCurrentWeight,
    profile?.weightManagerTargetBodyType,
    profile?.weightManagerTargetWeight,
    profile?.weightManagerUnit,
    weightManagerStorageKey,
  ]);

  const overview = useMemo(
    () =>
      getWeightManagerOverview({
        state: weightManagerState,
        logs: weightManagerLogs,
        unitFallback: DEFAULT_WEIGHT_MANAGER_UNIT,
      }),
    [weightManagerLogs, weightManagerState]
  );

  return {
    weightManagerState,
    ...overview,
  };
};

export default useWeightManagerOverview;
