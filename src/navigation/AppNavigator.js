import React from 'react';
import { Dimensions } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import MeditationScreen from '../screens/MeditationScreen';
import TaskScreen from '../screens/TaskScreen';
import FocusScreen from '../screens/FocusScreen';
import SummaryScreen from '../screens/SummaryScreen';
import JournalScreen from '../screens/JournalScreen';
import JournalEditScreen from '../screens/JournalEditScreen';
import SettingsScreen from '../screens/SettingsScreen';

const { width } = Dimensions.get('window');
const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        cardStyle: { backgroundColor: '#000' },
        animationEnabled: true,
        gestureEnabled: route.name !== 'Home' && route.name !== 'Settings',
        gestureDirection: route.name === 'Home' ? 'horizontal-inverted' : 'horizontal',
        gestureResponseDistance: {
          horizontal: width * 0.5,
        },
        cardStyleInterpolator: ({ current, layouts, next }) => {
          // Check if navigating back to Home screen
          const isGoingHome = next?.route?.name === 'Home' || route.name === 'Home';
          
          // If going back to Home, use opposite animation direction
          if (isGoingHome) {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          }
          
          // Default right to left animation
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      })}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Meditation" component={MeditationScreen} />
      <Stack.Screen name="Task" component={TaskScreen} />
      <Stack.Screen name="Focus" component={FocusScreen} />
      <Stack.Screen name="Summary" component={SummaryScreen} />
      <Stack.Screen name="Journal" component={JournalScreen} />
      <Stack.Screen name="JournalEdit" component={JournalEditScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator; 