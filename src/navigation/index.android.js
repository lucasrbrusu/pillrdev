import React from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { colors, shadows, borderRadius } from '../utils/theme';
import { useApp } from '../context/AppContext';

// Screens
import HomeScreen from '../screens/HomeScreen';
import HabitsScreen from '../screens/HabitsScreen';
import TasksScreen from '../screens/TasksScreen';
import HealthScreen from '../screens/HealthScreen';
import RoutineScreen from '../screens/RoutineScreen';
import FinanceScreen from '../screens/FinanceScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import GeneralSettingsScreen from '../screens/GeneralSettingsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import AppearanceScreen from '../screens/AppearanceScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import ChatScreen from '../screens/ChatScreen';
import FocusModeScreen from '../screens/FocusModeScreen';
import CountdownTimerScreen from '../screens/CountdownTimerScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const useBottomOffset = () => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = React.useMemo(() => Dimensions.get('screen').height, []);

  // When Android gesture/navbar hides, windowHeight grows; keep spacing tight
  // so the tab bar hugs the bottom with a small buffer even with on-screen buttons.
  const softNavHeight = Math.max(screenHeight - windowHeight - insets.top, 0);
  const minGap = 0;
  const baseGap = 0;

  return Math.max(insets.bottom, softNavHeight, minGap) + baseGap;
};

const TabBarIcon = ({ name, type, color, size }) => {
  if (type === 'feather') return <Feather name={name} size={size} color={color} />;
  if (type === 'material') return <MaterialCommunityIcons name={name} size={size} color={color} />;
  return <Ionicons name={name} size={size} color={color} />;
};

const CustomTabBar = ({ state, descriptors, navigation, styles }) => {
  const bottomPadding = useBottomOffset();

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: bottomPadding }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName = 'home-outline';
          let iconType = 'ionicons';
          let iconColor = isFocused ? colors.primary : colors.navInactive;

          switch (route.name) {
            case 'Home':
              iconName = isFocused ? 'home' : 'home-outline';
              break;
            case 'Habits':
              iconName = 'target';
              iconType = 'feather';
              iconColor = isFocused ? colors.habits : colors.navInactive;
              break;
            case 'Tasks':
              iconName = 'edit-3';
              iconType = 'feather';
              iconColor = isFocused ? colors.tasks : colors.navInactive;
              break;
            case 'Health':
              iconName = isFocused ? 'heart' : 'heart-outline';
              iconColor = isFocused ? colors.health : colors.navInactive;
              break;
            case 'Routine':
              iconName = 'history';
              iconType = 'material';
              iconColor = isFocused ? colors.routine : colors.navInactive;
              break;
            case 'Finance':
              iconName = 'trending-up';
              iconType = 'feather';
              iconColor = isFocused ? colors.finance : colors.navInactive;
              break;
            default:
              break;
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              android_ripple={{ color: `${iconColor}33`, borderless: false }}
              style={[styles.tabItem, isFocused && styles.tabItemFocused]}
            >
              <View
                style={[
                  styles.tabIconContainer,
                  isFocused && { backgroundColor: `${iconColor}12` },
                ]}
              >
                <TabBarIcon
                  name={iconName}
                  type={iconType}
                  color={iconColor}
                  size={24}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const TabNavigator = ({ styles }) => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} styles={styles} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        detachInactiveScreens: true,
        lazy: true,
      }}
      backBehavior="history"
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Health" component={HealthScreen} />
      <Tab.Screen name="Routine" component={RoutineScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
    </Tab.Navigator>
  );
};

const MainWithChatButton = ({ styles, isPremium }) => {
  const navigation = useNavigation();
  const bottomPadding = useBottomOffset();

  return (
    <View style={{ flex: 1 }}>
      <TabNavigator styles={styles} />
      {isPremium && (
        <Pressable
          onPress={() => navigation.navigate('Chat')}
          android_ripple={{ color: '#FFFFFF33', borderless: true }}
          style={[styles.chatButton, { bottom: bottomPadding + 72 }]}
        >
          <Ionicons name="chatbubbles-outline" size={24} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
};

const Navigation = () => {
  const { isLoading, authUser, hasOnboarded, themeColors, profile } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);
  const isPremium = !!profile?.isPremium;

  const navTheme = React.useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: themeColors.background,
      },
    }),
    [themeColors]
  );

  if (isLoading) {
    return (
      <NavigationContainer theme={navTheme}>
        <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {authUser ? (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: themeColors.background },
          }}
        >
          <Stack.Screen name="Main">
            {() => <MainWithChatButton styles={styles} isPremium={isPremium} />}
          </Stack.Screen>
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="GeneralSettings" component={GeneralSettingsScreen} />
          <Stack.Screen name="Finance" component={FinanceScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="Appearance" component={AppearanceScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="FocusMode" component={FocusModeScreen} />
          <Stack.Screen name="CountdownTimer" component={CountdownTimerScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: themeColors.background },
          }}
        >
          {!hasOnboarded && (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          )}
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

const createStyles = () =>
  StyleSheet.create({
    tabBarContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: 12,
      backgroundColor: 'transparent',
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      paddingVertical: 6,
      paddingHorizontal: 10,
      ...shadows.small,
      elevation: 12,
      borderTopWidth: 1,
      borderColor: 'rgba(0,0,0,0.06)',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    tabItemFocused: {
      transform: [{ translateY: -2 }],
    },
    tabIconContainer: {
      width: 44,
      height: 38,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    chatButton: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: '#4da6ff',
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.medium,
      elevation: 10,
    },
  });

export default Navigation;
