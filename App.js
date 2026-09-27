import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { SocketProvider } from "./src/context/SocketContext";
import { CallProvider } from "./src/context/CallContext";
import RootNavigator from "./src/navigation/RootNavigator";
import CallOverlay from "./src/components/CallOverlay";
import ChatbotWidget from "./src/components/ChatbotWidget";

// Mirrors web App.jsx's
// <AuthProvider><CallProvider><AppRoutes/><CallModal/><ChatbotWidget/></CallProvider></AuthProvider>
// nesting exactly: CallOverlay and ChatbotWidget sit alongside
// RootNavigator, not inside it, so an incoming call or the assistant
// bubble are reachable from any screen (including the login/signup
// screens, same as web - the chatbot widget there will just get a 401
// on /chatbot/ask if unauthenticated, an existing web quirk, not
// something introduced here).
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <RootNavigator />
            <CallOverlay />
            <ChatbotWidget />
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
