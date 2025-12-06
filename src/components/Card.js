import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, shadows, borderRadius, spacing } from '../utils/theme';

const Card = ({
  children,
  style,
  onPress,
  disabled = false,
  variant = 'default',
}) => {
  const cardStyle = [
    styles.card,
    variant === 'elevated' && styles.elevated,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  elevated: {
    ...shadows.large,
  },
});

export default Card;
