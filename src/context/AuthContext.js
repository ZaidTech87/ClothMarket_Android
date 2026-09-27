import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { saveSession, loadSession, clearSession } from "../utils/secureStorage";
import { setUnauthorizedHandler } from "../services/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Same shape and same four operations as the web AuthContext
// (login/logout/updateUser/loading), just backed by SecureStore instead
// of localStorage and async instead of sync.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { user: savedUser, token: savedToken } = await loadSession();
      if (savedUser && savedToken) {
        setUser(savedUser);
        setToken(savedToken);
      }
      setLoading(false);
    })();
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    await clearSession();
  }, []);

  // The web app's api.js redirects to /login directly on a 401. There's
  // no router-agnostic way to do that from inside the API layer in RN,
  // so we register this context's logout as the handler; the root
  // navigator reacts to `user` becoming null and swaps to AuthStack.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, [logout]);

  const login = async (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    await saveSession(authToken, userData);
  };

  const updateUser = async (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    await saveSession(token, newUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
