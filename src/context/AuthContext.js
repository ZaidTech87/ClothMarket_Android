import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import {
  saveSession,
  loadSession,
  clearSession,
} from "../utils/secureStorage";

import { setUnauthorizedHandler } from "../services/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Keep latest auth state available inside async functions
  // without depending on stale closures.
  const userRef = useRef(null);
  const tokenRef = useRef(null);

  // Changes whenever a new auth session starts/ends.
  // Prevents old async operations from restoring a logged-out session.
  const sessionGenerationRef = useRef(0);

  const setAuthState = useCallback((nextUser, nextToken) => {
    userRef.current = nextUser;
    tokenRef.current = nextToken;

    setUser(nextUser);
    setToken(nextToken);
  }, []);

  // ===================================================
  // RESTORE SAVED SESSION
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const {
          user: savedUser,
          token: savedToken,
        } = await loadSession();

        if (cancelled) return;

        if (savedUser && savedToken) {
          userRef.current = savedUser;
          tokenRef.current = savedToken;

          setUser(savedUser);
          setToken(savedToken);

          console.log("🔐 Saved session restored");
        } else {
          console.log("ℹ️ No saved session found");
        }
      } catch (error) {
        console.error(
          "❌ Failed to restore session:",
          error?.message || error
        );

        if (!cancelled) {
          setAuthState(null, null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [setAuthState]);

  // ===================================================
  // LOGOUT
  // ===================================================

  const logout = useCallback(async () => {
    console.log("🚪 LOGOUT STARTED");

    // Invalidate every async operation belonging
    // to the previous authenticated session.
    sessionGenerationRef.current += 1;

    // Clear memory immediately.
    userRef.current = null;
    tokenRef.current = null;

    setUser(null);
    setToken(null);

    try {
      await clearSession();

      console.log("🗑️ SecureStore session cleared");
      console.log("✅ LOGOUT COMPLETE");
    } catch (error) {
      console.error(
        "❌ Failed to clear SecureStore:",
        error?.message || error
      );
    }
  }, []);

  // ===================================================
  // HANDLE 401 / 403
  // ===================================================

  useEffect(() => {
    const handleUnauthorized = async () => {
      console.warn(
        "🔐 Unauthorized response received. Logging out..."
      );

      await logout();
    };

    setUnauthorizedHandler(handleUnauthorized);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  // ===================================================
  // LOGIN
  // ===================================================

  const login = useCallback(
    async (userData, authToken) => {
      try {
        console.log("🔑 LOGIN STARTED");

        // New authentication generation.
        sessionGenerationRef.current += 1;

        await saveSession(authToken, userData);

        userRef.current = userData;
        tokenRef.current = authToken;

        setUser(userData);
        setToken(authToken);

        console.log("✅ LOGIN COMPLETE");
      } catch (error) {
        console.error(
          "❌ Failed to save login session:",
          error?.message || error
        );

        setAuthState(null, null);

        throw error;
      }
    },
    [setAuthState]
  );

  // ===================================================
  // UPDATE USER
  // ===================================================

  const updateUser = useCallback(async (updatedData) => {
    const generation = sessionGenerationRef.current;

    const currentUser = userRef.current;
    const currentToken = tokenRef.current;

    // Ignore updates after logout.
    if (!currentUser || !currentToken) {
      console.warn(
        "⚠️ updateUser ignored: no authenticated session"
      );
      return;
    }

    const newUser = {
      ...currentUser,
      ...updatedData,
    };

    userRef.current = newUser;
    setUser(newUser);

    try {
      await saveSession(currentToken, newUser);

      // Logout happened while saveSession() was running.
      if (
        generation !== sessionGenerationRef.current ||
        !userRef.current
      ) {
        console.warn(
          "⚠️ Old updateUser operation detected after logout. Clearing stale session."
        );

        await clearSession();
        return;
      }

      console.log("✅ User session updated");
    } catch (error) {
      console.error(
        "❌ Failed to update user session:",
        error?.message || error
      );
    }
  }, []);

  // ===================================================
  // PROVIDER
  // ===================================================

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUser,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};