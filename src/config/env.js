import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};

// Mirrors web's services/api.js: API_BASE_URL is the single source of
// truth, WS_BASE_URL falls back to `${API_BASE_URL}/ws` if not set.
// server.servlet.context-path=/api on the backend, so /ws already lives
// under /api — same note as the web CallContext.jsx.
export const API_BASE_URL = extra.apiBaseUrl;
export const WS_BASE_URL = extra.wsBaseUrl || `${API_BASE_URL}/ws`;

if (!API_BASE_URL) {
  // Fail loudly at startup rather than silently hitting undefined/undefined
  // routes later - this bit us in the web app where the .env.example
  // wasn't actually wired up in api.js.
  throw new Error(
    "API_BASE_URL is not configured. Set it in app.config.js `extra.apiBaseUrl` " +
      "or via the API_BASE_URL environment variable at build time."
  );
}
