import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, Modal, Button, Input, PlatformDatePicker, PlatformScrollView } from '../components';
import { borderRadius, spacing, typography, shadows } from '../utils/theme';

const toDateKey = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const fromDateKey = (dateKey = '') => {
  if (!dateKey) return null;
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date, days) => {
  const parsed = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(parsed.getTime())) return new Date();
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + days);
};

const startOfWeekMonday = (date) => {
  const parsed = date instanceof Date ? date : new Date(date || Date.now());
  if (Number.isNaN(parsed.getTime())) return new Date();
  const day = parsed.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()), offset);
};

const formatStepsNumber = (value) => Number(value || 0).toLocaleString('en-US');

const formatDateLabel = (value) => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return 'Updated recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Updated recently';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const StepsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    themeColors,
    healthConnection,
    healthDailyMetrics,
    ensureHealthLoaded,
    syncHealthMetricsFromPlatform,
    upsertHealthDailyMetricForDate,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const initialDate = useMemo(() => {
    const paramDate = route?.params?.dateISO;
    if (!paramDate) return new Date();
    const parsed = new Date(`${String(paramDate).slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [route?.params?.dateISO]);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [stepsInput, setStepsInput] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setSelectedDate(initialDate);
    setWeekOffset(0);
  }, [initialDate]);

  useFocusEffect(
    useCallback(() => {
      ensureHealthLoaded();
      return undefined;
    }, [ensureHealthLoaded])
  );

  const selectedDateKey = toDateKey(selectedDate);
  const selectedMetric = healthDailyMetrics?.[selectedDateKey] || null;
  const selectedTotal = Math.max(0, Math.round(Number(selectedMetric?.steps) || 0));

  const weekStart = useMemo(() => {
    const anchorDate = addDays(selectedDate, -weekOffset * 7);
    return startOfWeekMonday(anchorDate);
  }, [selectedDate, weekOffset]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const date = addDays(weekStart, index);
        const dateKey = toDateKey(date);
        const metric = healthDailyMetrics?.[dateKey] || null;
        const total = Math.max(0, Math.round(Number(metric?.steps) || 0));
        return {
          key: dateKey,
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          shortLabel: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
          total,
          isSelected: dateKey === selectedDateKey,
        };
      }),
    [healthDailyMetrics, selectedDateKey, weekStart]
  );

  const weekMax = useMemo(
    () => Math.max(1000, ...weekDays.map((day) => day.total || 0)),
    [weekDays]
  );

  const weekRangeLabel = useMemo(() => {
    const endDate = addDays(weekStart, 6);
    const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }, [weekStart]);

  const weekTotal = useMemo(
    () => weekDays.reduce((sum, day) => sum + day.total, 0),
    [weekDays]
  );

  const handleSaveEntry = async () => {
    const parsedSteps = Math.round(Number(stepsInput));
    if (!Number.isFinite(parsedSteps) || parsedSteps < 0) {
      Alert.alert('Enter steps', 'Please enter a valid step count.');
      return;
    }

    try {
      await upsertHealthDailyMetricForDate(selectedDateKey, {
        steps: parsedSteps,
        source: 'manual',
      });
      setStepsInput('');
      setShowEntryModal(false);
    } catch (err) {
      console.log('Error saving manual steps:', err);
      Alert.alert('Unable to save', 'Please try again.');
    }
  };

  const handleSyncFromHealth = async () => {
    if (!healthConnection?.isConnected) {
      Alert.alert('Health not connected', 'Connect your health permissions in Profile -> Permissions.');
      return;
    }
    try {
      setIsSyncing(true);
      const result = await syncHealthMetricsFromPlatform({ force: true });
      if (!result?.synced && result?.reason) {
        Alert.alert('Sync skipped', String(result.reason));
      }
    } catch (err) {
      console.log('Error syncing health metrics:', err);
      Alert.alert('Unable to sync', 'Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedEntries = selectedMetric
    ? [
        {
          id: `${selectedDateKey}-snapshot`,
          steps: selectedTotal,
          source: selectedMetric.source || 'platform_health',
          updatedAt: selectedMetric.updatedAt,
        },
      ]
    : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Steps</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setStepsInput(String(selectedTotal || ''));
              setShowEntryModal(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={18} color={themeColors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateArrow} onPress={() => setSelectedDate((prev) => addDays(prev, -1))}>
            <Ionicons name="chevron-back" size={20} color={themeColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={18} color={themeColors.textSecondary} />
            <Text style={styles.dateText}>{formatDateLabel(selectedDate)}</Text>
            <Ionicons name="chevron-down" size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateArrow} onPress={() => setSelectedDate((prev) => addDays(prev, 1))}>
            <Ionicons name="chevron-forward" size={20} color={themeColors.text} />
          </TouchableOpacity>
        </View>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total steps for this day</Text>
          <Text style={styles.totalValue}>{formatStepsNumber(selectedTotal)}</Text>
          <Text style={styles.totalMeta}>
            Source: {selectedMetric?.source || (healthConnection?.isConnected ? 'health snapshot pending' : 'manual')}
          </Text>
          <View style={styles.syncActionRow}>
            <Button
              title={isSyncing ? 'Syncing...' : `Sync from ${healthConnection?.providerLabel || 'Health app'}`}
              variant="secondary"
              onPress={handleSyncFromHealth}
              disabled={isSyncing}
              style={styles.syncButton}
            />
          </View>
        </Card>

        <Card style={styles.chartCard}>
          <View style={styles.weekHeader}>
            <TouchableOpacity style={styles.weekButton} onPress={() => setWeekOffset((prev) => prev + 1)}>
              <Ionicons name="chevron-back" size={16} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={styles.weekLabel}>{weekRangeLabel}</Text>
            <TouchableOpacity
              style={[styles.weekButton, weekOffset === 0 && styles.weekButtonDisabled]}
              disabled={weekOffset === 0}
              onPress={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color={weekOffset === 0 ? themeColors.textLight : themeColors.text}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.chartRow}>
            {weekDays.map((day) => {
              const ratio = weekMax > 0 ? day.total / weekMax : 0;
              return (
                <TouchableOpacity
                  key={day.key}
                  style={styles.chartDay}
                  activeOpacity={0.9}
                  onPress={() => {
                    const date = fromDateKey(day.key);
                    if (date) setSelectedDate(date);
                  }}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(6, Math.round(ratio * 100))}%`,
                          backgroundColor: day.isSelected ? themeColors.primary : themeColors.primaryLight,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartDayLabel, day.isSelected && styles.chartDayLabelActive]}>
                    {day.shortLabel}
                  </Text>
                  <Text style={styles.chartDayMeta}>{day.total ? `${Math.round(day.total / 1000)}k` : '0'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.weekTotalText}>Weekly total {formatStepsNumber(weekTotal)} steps</Text>
        </Card>

        <Card style={styles.entriesCard}>
          <View style={styles.entriesHeader}>
            <Text style={styles.entriesTitle}>Daily Snapshot</Text>
            <Text style={styles.entriesCount}>{selectedEntries.length} entries</Text>
          </View>
          {selectedEntries.length ? (
            selectedEntries.map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <View>
                  <Text style={styles.entryValue}>{formatStepsNumber(entry.steps)} steps</Text>
                  <Text style={styles.entryMeta}>
                    {entry.source || 'unknown'} • {formatDateTime(entry.updatedAt)}
                  </Text>
                </View>
                <Ionicons name="walk-outline" size={16} color={themeColors.primary} />
              </View>
            ))
          ) : (
            <Text style={styles.entriesEmpty}>No snapshot for this day yet. Tap sync to import steps.</Text>
          )}
        </Card>
      </PlatformScrollView>

      <PlatformDatePicker
        visible={showDatePicker}
        value={selectedDate}
        onChange={(next) => setSelectedDate(next)}
        onClose={() => setShowDatePicker(false)}
        title="Select Date"
      />

      <Modal
        visible={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        title="Set Daily Steps"
      >
        <Input
          label={`Steps for ${formatDateLabel(selectedDate)}`}
          placeholder="e.g. 7421"
          value={stepsInput}
          onChangeText={setStepsInput}
          keyboardType="numeric"
        />
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setShowEntryModal(false)}
            style={styles.modalButton}
          />
          <Button title="Save Snapshot" onPress={handleSaveEntry} style={styles.modalButton} />
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
    },
    title: {
      ...typography.h2,
      color: themeColors.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.sm,
    },
    addButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
      justifyContent: 'space-between',
    },
    dateArrow: {
      padding: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: themeColors.card,
      borderWidth: 1,
      borderColor: themeColors.border,
      ...shadows.small,
    },
    datePicker: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.full,
      backgroundColor: themeColors.card,
      marginHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors.border,
      justifyContent: 'center',
    },
    dateText: {
      ...typography.body,
      marginHorizontal: spacing.sm,
      color: themeColors.text,
      fontWeight: '600',
    },
    totalCard: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
    },
    totalLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalValue: {
      ...typography.h1,
      color: themeColors.text,
      fontSize: 40,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    totalMeta: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    syncActionRow: {
      marginTop: spacing.md,
    },
    syncButton: {
      marginTop: 0,
    },
    chartCard: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
    },
    weekHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    weekButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.inputBackground,
    },
    weekButtonDisabled: {
      opacity: 0.5,
    },
    weekLabel: {
      ...typography.bodySmall,
      color: themeColors.text,
      fontWeight: '600',
    },
    chartRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    chartDay: {
      flex: 1,
      alignItems: 'center',
    },
    barTrack: {
      width: 20,
      height: 110,
      borderRadius: 10,
      justifyContent: 'flex-end',
      overflow: 'hidden',
      marginBottom: spacing.xs,
      backgroundColor: themeColors.inputBackground,
    },
    barFill: {
      width: '100%',
      borderRadius: 10,
      backgroundColor: themeColors.primary,
    },
    chartDayLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      fontWeight: '600',
      marginTop: 2,
    },
    chartDayLabelActive: {
      color: themeColors.primary,
    },
    chartDayMeta: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    weekTotalText: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    entriesCard: {
      marginBottom: spacing.xl,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
    },
    entriesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    entriesTitle: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '700',
    },
    entriesCount: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    entryValue: {
      ...typography.bodySmall,
      color: themeColors.text,
      fontWeight: '600',
    },
    entryMeta: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    entriesEmpty: {
      ...typography.caption,
      color: themeColors.textSecondary,
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
  });

export default StepsScreen;
