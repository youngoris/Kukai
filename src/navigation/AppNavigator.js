import React from "react";
import { Dimensions } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Import screens
import HomeScreen from "../screens/HomeScreen";
import MeditationScreen from "../screens/MeditationScreen";
import TaskScreen from "../screens/TaskScreen";
import FocusScreen from "../screens/FocusScreen";
import SummaryScreen from "../screens/SummaryScreen";
import JournalScreen from "../screens/JournalScreen";
import JournalEditScreen from "../screens/JournalEditScreen";
import SettingsScreen from "../screens/SettingsScreen";

const { width } = Dimensions.get("window");
const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
        contentStyle: { backgroundColor: "#000" },
        animation: "slide_from_right",
        gestureEnabled: route.name !== "Home" && route.name !== "Settings",
        // Native stack uses different animation configuration
        // No need for gestureDirection and gestureResponseDistance in native stack
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
