import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './src/context/AppContext';
import Navigation from './src/navigation';
import { useApp } from './src/context/AppContext';
import { View, Keyboard, TouchableWithoutFeedback } from 'react-native';

const AppContent = () => {
  const { themeColors, themeName } = useApp();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, backgroundColor: themeColors.background }}>
        <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
        <Navigation />
      </View>
    </TouchableWithoutFeedback>
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
