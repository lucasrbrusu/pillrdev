import React from 'react';
import { ScrollView, Keyboard, Dimensions, TextInput } from 'react-native';

const PlatformScrollView = React.forwardRef(
  (
    {
      children,
      contentContainerStyle,
      scrollEnabled,
      keyboardAutoScrollEnabled = true,
      onScroll,
      onLayout,
      onContentSizeChange,
      onTouchEndCapture,
      ...rest
    },
    ref
  ) => {
    const scrollRef = React.useRef(null);
    const scrollYRef = React.useRef(0);
    const keyboardHeightRef = React.useRef(0);
    const focusedInputTimeoutRef = React.useRef(null);
    const viewportHeightRef = React.useRef(0);
    const contentHeightRef = React.useRef(0);

    React.useImperativeHandle(ref, () => scrollRef.current);

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
            const bottomOverlap = inputBottom - keyboardTop + 16;
            const topOverlap = 16 - inputTop;
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
          // Ignore transient measurement errors.
        }
      });
    }, [clampScrollOffset]);

    const scheduleFocusedInputScroll = React.useCallback(() => {
      if (!keyboardAutoScrollEnabled) return;
      if (!keyboardHeightRef.current) return;
      clearPendingFocusScroll();
      focusedInputTimeoutRef.current = setTimeout(() => {
        focusedInputTimeoutRef.current = null;
        scrollFocusedInputIntoView(keyboardHeightRef.current);
      }, 60);
    }, [clearPendingFocusScroll, keyboardAutoScrollEnabled, scrollFocusedInputIntoView]);

    React.useEffect(() => {
      if (!keyboardAutoScrollEnabled) {
        clearPendingFocusScroll();
        keyboardHeightRef.current = 0;
        return undefined;
      }
      const handleKeyboardShow = (event) => {
        const nextHeight = event?.endCoordinates?.height || 0;
        keyboardHeightRef.current = nextHeight;
        scrollFocusedInputIntoView(nextHeight);
      };
      const handleKeyboardHide = () => {
        keyboardHeightRef.current = 0;
        clearPendingFocusScroll();
      };

      const showSub = Keyboard.addListener('keyboardDidShow', handleKeyboardShow);
      const hideSub = Keyboard.addListener('keyboardDidHide', handleKeyboardHide);
      return () => {
        clearPendingFocusScroll();
        showSub.remove();
        hideSub.remove();
      };
    }, [clearPendingFocusScroll, keyboardAutoScrollEnabled, scrollFocusedInputIntoView]);

    return (
      <ScrollView
        ref={scrollRef}
        overScrollMode="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled !== false}
        contentContainerStyle={[
          { paddingBottom: 24, paddingTop: 8 },
          contentContainerStyle,
        ]}
        onScroll={(event) => {
          scrollYRef.current = event?.nativeEvent?.contentOffset?.y || 0;
          onScroll?.(event);
        }}
        onLayout={(event) => {
          viewportHeightRef.current = event?.nativeEvent?.layout?.height || 0;
          onLayout?.(event);
        }}
        onContentSizeChange={(width, height) => {
          contentHeightRef.current = height || 0;
          onContentSizeChange?.(width, height);
        }}
        onTouchEndCapture={(event) => {
          onTouchEndCapture?.(event);
          if (keyboardAutoScrollEnabled) {
            scheduleFocusedInputScroll();
          }
        }}
        scrollEventThrottle={16}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
);

export default PlatformScrollView;
