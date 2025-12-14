import React from 'react';
import { ScrollView } from 'react-native';

const PlatformScrollView = React.forwardRef(
  ({ children, contentContainerStyle, scrollEnabled, ...rest }, ref) => (
    <ScrollView
      ref={ref}
      overScrollMode="always"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled !== false}
      contentContainerStyle={[
        { paddingBottom: 24, paddingTop: 8 },
        contentContainerStyle,
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  )
);

export default PlatformScrollView;
