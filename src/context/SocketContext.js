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
// foreground/background behavior: disconnect when backgrounded,
// reconnect when foregrounded, on top of stompjs's own reconnectDelay
// handling mid-session drops (Wi-Fi/data switches).
//
// This disconnect/reconnect cycle is now safe with respect to
// ChatScreen's and CallContext's subscriptions: services/socket.js
// keeps a registry of every subscribeTopic() destination and
// automatically restores all of them on every successful (re)connect,
// including the reconnect triggered here after backgrounding. Neither
// ChatScreen nor CallContext need to know this provider ever
// disconnected anything.
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
      // Defensive guard: AppState.currentState can be null/undefined on
      // the very first change event on some platforms before the
      // initial state is known - avoid calling .match on that.
      const wasBackground = appState.current
        ? appState.current.match(/inactive|background/)
        : false;
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