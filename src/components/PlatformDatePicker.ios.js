import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';

const normalizeDate = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const PlatformDatePicker = ({
  visible,
  value,
  onChange,
  onClose,
  title = 'Select Date',
  minimumDate,
  maximumDate,
  accentColor = colors.primary,
}) => {
  const [current, setCurrent] = useState(normalizeDate(value));

  useEffect(() => {
    if (!visible) return;
    setCurrent(normalizeDate(value));
  }, [value, visible]);

  const handleChange = (_event, selectedDate) => {
    const picked = selectedDate || current;
    setCurrent(picked);
    onChange?.(picked);
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <DateTimePicker
          value={current}
          mode="date"
          display="spinner"
          onChange={handleChange}
          minimumDate={minimumDate ? normalizeDate(minimumDate) : undefined}
          maximumDate={maximumDate ? normalizeDate(maximumDate) : undefined}
          textColor="#FFFFFF"
          style={styles.picker}
        />
        <Pressable style={styles.doneButton} onPress={onClose}>
          <Text style={[styles.doneText, { color: '#FFFFFF' }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 30,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheet: {
    width: '100%',
    backgroundColor: 'rgba(30,30,30,0.9)',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.medium,
  },
  title: {
    ...typography.h3,
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  picker: {
    width: '100%',
  },
  doneButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneText: {
    ...typography.body,
    fontWeight: '700',
  },
});

export default PlatformDatePicker;
