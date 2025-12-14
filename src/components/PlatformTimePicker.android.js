import React from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../utils/theme';

const normalizeDate = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
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
