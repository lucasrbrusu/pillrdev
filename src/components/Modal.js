import React from 'react';
import {
  View,
  Modal as RNModal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  Keyboard,
  Platform,
  ScrollView,
  PanResponder,
  Dimensions,
  TextInput,
} from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, borderRadius, spacing, typography } from '../utils/theme';
import { useApp } from '../context/AppContext';

const Modal = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  hideHeader = false,
  fullScreen = false,
  swipeToCloseEnabled = true,
  scrollEnabled = true,
  containerStyle,
  contentStyle,
  contentContainerStyle,
}) => {
  const { themeColors } = useApp();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : spacing.lg;
  const scrollRef = React.useRef(null);
  const scrollYRef = React.useRef(0);
  const keyboardHeightRef = React.useRef(0);
  const focusedInputTimeoutRef = React.useRef(null);
  const viewportHeightRef = React.useRef(0);
  const contentHeightRef = React.useRef(0);
  const contentBottomPadding = bottomInset + spacing.xl;
  const headerTopOffset = fullScreen ? Math.max(insets.top, spacing.lg) : 0;
  const contentTopPadding = 0;

  const clampScrollOffset = React.useCallback((value) => {
    const maxOffset = Math.max(
      0,
      (contentHeightRef.current || 0) - (viewportHeightRef.current || 0)
    );
    if (!Number.isFinite(value)) return 0;
    return Math.min(Math.max(0, value), maxOffset);
  }, []);

  const clearPendingFocusScroll = React.useCallback(() => {
    if (focusedInputTimeoutRef.current) {
      clearTimeout(focusedInputTimeoutRef.current);
      focusedInputTimeoutRef.current = null;
    }
  }, []);

  const scrollFocusedInputIntoView = React.useCallback((nextKeyboardHeight) => {
    const resolvedKeyboardHeight = nextKeyboardHeight || keyboardHeightRef.current;
    if (!resolvedKeyboardHeight || !scrollRef.current) return;
    const focusedInput = TextInput.State?.currentlyFocusedInput?.();
    if (!focusedInput) return;

    requestAnimationFrame(() => {
      try {
        focusedInput.measureInWindow((x, y, width, height) => {
          if (!Number.isFinite(y) || !Number.isFinite(height)) return;
          const inputTop = y;
          const keyboardTop = Dimensions.get('window').height - resolvedKeyboardHeight;
          const inputBottom = y + height;
          const bottomOverlap = inputBottom - keyboardTop + spacing.md;
          const topOverlap = spacing.md - inputTop;
          let nextOffset = scrollYRef.current;

          if (bottomOverlap > 0) {
            nextOffset += bottomOverlap;
          } else if (topOverlap > 0) {
            nextOffset -= topOverlap;
          }

          if (Math.abs(nextOffset - scrollYRef.current) > 1) {
            scrollRef.current?.scrollTo({
              y: clampScrollOffset(nextOffset),
              animated: true,
            });
          }
        });
      } catch (error) {
        // Ignore measure errors from transient/unmounted inputs.
      }
    });
  }, [clampScrollOffset]);

  const scheduleFocusedInputScroll = React.useCallback(() => {
    if (!keyboardHeightRef.current) return;
    clearPendingFocusScroll();
    focusedInputTimeoutRef.current = setTimeout(() => {
      focusedInputTimeoutRef.current = null;
      scrollFocusedInputIntoView(keyboardHeightRef.current);
    }, 60);
  }, [clearPendingFocusScroll, scrollFocusedInputIntoView]);

  const handleScroll = React.useCallback((event) => {
    scrollYRef.current = event?.nativeEvent?.contentOffset?.y || 0;
  }, []);

  const handleLayout = React.useCallback((event) => {
    viewportHeightRef.current = event?.nativeEvent?.layout?.height || 0;
  }, []);

  const handleContentSizeChange = React.useCallback((width, height) => {
    contentHeightRef.current = height || 0;
  }, []);

  const handleTouchEndCapture = React.useCallback(() => {
    scheduleFocusedInputScroll();
  }, [scheduleFocusedInputScroll]);

  React.useEffect(() => {
    if (!visible) return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const handleKeyboardShow = (event) => {
      const nextHeight = event?.endCoordinates?.height || 0;
      keyboardHeightRef.current = nextHeight;
      scrollFocusedInputIntoView(nextHeight);
    };
    const handleKeyboardHide = () => {
      keyboardHeightRef.current = 0;
      clearPendingFocusScroll();
    };

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);
    const frameSub =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', handleKeyboardShow)
        : null;

    return () => {
      clearPendingFocusScroll();
      showSub.remove();
      hideSub.remove();
      frameSub?.remove();
    };
  }, [clearPendingFocusScroll, scrollFocusedInputIntoView, visible]);
  const panResponder = React.useMemo(() => {
    if (!swipeToCloseEnabled || !onClose) return null;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const { dx, dy } = gesture;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        // Only capture when the gesture is primarily horizontal to avoid fighting scroll
        return absDx > 12 && absDx > absDy;
      },
      onPanResponderRelease: (_, gesture) => {
        const { dx, vx, dy } = gesture;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const velocity = Math.abs(vx);
        const dominantHorizontal = absDx > absDy;
        if (dominantHorizontal && absDx > 50 && velocity > 0.1) {
          onClose();
        }
      },
    });
  }, [onClose, swipeToCloseEnabled]);

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, fullScreen && styles.overlayFullScreen]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.modalContainer,
            fullScreen && styles.fullScreen,
            {
              paddingBottom: Platform.OS === 'ios' ? bottomInset : 0,
              backgroundColor: themeColors.background,
            },
            containerStyle,
          ]}
          {...(panResponder ? panResponder.panHandlers : {})}
        >
          {!hideHeader && (
            <View
              style={[
                styles.header,
                fullScreen && { marginTop: headerTopOffset },
              ]}
            >
              <Text style={styles.title}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {fullScreen ? (
            <ScrollView
              ref={scrollRef}
              style={[styles.content, styles.fullScreenContent, contentStyle]}
              contentContainerStyle={[
                styles.fullScreenContentContainer,
                { paddingBottom: contentBottomPadding, paddingTop: contentTopPadding },
                contentContainerStyle,
              ]}
              showsVerticalScrollIndicator
              bounces={false}
              alwaysBounceVertical={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              nestedScrollEnabled
              overScrollMode="never"
              scrollEventThrottle={16}
              onScroll={handleScroll}
              onLayout={handleLayout}
              onContentSizeChange={handleContentSizeChange}
              onTouchEndCapture={handleTouchEndCapture}
              scrollEnabled={scrollEnabled}
            >
              {children}
            </ScrollView>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={[styles.content, contentStyle]}
              contentContainerStyle={[
                {
                  paddingBottom: contentBottomPadding,
                  paddingTop: contentTopPadding,
                },
                contentContainerStyle,
              ]}
              showsVerticalScrollIndicator={false}
              bounces={false}
              alwaysBounceVertical={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              overScrollMode="never"
              scrollEventThrottle={16}
              onScroll={handleScroll}
              onLayout={handleLayout}
              onContentSizeChange={handleContentSizeChange}
              onTouchEndCapture={handleTouchEndCapture}
              scrollEnabled={scrollEnabled}
            >
              {children}
            </ScrollView>
          )}
        </View>
      </View>
    </RNModal>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlayFullScreen: {
      justifyContent: 'flex-start',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalContainer: {
      backgroundColor: themeColors?.background || colors.card,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '90%',
      ...shadows.large,
    },
    fullScreen: {
      flex: 1,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    title: {
      ...typography.h3,
    },
    closeButton: {
      padding: spacing.xs,
    },
    content: {
      paddingHorizontal: spacing.xl,
    },
    fullScreenContent: {
      flex: 1,
    },
    fullScreenContentContainer: {
      flexGrow: 1,
      minHeight: '100%',
    },
  });

export default Modal;
