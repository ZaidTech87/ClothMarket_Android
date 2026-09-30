import React from "react";
import {
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import {
  View,
  Image,
} from "react-native";

import FeedScreen from "../screens/home/FeedScreen";
import CreatePostScreen from "../screens/posts/CreatePostScreen";
import MessagesScreen from "../screens/messages/MessagesScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

import { useAuth } from "../context/AuthContext";
import { getMediaUrl } from "../services/api";

import {
  Home,
  PlusCircle,
  MessageCircle,
  UserCircle,
} from "lucide-react-native";

import { colors } from "../theme/theme";

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { user } = useAuth();

  const profileImage = user?.profileImage
    ? getMediaUrl(user.profileImage)
    : null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,

        tabBarStyle: {
          height: 62,
          paddingBottom: 6,
          paddingTop: 5,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },

        tabBarIcon: ({ color, focused }) => {
          // =========================
          // FEED
          // =========================
          if (route.name === "Feed") {
            return (
              <Home
                size={22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            );
          }

          // =========================
          // SELL
          // =========================
          if (route.name === "CreatePost") {
            return (
              <PlusCircle
                size={22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            );
          }

          // =========================
          // MESSAGES
          // =========================
          if (route.name === "Messages") {
            return (
              <MessageCircle
                size={22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            );
          }

          // =========================
          // PROFILE
          // =========================
          if (route.name === "Profile") {
            if (profileImage) {
              return (
                <View
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: 14,
                    overflow: "hidden",
                    borderWidth: focused ? 2 : 1,
                    borderColor: color,
                  }}
                >
                  <Image
                    source={{
                      uri: profileImage,
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </View>
              );
            }

            return (
              <UserCircle
                size={22}
                color={color}
                strokeWidth={focused ? 2.5 : 2}
              />
            );
          }

          return null;
        },
      })}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: "Feed",
        }}
      />

      <Tab.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{
          title: "Sell",
        }}
      />

      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: "Messages",
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
        }}
      />
    </Tab.Navigator>
  );
}