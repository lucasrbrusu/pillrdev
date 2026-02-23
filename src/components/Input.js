import React, { useMemo, useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../utils/theme';
import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  disableFullscreenUI = true,
  icon,
  rightIcon,
  onRightIconPress,
  error,
  disabled = false,
  style,
  inputStyle,
  containerStyle,
  disableTranslation = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t, themeColors } = useApp();
  const palette = themeColors || colors;
  const styles = useMemo(() => createStyles(palette), [palette]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {typeof label === 'string' && !disableTranslation ? t(label) : label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
          multiline && styles.inputContainerMultiline,
          style,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? palette.primary : palette.textLight}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={
            typeof placeholder === 'string' && !disableTranslation
              ? t(placeholder)
              : placeholder
          }
          placeholderTextColor={palette.placeholder}
          secureTextEntry={secureTextEntry && !showPassword}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          disableFullscreenUI={disableFullscreenUI}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={palette.textLight}
            />
          </TouchableOpacity>
        )}
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={palette.textLight}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
    },
    label: {
      ...typography.label,
      marginBottom: spacing.sm,
      color: palette.text,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.inputBackground,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: spacing.md,
    },
    inputContainerFocused: {
      borderColor: palette.primary,
      backgroundColor: palette.inputBackground,
    },
    inputContainerError: {
      borderColor: palette.danger,
    },
    inputContainerDisabled: {
      backgroundColor: palette.divider,
      opacity: 0.7,
    },
    inputContainerMultiline: {
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: palette.text,
      paddingVertical: spacing.md,
    },
    inputMultiline: {
      minHeight: 100,
      paddingTop: spacing.sm,
    },
    leftIcon: {
      marginRight: spacing.sm,
    },
    rightIcon: {
      marginLeft: spacing.sm,
      padding: spacing.xs,
    },
    errorText: {
      color: palette.danger || colors.danger,
      fontSize: 12,
      marginTop: spacing.xs,
    },
  });

export default Input;
