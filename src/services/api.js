import axios from "axios";
import { API_BASE_URL, WS_BASE_URL } from "../config/env";
import { loadSession, clearSession } from "../utils/secureStorage";

export { API_BASE_URL, WS_BASE_URL };

// =====================================================
// MEDIA URL
// =====================================================

export const getMediaUrl = (url) => {
  if (!url) return "";

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }

  const base = API_BASE_URL.replace(/\/+$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;

  return `${base}${path}`;
};

// =====================================================
// AXIOS INSTANCE
// =====================================================

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

// =====================================================
// UNAUTHORIZED HANDLER
// =====================================================

let onUnauthorized = null;
let handlingUnauthorized = false;

export function setUnauthorizedHandler(handler) {
  onUnauthorized =
    typeof handler === "function"
      ? handler
      : null;
}

// =====================================================
// REQUEST INTERCEPTOR
// =====================================================

api.interceptors.request.use(
  async (config) => {
    try {
      const { token } = await loadSession();

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn(
        "⚠️ Failed to load authentication session:",
        error?.message || error
      );
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// =====================================================
// RESPONSE INTERCEPTOR
// =====================================================

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const status = error?.response?.status;

    const requestUrl =
      error?.config?.url || "";

    // ---------------------------------------------------
    // AUTH ENDPOINTS
    // ---------------------------------------------------
    // Failed login/signup should NOT trigger logout.
    // ---------------------------------------------------

    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/signup") ||
      requestUrl.includes("/auth/forgot-password") ||
      requestUrl.includes("/auth/reset-password");

    // ---------------------------------------------------
    // 401 / 403 HANDLING
    // ---------------------------------------------------

    if (
      (status === 401 || status === 403) &&
      !isAuthRequest
    ) {
      console.warn(
        `🔐 Authentication failed (${status})`
      );

      // Prevent multiple API requests from
      // triggering logout simultaneously.
      if (!handlingUnauthorized) {
        handlingUnauthorized = true;

        try {
          if (onUnauthorized) {
            // AuthContext.logout() will:
            // 1. set user to null
            // 2. set token to null
            // 3. clear SecureStore
            await onUnauthorized();
          } else {
            // Fallback if AuthProvider is not mounted.
            await clearSession();
          }
        } catch (logoutError) {
          console.warn(
            "⚠️ Error while logging out:",
            logoutError?.message || logoutError
          );

          // Safety fallback.
          try {
            await clearSession();
          } catch (clearError) {
            console.warn(
              "⚠️ Failed to clear session:",
              clearError?.message || clearError
            );
          }
        } finally {
          // Allow future authentication cycles.
          setTimeout(() => {
            handlingUnauthorized = false;
          }, 500);
        }
      }
    }

    return Promise.reject(error);
  }
);

// =====================================================
// AUTH APIs
// =====================================================

export const authAPI = {
  signup: (data) =>
    api.post("/auth/signup", data),

  login: (data) =>
    api.post("/auth/login", data),

  forgotPassword: (mobile) =>
    api.post("/auth/forgot-password", {
      mobile,
    }),

  resetPassword: (data) =>
    api.post("/auth/reset-password", data),
};

// =====================================================
// USER APIs
// =====================================================

export const userAPI = {
  getUser: (userId) =>
    api.get(`/users/${userId}`),

  getUserByMobile: (mobile) =>
    api.get(`/users/mobile/${mobile}`),

  searchUsers: (name) =>
    api.get("/users/search", {
      params: {
        name,
      },
    }),

  updateProfileImage: (
    userId,
    fileAsset
  ) => {
    const formData = new FormData();

    formData.append("file", {
      uri: fileAsset.uri,
      name:
        fileAsset.name ||
        "profile.jpg",
      type:
        fileAsset.type ||
        "image/jpeg",
    });

    return api.post(
      `/users/${userId}/profile-image`,
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      }
    );
  },
};

// =====================================================
// POST APIs
// =====================================================

export const postAPI = {
  createPost: (
    postData,
    fileAsset
  ) => {
    const formData = new FormData();

    formData.append(
      "postData",
      JSON.stringify(postData)
    );

    if (fileAsset) {
      formData.append("file", {
        uri: fileAsset.uri,
        name:
          fileAsset.name ||
          "post-media",
        type:
          fileAsset.type ||
          "application/octet-stream",
      });
    }

    return api.post(
      "/posts/create",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      }
    );
  },

  getFeed: (
    page = 0,
    size = 10
  ) =>
    api.get(
      `/posts/feed?page=${page}&size=${size}`
    ),

  getUserPosts: (userId) =>
    api.get(
      `/posts/user/${userId}`
    ),

  getPost: (postId) =>
    api.get(`/posts/${postId}`),

  deletePost: (postId) =>
    api.delete(`/posts/${postId}`),
};

// =====================================================
// MESSAGE APIs
// =====================================================

export const messageAPI = {
  sendTextMessage: (
    receiverId,
    message
  ) =>
    api.post(
      "/messages/send/text",
      null,
      {
        params: {
          receiverId,
          message,
        },
      }
    ),

  sendVoiceMessage: (
    receiverId,
    voiceAsset
  ) => {
    const formData = new FormData();

    formData.append(
      "receiverId",
      String(receiverId)
    );

    formData.append("file", {
      uri: voiceAsset.uri,
      name:
        voiceAsset.name ||
        "voice-message.webm",
      type:
        voiceAsset.type ||
        "audio/webm",
    });

    return api.post(
      "/messages/send/voice",
      formData,
      {
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
      }
    );
  },

  getChatMessages: (
    otherUserId
  ) =>
    api.get(
      "/messages/chat",
      {
        params: {
          otherUserId,
        },
      }
    ),

  getChatUsers: (userId) =>
    api.get(
      `/messages/chat-users/${userId}`
    ),

  getInbox: (userId) =>
    api.get(
      `/messages/inbox/${userId}`
    ),

  getUnreadCount: (userId) =>
    api.get(
      `/messages/unread-count/${userId}`
    ),

  markAsRead: (fromUserId) =>
    api.post(
      "/messages/mark-read",
      null,
      {
        params: {
          fromUserId,
        },
      }
    ),
};

// =====================================================
// CHATBOT API
// =====================================================

export const chatbotAPI = {
  ask: (
    message,
    history
  ) =>
    api.post(
      "/chatbot/ask",
      {
        message,
        history,
      }
    ),
};

// =====================================================
// DEFAULT EXPORT
// =====================================================

export default api;