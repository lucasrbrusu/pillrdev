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
import RoutineDetailScreen from '../screens/RoutineDetailScreen';
import FinanceScreen from '../screens/FinanceScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import CalendarScreen from '../screens/CalendarScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import SignupFlowScreen from '../screens/SignupFlowScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import AppearanceScreen from '../screens/AppearanceScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import FriendsScreen from '../screens/FriendsScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import ChatScreen from '../screens/ChatScreen';
import FocusModeScreen from '../screens/FocusModeScreen';
import CountdownTimerScreen from '../screens/CountdownTimerScreen';
import InsightsScreen from '../screens/InsightsScreen';
import BudgetGroupInsightScreen from '../screens/BudgetGroupInsightScreen';
import FriendProfileScreen from '../screens/FriendProfileScreen';
import PaywallScreen from '../screens/PaywallScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const FRIENDS_GESTURE_DISTANCE = Math.round(Dimensions.get('window').width);
const CHAT_BUTTON_SIZE = 60;
const CHAT_BUTTON_LIFT = 14;
const CHAT_BUTTON_SPACER = CHAT_BUTTON_SIZE;

const useBottomOffset = () => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = React.useMemo(() => Dimensions.get('screen').height, []);

  // When Android gesture/navbar hides, windowHeight grows; clamp the offset so
  // the tab bar stays near the bottom even when on-screen buttons are present.
  const softNavHeight = Math.max(screenHeight - windowHeight - insets.top, 0);
  const clampedNav = Math.min(softNavHeight, 16); // allow a bit more offset
  const minGap = 2;
  const baseGap = 8;

  return Math.max(insets.bottom, clampedNav, minGap) + baseGap;
};

const TabBarIcon = ({ name, type, color, size }) => {
  if (type === 'feather') return <Feather name={name} size={size} color={color} />;
  if (type === 'material') return <MaterialCommunityIcons name={name} size={size} color={color} />;
  return <Ionicons name={name} size={size} color={color} />;
};

const CustomTabBar = ({ state, descriptors, navigation, styles }) => {
  const bottomPadding = useBottomOffset();
  const gapIndex = Math.floor((state.routes.length - 1) / 2);

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
            <React.Fragment key={route.key}>
              <Pressable
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
              {index === gapIndex && (
                <View style={styles.chatSpacer} pointerEvents="none" />
              )}
            </React.Fragment>
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

  const handleChatPress = () => {
    if (isPremium) {
      navigation.navigate('Chat');
      return;
    }
    navigation.navigate('Paywall', { source: 'chat' });
  };

  return (
    <View style={{ flex: 1 }}>
      <TabNavigator styles={styles} />
      <Pressable
        onPress={handleChatPress}
        android_ripple={{ color: '#FFFFFF33', borderless: true }}
        style={[styles.chatButton, { bottom: bottomPadding + 10 }]}
      >
        <Ionicons name="sparkles" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
};

const Navigation = () => {
  const { isLoading, authUser, hasOnboarded, themeColors, profile, isPremiumUser, isPremium } = useApp();
  const styles = React.useMemo(() => createStyles(), [themeColors]);
  const isPremiumActive = Boolean(
    isPremiumUser ||
      isPremium ||
      profile?.isPremium ||
      profile?.plan === 'premium' ||
      profile?.plan === 'pro' ||
      profile?.plan === 'paid'
  );

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
            {() => <MainWithChatButton styles={styles} isPremium={isPremiumActive} />}
          </Stack.Screen>
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Paywall" component={PaywallScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="Finance" component={FinanceScreen} />
          <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
          <Stack.Screen
            name="BudgetGroupInsight"
            component={BudgetGroupInsightScreen}
          />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="RoutineDetail" component={RoutineDetailScreen} />
          <Stack.Screen name="Appearance" component={AppearanceScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
          <Stack.Screen
            name="Friends"
            component={FriendsScreen}
            options={{
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              gestureResponseDistance: FRIENDS_GESTURE_DISTANCE,
            }}
          />
          <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
          <Stack.Screen name="Groups" component={GroupsScreen} />
          <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
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
          <Stack.Screen
            name="SignupFlow"
            component={SignupFlowScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
      paddingTop: 10,
      backgroundColor: 'transparent',
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      paddingVertical: 8,
      paddingHorizontal: 14,
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
    chatSpacer: {
      width: CHAT_BUTTON_SPACER,
      height: '100%',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    chatButton: {
      position: 'absolute',
      left: '50%',
      width: CHAT_BUTTON_SIZE,
      height: CHAT_BUTTON_SIZE,
      borderRadius: CHAT_BUTTON_SIZE / 2,
      backgroundColor: '#4da6ff',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: colors.card,
      ...shadows.medium,
      elevation: 10,
      zIndex: 2,
      transform: [
        { translateX: -CHAT_BUTTON_SIZE / 2 },
        { translateY: -CHAT_BUTTON_LIFT },
      ],
    },
  });

export default Navigation;
