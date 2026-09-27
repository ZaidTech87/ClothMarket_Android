import React, { createContext, useContext, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";
import { connectSocket, disconnectSocket, subscribeTopic } from "../services/socket";

const SocketContext = createContext(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};

// Web's Chat.jsx opens/closes its own SockJS connection per-screen (one
// connection per chat visit). Doing that in RN works too, but a single
// app-wide connection tied to auth state is more battery/network
// friendly on mobile, and gives us one place to implement the
// foreground/background behavior the brief explicitly asks for:
// disconnect when backgrounded, reconnect when foregrounded, on top of
// stompjs's own reconnectDelay handling mid-session drops (Wi-Fi/data
// switches).
export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }
    connectSocket();
    return () => disconnectSocket();
  }, [user?.userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = nextState;

      if (!user) return;

      if (wasBackground && nextState === "active") {
        connectSocket();
      } else if (nextState.match(/inactive|background/)) {
        disconnectSocket();
      }
    });
    return () => subscription.remove();
  }, [user?.userId]);

  return <SocketContext.Provider value={{ subscribeTopic }}>{children}</SocketContext.Provider>;
};
