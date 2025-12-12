import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors, borderRadius, spacing } from '../utils/theme';
import { supabase } from '../utils/supabaseClient';
import { useApp } from '../context/AppContext';

const Chip = ({
  label,
  selected = false,
  onPress,
  disabled = false,
  color = colors.primary,
  size = 'medium',
  style,
}) => {
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          text: styles.smallText,
        };
      case 'medium':
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          text: styles.largeText,
        };
      default:
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles.container,
        selected && { backgroundColor: color },
        !selected && styles.unselected,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          sizeStyles.text,
          selected && styles.selectedText,
          !selected && styles.unselectedText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const ChipGroup = ({
  options,
  selectedValue,
  onSelect,
  multiSelect = false,
  selectedValues = [],
  color = colors.primary,
  size = 'medium',
  style,
}) => {
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);
  const handleSelect = (value) => {
    if (multiSelect) {
      const isSelected = selectedValues.includes(value);
      if (isSelected) {
        onSelect(selectedValues.filter((v) => v !== value));
      } else {
        onSelect([...selectedValues, value]);
      }
    } else {
      onSelect(value);
    }
  };

  return (
    <View style={[styles.groupContainer, style]}>
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        const isSelected = multiSelect
          ? selectedValues.includes(value)
          : selectedValue === value;

        return (
          <Chip
            key={value}
            label={label}
            selected={isSelected}
            onPress={() => handleSelect(value)}
            color={color}
            size={size}
            style={styles.chipInGroup}
          />
        );
      })}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unselected: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    disabled: {
      opacity: 0.5,
    },
    text: {
      fontWeight: '500',
    },
    selectedText: {
      color: '#FFFFFF',
    },
    unselectedText: {
      color: colors.text,
    },

    // Sizes
    smallContainer: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    smallText: {
      fontSize: 12,
    },
    mediumContainer: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    mediumText: {
      fontSize: 14,
    },
    largeContainer: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    largeText: {
      fontSize: 16,
    },

    // Group
    groupContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    chipInGroup: {
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
  });

export { Chip, ChipGroup };
export default Chip;
