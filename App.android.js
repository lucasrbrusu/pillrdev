import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from './src/context/AppContext';
import Navigation from './src/navigation';

const AppContent = () => {
  const { themeColors, themeName } = useApp();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <StatusBar
        backgroundColor={themeColors.background}
        barStyle={themeName === 'dark' ? 'light-content' : 'dark-content'}
        translucent={false}
      />
      <View style={{ flex: 1, backgroundColor: themeColors.background }}>
        <Navigation />
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
