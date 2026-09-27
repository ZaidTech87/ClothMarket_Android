import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};

export const API_BASE_URL =
  extra.apiBaseUrl ||
  "https://fix-cloth-marketplace-1.onrender.com/api";

export const WS_BASE_URL =
  extra.wsBaseUrl ||
  `${API_BASE_URL}/ws`;

console.log("🌐 API_BASE_URL:", API_BASE_URL);
console.log("📡 WS_BASE_URL:", WS_BASE_URL);

if (!API_BASE_URL) {
  throw new Error(
    "API_BASE_URL is not configured. Set it in app.config.js `extra.apiBaseUrl` " +
      "or via the API_BASE_URL environment variable at build time."
  );
}