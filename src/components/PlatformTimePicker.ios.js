import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';

const normalizeDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;

  if (typeof value === 'string') {
    const parsed = new Date();
    const [time, suffixRaw] = value.split(' ');
    if (time) {
      const [h, m] = time.split(':');
      let hour = Number(h);
      const minute = Number(m) || 0;
      const suffixClean = (suffixRaw || '')
        .replace(/[^a-zA-Z]/g, '')
        .toUpperCase();
      const isPM = suffixClean === 'PM';
      const isAM = suffixClean === 'AM';

      if (isPM && hour < 12) hour += 12;
      if (isAM && hour === 12) hour = 0;
      if (!isPM && !isAM) {
        hour = Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 23) : 0;
      }

      parsed.setHours(hour || 0, minute, 0, 0);
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
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) return;
    wasVisibleRef.current = true;
    const next = normalizeDate(value);
    setCurrent((prev) => (prev?.getTime?.() === next.getTime() ? prev : next));
  }, [value, visible]);

  const handleChange = (_event, selectedDate) => {
    const picked = selectedDate || current;
    setCurrent((prev) => (prev?.getTime?.() === picked.getTime() ? prev : picked));
  };

  const handleDone = () => {
    onChange?.(current);
    onClose?.();
  };

  const handleCancel = () => {
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleCancel} />
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
          <Pressable style={styles.doneButton} onPress={handleDone}>
            <Text style={[styles.doneText, { color: '#FFFFFF' }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
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
