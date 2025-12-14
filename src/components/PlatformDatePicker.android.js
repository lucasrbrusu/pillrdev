import React from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../utils/theme';

const normalizeDate = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const PlatformDatePicker = ({
  visible,
  value,
  onChange,
  onClose,
  minimumDate,
  maximumDate,
}) => {
  const current = normalizeDate(value);

  if (!visible) return null;

  const handleChange = (event, selectedDate) => {
    const picked = selectedDate || current;
    if (event.type === 'dismissed') {
      onClose?.();
      return;
    }
    onChange?.(picked);
    // Close after confirming selection on Android
    onClose?.();
  };

  return (
    <DateTimePicker
      value={current}
      mode="date"
      display="default"
      onChange={handleChange}
      minimumDate={minimumDate ? normalizeDate(minimumDate) : undefined}
      maximumDate={maximumDate ? normalizeDate(maximumDate) : undefined}
      accentColor={colors.primary}
    />
  );
};

export default PlatformDatePicker;
