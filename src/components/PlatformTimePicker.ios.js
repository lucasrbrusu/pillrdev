import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';

const normalizeDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date();
    const [time, suffix] = value.split(' ');
    if (time) {
      const [h, m] = time.split(':');
      let hour = Number(h) || 0;
      const minute = Number(m) || 0;
      const isPM = (suffix || '').toUpperCase().includes('PM');
      if (isPM && hour < 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
      parsed.setHours(hour, minute, 0, 0);
    }
    return parsed;
  }
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const PlatformTimePicker = ({
  visible,
  value,
  onChange,
  onClose,
  title = 'Select Time',
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
          mode="time"
          display="spinner"
          onChange={handleChange}
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    zIndex: 30,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
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

export default PlatformTimePicker;
