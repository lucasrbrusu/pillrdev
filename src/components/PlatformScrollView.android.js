import React from 'react';
import { ScrollView, Keyboard, Dimensions, TextInput } from 'react-native';

const PlatformScrollView = React.forwardRef(
  ({ children, contentContainerStyle, scrollEnabled, onScroll, ...rest }, ref) => {
    const scrollRef = React.useRef(null);
    const scrollYRef = React.useRef(0);
    const [keyboardHeight, setKeyboardHeight] = React.useState(0);

    React.useImperativeHandle(ref, () => scrollRef.current);

    const scrollFocusedInputIntoView = React.useCallback((nextKeyboardHeight) => {
      if (!nextKeyboardHeight || !scrollRef.current) return;
      const focusedInput = TextInput.State?.currentlyFocusedInput?.();
      if (!focusedInput) return;

      requestAnimationFrame(() => {
        try {
          focusedInput.measureInWindow((x, y, width, height) => {
            if (!Number.isFinite(y) || !Number.isFinite(height)) return;
            const keyboardTop = Dimensions.get('window').height - nextKeyboardHeight;
            const inputBottom = y + height;
            const overlap = inputBottom - keyboardTop + 16;
            if (overlap > 0) {
              scrollRef.current?.scrollTo({
                y: Math.max(0, scrollYRef.current + overlap),
                animated: true,
              });
            }
          });
        } catch (error) {
          // Ignore transient measurement errors.
        }
      });
    }, []);

    React.useEffect(() => {
      const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
        const nextHeight = event?.endCoordinates?.height || 0;
        setKeyboardHeight(nextHeight);
        scrollFocusedInputIntoView(nextHeight);
      });
      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [scrollFocusedInputIntoView]);

    return (
      <ScrollView
        ref={scrollRef}
        overScrollMode="always"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled !== false}
        contentContainerStyle={[
          { paddingBottom: 24 + keyboardHeight, paddingTop: 8 },
          contentContainerStyle,
        ]}
        onScroll={(event) => {
          scrollYRef.current = event?.nativeEvent?.contentOffset?.y || 0;
          onScroll?.(event);
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
