import React, { useEffect, useRef } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
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
  const isOpenRef = useRef(false);

  useEffect(() => {
    if (!visible || isOpenRef.current) return;
    isOpenRef.current = true;
    const current = normalizeDate(value);

    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      display: 'default',
      accentColor: colors.primary,
      minimumDate: minimumDate ? normalizeDate(minimumDate) : undefined,
      maximumDate: maximumDate ? normalizeDate(maximumDate) : undefined,
      onChange: (event, selectedDate) => {
        const picked = selectedDate || current;
        if (event.type === 'dismissed') {
          onClose?.();
          return;
        }
        onChange?.(picked);
        onClose?.();
      },
    });
  }, [visible, value, minimumDate, maximumDate, onChange, onClose]);

  useEffect(() => {
    if (!visible) {
      isOpenRef.current = false;
    }
  }, [visible]);

  return null;
};

export default PlatformDatePicker;
