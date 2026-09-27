import axios from "axios";
import { API_BASE_URL, WS_BASE_URL } from "../config/env";
import { loadSession, clearSession } from "../utils/secureStorage";

export { API_BASE_URL, WS_BASE_URL };

// Same helper as web's getMediaUrl(): Cloudinary URLs are already
// absolute, local-disk fallback URLs are relative ("/uploads/...") and
// need the API base prepended.
export const getMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// There's no `window` in React Native, so unlike the web app's
// interceptor (which does `window.location.href = '/login'` directly),
// this fires a callback that AuthContext registers. AuthContext owns
// navigation-on-logout instead of the API layer reaching into the UI.
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Request interceptor: same intent as web - attach the bearer token to
// every outgoing request. Reading from SecureStore is async, which axios
// interceptors support natively by returning a promise.
api.interceptors.request.use(async (config) => {
  const { token } = await loadSession();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: same 401 handling as web (clear session), but
// delegates the "go to login" navigation to whoever registered a handler
// instead of assuming a browser location object exists.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await clearSession();
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// ================= AUTH APIs =================
// Identical endpoints/contracts to web's authAPI - no backend changes.
export const authAPI = {
  signup: (data) => api.post("/auth/signup", data),
  login: (data) => api.post("/auth/login", data),
  forgotPassword: (mobile) => api.post("/auth/forgot-password", { mobile }),
  resetPassword: (data) => api.post("/auth/reset-password", data),
};

// ================= USER APIs =================
export const userAPI = {
  getUser: (userId) => api.get(`/users/${userId}`),
  getUserByMobile: (mobile) => api.get(`/users/mobile/${mobile}`),
  searchUsers: (name) => api.get("/users/search", { params: { name } }),

  // RN file shape differs from web's browser File object - callers pass
  // { uri, name, type } from expo-image-picker, not a raw File.
  updateProfileImage: (userId, fileAsset) => {
    const formData = new FormData();
    formData.append("file", fileAsset);
    return api.post(`/users/${userId}/profile-image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ================= POST APIs =================
export const postAPI = {
  createPost: (postData, fileAsset) => {
    const formData = new FormData();
    formData.append("postData", JSON.stringify(postData));
    if (fileAsset) {
      formData.append("file", fileAsset);
    }
    return api.post("/posts/create", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getFeed: (page = 0, size = 10) =>
    api.get(`/posts/feed?page=${page}&size=${size}`),

  getUserPosts: (userId) => api.get(`/posts/user/${userId}`),
  getPost: (postId) => api.get(`/posts/${postId}`),
  deletePost: (postId) => api.delete(`/posts/${postId}`),
};

// ================= MESSAGE APIs =================
export const messageAPI = {
  sendTextMessage: (receiverId, message) =>
    api.post("/messages/send/text", null, { params: { receiverId, message } }),

  sendVoiceMessage: (receiverId, voiceAsset) => {
    const formData = new FormData();
    formData.append("receiverId", receiverId);
    formData.append("file", voiceAsset);
    return api.post("/messages/send/voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getChatMessages: (otherUserId) =>
    api.get("/messages/chat", { params: { otherUserId } }),

  getChatUsers: (userId) => api.get(`/messages/chat-users/${userId}`),
  getInbox: (userId) => api.get(`/messages/inbox/${userId}`),
  getUnreadCount: (userId) => api.get(`/messages/unread-count/${userId}`),

  markAsRead: (fromUserId) =>
    api.post("/messages/mark-read", null, { params: { fromUserId } }),
};

// ================= CHATBOT API =================
export const chatbotAPI = {
  ask: (message, history) => api.post("/chatbot/ask", { message, history }),
};

export default api;
