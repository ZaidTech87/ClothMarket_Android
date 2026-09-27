// Central Expo config. Values here become available at runtime via
// `Constants.expoConfig.extra` (see src/config/env.js).

require("dotenv").config();

module.exports = ({ config }) => ({
  ...config,

  // =========================
  // APP INFORMATION
  // =========================
  name: "ClothMarket",
  slug: "clothmarket-mobile",
  version: "1.0.0",
  orientation: "portrait",

  // =========================
  // APP LOGO
  // =========================
  // Make sure this exact file exists:
  // assets/cloth_Market_logo.png
  icon: "./assets/cloth_Market_logo.png",

  userInterfaceStyle: "light",

  // =========================
  // SPLASH SCREEN
  // =========================
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },

  // =========================
  // ANDROID
  // =========================
  android: {
    package: "com.clothmarket.mobile",

    adaptiveIcon: {
      foregroundImage: "./assets/cloth_Market_logo.png",
      backgroundColor: "#ffffff",
    },

    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
    ],
  },

  // =========================
  // ENVIRONMENT VARIABLES
  // =========================
  extra: {
    apiBaseUrl:
      process.env.API_BASE_URL ||
      "https://fix-cloth-marketplace-1.onrender.com/api",

    wsBaseUrl:
      process.env.WS_BASE_URL ||
      "https://fix-cloth-marketplace-1.onrender.com/api/ws",
  },

  // =========================
  // PLUGINS
  // =========================
  plugins: [
    [
      "expo-image-picker",
      {
        photosPermission:
          "ClothMarket needs access to your photos to attach them to a listing.",

        cameraPermission:
          "ClothMarket needs camera access to take a photo for your listing.",
      },
    ],

    // react-native-webrtc native configuration
    "@config-plugins/react-native-webrtc",
  ],
});