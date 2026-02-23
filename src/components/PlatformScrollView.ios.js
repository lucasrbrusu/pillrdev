import React from 'react';
import { ScrollView, Keyboard, Dimensions, TextInput } from 'react-native';

const PlatformScrollView = React.forwardRef(
  ({ children, contentContainerStyle, scrollEnabled, onScroll, ...rest }, ref) => {
    const scrollRef = React.useRef(null);
    const scrollYRef = React.useRef(0);

    React.useImperativeHandle(ref, () => scrollRef.current);

    const scrollFocusedInputIntoView = React.useCallback((keyboardHeight) => {
      if (!keyboardHeight || !scrollRef.current) return;
      const focusedInput = TextInput.State?.currentlyFocusedInput?.();
      if (!focusedInput) return;

      requestAnimationFrame(() => {
        try {
          focusedInput.measureInWindow((x, y, width, height) => {
            if (!Number.isFinite(y) || !Number.isFinite(height)) return;
            const keyboardTop = Dimensions.get('window').height - keyboardHeight;
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
      const showSub = Keyboard.addListener('keyboardWillShow', (event) => {
        const height = event?.endCoordinates?.height || 0;
        scrollFocusedInputIntoView(height);
      });
      return () => {
        showSub.remove();
      };
    }, [scrollFocusedInputIntoView]);

    return (
      <ScrollView
        ref={scrollRef}
        bounces
        alwaysBounceVertical
        automaticallyAdjustContentInsets
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
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
        scrollEventThrottle={16}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }
);

export default PlatformScrollView;
