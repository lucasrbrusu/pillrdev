import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
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
            mode="date"
            display="spinner"
            onChange={handleChange}
            minimumDate={minimumDate ? normalizeDate(minimumDate) : undefined}
            maximumDate={maximumDate ? normalizeDate(maximumDate) : undefined}
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
