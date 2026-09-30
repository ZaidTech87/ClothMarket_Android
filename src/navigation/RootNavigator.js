import React from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import { colors } from "../theme/theme";

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isLoggedIn = !!user;

  console.log(
    "🧭 RootNavigator:",
    isLoggedIn ? "AUTHENTICATED" : "LOGGED OUT",
    user?.userId ?? null
  );

  return (
    <NavigationContainer
      key={isLoggedIn ? "authenticated" : "unauthenticated"}
    >
      {isLoggedIn ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});