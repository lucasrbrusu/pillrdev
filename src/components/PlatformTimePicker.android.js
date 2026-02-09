import React, { useEffect, useRef } from 'react';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
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
  const isOpenRef = useRef(false);

  useEffect(() => {
    if (!visible || isOpenRef.current) return;
    isOpenRef.current = true;
    const current = normalizeDate(value);

    DateTimePickerAndroid.open({
      value: current,
      mode: 'time',
      is24Hour: false,
      display: 'default',
      accentColor: colors.primary,
      onChange: (event, selectedDate) => {
        if (event.type === 'dismissed') {
          onClose?.();
          return;
        }
        const picked = selectedDate || current;
        onChange?.(picked);
        onClose?.();
      },
    });
  }, [visible, value, onChange, onClose]);

  useEffect(() => {
    if (!visible) {
      isOpenRef.current = false;
    }
  }, [visible]);

  return null;
};

export default PlatformTimePicker;
