import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, shadows, spacing, typography } from '../utils/theme';

const SHOW_ANIMATION_DURATION_MS = 220;
const HIDE_ANIMATION_DURATION_MS = 180;
const VISIBLE_DURATION_MS = 2200;

const StreakIncreaseToast = ({ notice, onHide }) => {
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(-40)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const timeoutRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!notice?.id) return undefined;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    translateY.setValue(-40);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: SHOW_ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: SHOW_ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();

    const activeNoticeId = notice.id;
    timeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -30,
          duration: HIDE_ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: HIDE_ANIMATION_DURATION_MS,
          useNativeDriver: true,
        }),
      ]).start(() => onHide?.(activeNoticeId));
    }, VISIBLE_DURATION_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [notice?.id, onHide, opacity, translateY]);

  if (!notice?.id) return null;

  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="flame" size={16} color="#FFFFFF" />
        </View>
        <Text numberOfLines={2} style={styles.message}>
          {notice.message || `Your current streak is ${notice.streak || 0}.`}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  toast: {
    minWidth: 240,
    maxWidth: '92%',
    borderRadius: borderRadius.full,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.medium,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  message: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '700',
    flexShrink: 1,
  },
});

export default StreakIncreaseToast;
