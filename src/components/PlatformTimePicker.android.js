import React from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../utils/theme';

const normalizeDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  if (typeof value === 'string') {
    const date = new Date();
    const [time, suffixRaw] = value.split(' ');
    if (time) {
      const [h, m] = time.split(':');
      let hour = Number(h);
      const minute = Number(m) || 0;
      const suffix = (suffixRaw || '').toUpperCase();
      if (suffix.includes('AM') || suffix.includes('PM')) {
        const isPM = suffix.includes('PM');
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
      }
      if (!Number.isNaN(hour)) {
        date.setHours(hour, minute, 0, 0);
        return date;
      }
    }
  }

  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const PlatformTimePicker = ({
  visible,
  value,
  onChange,
  onClose,
}) => {
  const current = normalizeDate(value);

  if (!visible) return null;

  const handleChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      onClose?.();
      return;
    }
    const picked = selectedDate || current;
    onChange?.(picked);
    // Close after confirming selection on Android
    onClose?.();
  };

  return (
    <DateTimePicker
      value={current}
      mode="time"
      display="default"
      onChange={handleChange}
      accentColor={colors.primary}
      is24Hour={false}
    />
  );
};

export default PlatformTimePicker;
