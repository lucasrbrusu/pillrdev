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
      const normalizeUnit = (value) => (value === 'kg' || value === 'lb' ? value : null);
      const normalizeBodyType = (value) =>
        typeof value === 'string' && value.trim().length ? value : null;
      const parseOptionalNumber = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return null;
        return parsed > 0 ? parsed : null;
      };
      const profileFallback = {
        weightUnit: normalizeUnit(profile?.weightManagerUnit) || DEFAULT_WEIGHT_MANAGER_UNIT,
        currentWeight: parseOptionalNumber(profile?.weightManagerCurrentWeight),
        targetWeight: parseOptionalNumber(profile?.weightManagerTargetWeight),
        currentBodyType: normalizeBodyType(profile?.weightManagerCurrentBodyType),
        targetBodyType: normalizeBodyType(profile?.weightManagerTargetBodyType),
      };

      try {
        const stored = await AsyncStorage.getItem(weightManagerStorageKey);
        if (!stored) {
          const hasFallback = Object.values(profileFallback).some(
            (value) => value !== null && value !== undefined && value !== ''
          );
          if (isMounted) setWeightManagerState(hasFallback ? profileFallback : null);
          return;
        }
        const parsed = JSON.parse(stored);
        const merged = {
          weightUnit: normalizeUnit(parsed?.weightUnit) || profileFallback.weightUnit,
          currentWeight: parseOptionalNumber(parsed?.currentWeight) ?? profileFallback.currentWeight,
          targetWeight: parseOptionalNumber(parsed?.targetWeight) ?? profileFallback.targetWeight,
          currentBodyType: normalizeBodyType(parsed?.currentBodyType) || profileFallback.currentBodyType,
          targetBodyType: normalizeBodyType(parsed?.targetBodyType) || profileFallback.targetBodyType,
        };
        const hasMergedData = Object.values(merged).some(
          (value) => value !== null && value !== undefined && value !== ''
        );
        if (isMounted) setWeightManagerState(hasMergedData ? merged : null);
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
