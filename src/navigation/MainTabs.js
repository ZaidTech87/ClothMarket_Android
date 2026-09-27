import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import FeedScreen from "../screens/home/FeedScreen";
import CreatePostScreen from "../screens/posts/CreatePostScreen";
import MessagesScreen from "../screens/messages/MessagesScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import { colors } from "../theme/theme";

const Tab = createBottomTabNavigator();

// Mirrors web's four always-reachable protected routes (/, /create-post,
// /messages, /profile/:userId) as an Android bottom nav instead of a
// header-based layout - the "don't just copy the desktop layout"
// requirement from the brief.
export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="CreatePost" component={CreatePostScreen} options={{ title: "Sell" }} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
