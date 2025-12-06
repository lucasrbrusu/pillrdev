import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { colors, shadows, borderRadius } from '../utils/theme';

// Screens
import HomeScreen from '../screens/HomeScreen';
import HabitsScreen from '../screens/HabitsScreen';
import TasksScreen from '../screens/TasksScreen';
import HealthScreen from '../screens/HealthScreen';
import RoutineScreen from '../screens/RoutineScreen';
import FinanceScreen from '../screens/FinanceScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import CalendarScreen from '../screens/CalendarScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabBarIcon = ({ name, type, focused, color, size }) => {
  if (type === 'ionicons') {
    return <Ionicons name={name} size={size} color={color} />;
  } else if (type === 'feather') {
    return <Feather name={name} size={size} color={color} />;
  } else if (type === 'material') {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  }
  return <Ionicons name={name} size={size} color={color} />;
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

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

          let iconName;
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
            default:
              iconName = 'circle';
          }

          return (
            <View
              key={route.key}
              style={[
                styles.tabItem,
                isFocused && styles.tabItemFocused,
              ]}
            >
              <View
                style={[
                  styles.tabIconContainer,
                  isFocused && { backgroundColor: `${iconColor}15` },
                ]}
              >
                <TabBarIcon
                  name={iconName}
                  type={iconType}
                  focused={isFocused}
                  color={iconColor}
                  size={24}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Health" component={HealthScreen} />
      <Tab.Screen name="Routine" component={RoutineScreen} />
    </Tab.Navigator>
  );
};

const Navigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Finance" component={FinanceScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.navBackground,
    borderRadius: borderRadius.xxl,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemFocused: {},
  tabIconContainer: {
    width: 48,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Navigation;
