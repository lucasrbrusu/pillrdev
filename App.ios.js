import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, TextInput } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import Navigation from './src/navigation';

if (!TextInput.defaultProps) {
  TextInput.defaultProps = {};
}
TextInput.defaultProps.disableFullscreenUI = true;

const AppContent = () => {
  const { themeColors, themeName } = useApp();

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <Navigation />
    </View>
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
