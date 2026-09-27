// Central Expo config. Values here become available at runtime via
// `Constants.expoConfig.extra` (see src/config/env.js), which is how
// this app reads API_BASE_URL/WS_BASE_URL instead of hardcoding them
// the way the web app's services/api.js currently does.
//
// `require("dotenv").config()` loads a local `.env` file (see
// .env.example) into process.env before we read it below - without
// this line, a `.env` file sitting in the project root would be
// silently ignored and API_BASE_URL would fall back to the hardcoded
// default every time, which is exactly the kind of bug the web app's
// own unwired .env.example already had (see the note in services/api.js).
//
// Override per-build with env vars, e.g.:
//   API_BASE_URL=https://api.clothmarket.com/api eas build --platform android
require("dotenv").config();

module.exports = ({ config }) => ({
  ...config,
  name: "ClothMarket",
  slug: "clothmarket-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/cloth_Market_logo",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  android: {
    package: "com.clothmarket.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/cloth_Market_logo",
      backgroundColor: "#ffffff",
    },
    permissions: [
      "CAMERA",
      "RECORD_AUDIO",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
    ],
  },
 extra: {
   apiBaseUrl:
     process.env.API_BASE_URL ||
     "https://fix-cloth-marketplace-1.onrender.com/api",

   wsBaseUrl: process.env.WS_BASE_URL || null,
 },

  plugins: [
    [
      "expo-image-picker",
      {
        photosPermission: "ClothMarket needs access to your photos to attach them to a listing.",
        cameraPermission: "ClothMarket needs camera access to take a photo for your listing.",
      },
    ],
    // react-native-webrtc ships native Android/iOS code, so it needs its
    // own config plugin to patch the generated native project (Android
    // manifest entries, Podfile hooks) during `expo prebuild` - this is
    // also why Phase 7 can only run in a custom dev client build, never
    // in plain Expo Go, which only bundles Expo's own SDK modules.
    "@config-plugins/react-native-webrtc",
  ],
});
