import * as SecureStore from "expo-secure-store";

// Direct replacement for the two localStorage keys the web app used
// (AuthContext.jsx: localStorage.getItem('token' | 'user')). SecureStore
// persists to the Android Keystore-backed storage instead of plain
// on-disk storage, since a JWT is more sensitive on a device that could
// be rooted than in a desktop browser's localStorage.
const TOKEN_KEY = "clothmarket_token";
const USER_KEY = "clothmarket_user";

export async function saveSession(token, user) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadSession() {
  const [token, userRaw] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  return {
    token: token || null,
    user: userRaw ? JSON.parse(userRaw) : null,
  };
}

export async function updateStoredUser(user) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}
