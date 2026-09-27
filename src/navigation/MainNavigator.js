import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import PostDetailsScreen from "../screens/posts/PostDetailsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import ChatScreen from "../screens/chat/ChatScreen";
import { colors } from "../theme/theme";

const Stack = createNativeStackNavigator();

// Tabs are the "home base"; everything reached by tapping into a post,
// a conversation, a call, or the chatbot is pushed on top - equivalent
// to web's /chat/:receiverId and other routes that aren't top-level nav
// items there either. Android back button pops these by default via
// native-stack, satisfying the "handle back button correctly" rule.
//
// Note: there's no "Call" or "Chatbot" route here. Web mounts
// <CallModal/> and <ChatbotWidget/> globally in App.jsx alongside the
// router, not as routed pages - an incoming call or the chat assistant
// bubble need to be reachable from any screen. CallOverlay and
// ChatbotWidget are mounted the same way in this app's App.js.
export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.textPrimary,
        headerStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      {/* "UserProfile" (viewing someone else via a post/search result) is
          kept separate from the "Profile" tab (viewing yourself), even
          though both render ProfileScreen - same distinction the web app
          makes implicitly via /profile/:userId always taking a param. */}
      <Stack.Screen
        name="PostDetails"
        component={PostDetailsScreen}
        options={{ title: "Listing" }}
      />
      <Stack.Screen
        name="UserProfile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }} // ChatScreen renders its own header (back + avatar + name), matching web's custom .chat-header layout
      />
    </Stack.Navigator>
  );
}
