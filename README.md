# ClothMarket — Android App

A native Android app (React Native + Expo) for the existing ClothMarket marketplace, built against the **same Spring Boot backend** as the web app with **zero backend changes required**. This is not a WebView wrapper — every screen is native UI.

## 1. Requirements

- **Node.js 18.x or 20.x** (Expo SDK 51 requires Node ≥18; this project was built/tested against Node 22, which also works)
- **npm** (comes with Node) — this project uses `package-lock.json`
- **Java 17** (required by Android Gradle builds)
- **Android Studio**, with:
  - Android SDK (API 34 recommended)
  - An emulator, or a physical device with USB debugging enabled
- **Expo CLI** — no global install needed, this project calls it via `npx expo`
- A running instance of the existing ClothMarket Spring Boot backend (local or deployed)

`react-native-webrtc` (used for calling) requires a **custom dev client build**. This app **cannot run in the plain Expo Go app** — see §6.

## 2. Install dependencies

```bash
cd mobile
npm install
```

## 3. Configure environment variables

Copy the template and fill in your backend's URL:

```bash
cp .env.example .env
```

Edit `.env`:

```env
API_BASE_URL=https://your-backend-host/api
```

- If you're running the backend locally and testing on the **Android emulator**, use `http://10.0.2.2:8080/api` (10.0.2.2 is the emulator's alias for your host machine's localhost).
- If you're testing on a **physical device** on the same Wi-Fi network as your backend, use your machine's LAN IP, e.g. `http://192.168.1.50:8080/api`.
- `WS_BASE_URL` is optional — it defaults to `${API_BASE_URL}/ws`, which is correct for the existing backend's `WebSocketConfig`. Only set it explicitly if your WebSocket endpoint lives somewhere different.
- **Never put backend secrets here** — no DB password, JWT signing secret, Groq/Cloudinary/Sightengine keys. This app only ever needs your API's base URL. See §11.

## 4. Start development

For screens that don't need calling (everything except the in-call UI itself), you can iterate quickly with Expo's dev server:

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app for fast iteration — but see §6 for why calling won't work there.

## 5. Run on Android (full native build, all features including calling)

This project already includes a generated `android/` directory. If you change `app.config.js` (permissions, plugins, app id, icons), regenerate it:

```bash
npx expo prebuild --platform android --clean
```

Then build and run on a connected device or emulator:

```bash
npx expo run:android
```

This compiles a full native build via Gradle and installs it — this is the build that includes `react-native-webrtc` and everything else.

## 6. Why plain Expo Go won't work here

Expo Go only bundles Expo's own SDK modules. `react-native-webrtc` ships real native Android code and isn't part of that bundle, so any screen touching calling will error out in Expo Go specifically. Everything else (auth, feed, posts, messaging, chat) works fine in Expo Go for quick iteration — just know that calling needs the full `expo run:android` path, or a custom dev client build via EAS (§7).

## 7. Development build via EAS (optional, for testing on a device without a USB cable)

```bash
npm install -g eas-cli   # or use npx eas-cli
eas build --profile development --platform android
```

This produces an installable `.apk` with the dev client baked in, so you can scan/install it on a physical device and connect to your local Metro bundler over the network.

## 8. Release build (signed AAB, for Play Store submission)

```bash
eas build --profile production --platform android
```

This produces an Android App Bundle (`.aab`). You'll need to:
1. Configure a Play Store signing keystore with EAS (`eas credentials`) — **do not reuse the debug keystore in `android/app/debug.keystore` for a release build**.
2. Set `API_BASE_URL` to your production backend URL, either in `.env` or as a build-time env var:
   ```bash
   API_BASE_URL=https://your-production-backend/api eas build --profile production --platform android
   ```

For a quick installable `.apk` instead (internal testing, not Play Store), use the `preview` profile defined in `eas.json`:
```bash
eas build --profile preview --platform android
```

## 9. How this app connects to the existing backend

This app is a pure REST + WebSocket client against your existing Spring Boot backend. It does not run its own backend, database, or auth server.

| Feature | Backend endpoint(s) | Notes |
|---|---|---|
| Auth | `POST /auth/signup`, `/login`, `/forgot-password`, `/reset-password` | Same contract as web |
| Users | `GET /users/:id`, `/users/mobile/:mobile`, `/users/search`, `POST /users/:id/profile-image` | |
| Posts | `GET /posts/feed`, `/posts/user/:id`, `/posts/:id`, `POST /posts/create`, `DELETE /posts/:id` | Multipart upload for media |
| Messages | `POST /messages/send/text`, `/send/voice`, `GET /messages/chat`, `/chat-users/:id`, `/inbox/:id`, `/unread-count/:id`, `POST /messages/mark-read` | |
| Chatbot | `POST /chatbot/ask` | Groq key stays server-side, never touches the app |
| Real-time | STOMP over WebSocket at `/ws` (raw `/websocket` transport, no SockJS needed client-side) | Topics: `/topic/messages/{userId}`, `/topic/call/{userId}` |
| Calling | Same STOMP topics, signaling relayed by the existing `CallSignalController` | No new signaling backend |

JWT is sent as `Authorization: Bearer <token>` on every request (see `src/services/api.js`). A 401 response anywhere automatically clears the stored session and returns the user to the login screen.

## 10. Required Android permissions

Declared in `app.config.js` and merged into the native manifest during prebuild:

- `CAMERA` — taking/attaching photos to a post, video calling
- `RECORD_AUDIO` — voice messages, audio/video calling
- `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` — picking media from the gallery
- `react-native-webrtc`'s config plugin additionally injects `SYSTEM_ALERT_WINDOW`, `BLUETOOTH`, `WAKE_LOCK`, `MODIFY_AUDIO_SETTINGS`, `ACCESS_NETWORK_STATE` automatically — you don't need to add these yourself

All of these are requested at runtime (not just declared), the first time the relevant feature is used — e.g. the mic permission prompt appears the first time you tap the voice message button, not at app launch.

## 11. Security notes

- No backend secret (DB password, JWT signing secret, Groq API key, Cloudinary secret, Sightengine secret) exists anywhere in this app's source. It only needs `API_BASE_URL`/`WS_BASE_URL`.
- The JWT is stored via `expo-secure-store`, which is backed by the Android Keystore — not plain-text `AsyncStorage`.
- `.env` is git-ignored (see `.gitignore`); only `.env.example` (names, no values) is committed.

## 12. Additional setup for WebRTC calling

- Calling requires the native build path (`expo run:android` or an EAS dev/preview build) — see §6.
- The app uses STUN-only ICE configuration (Google's public STUN servers), matching the existing web app. There is **no TURN server** configured. Calls between two devices both behind restrictive/symmetric NATs (common on some carrier mobile-data networks) may fail to establish a peer connection. This is a pre-existing limitation of the reference web implementation, not something specific to the Android port — if you hit this in testing, it's worth adding a TURN server (e.g., via a provider like Twilio or a self-hosted coturn) to both the web and Android signaling flow.
- Camera/mic permissions are requested the first time a call is placed or accepted, not at app launch.

## 13. Troubleshooting

**`API_BASE_URL is not configured` error at startup**
You haven't created a `.env` file (or didn't set `API_BASE_URL` as an env var). Run `cp .env.example .env` and fill it in.

**App can't reach the backend from the emulator, but the backend works fine in a browser on the same machine**
Use `http://10.0.2.2:8080/api` instead of `localhost` — the emulator's `localhost` refers to the emulator itself, not your host machine.

**`react-native-webrtc` / calling crashes or fails to build**
Confirm you're not running through plain Expo Go — see §6. Run `npx expo prebuild --platform android --clean` then `npx expo run:android`.

**STOMP/WebSocket never connects (chat messages only arrive via the slow poll, calls never ring)**
Check that `WS_BASE_URL` (or the derived `${API_BASE_URL}/ws`) is reachable and that your backend's CORS/allowed-origins config isn't blocking it — a native WebSocket connection doesn't send an `Origin` header the way a browser does, so if the backend's `WebSocketConfig.setAllowedOrigins(...)` is unexpectedly strict, check that. No backend code change should be needed for the existing config, but this is the first thing to check if sockets silently fail.

**Build fails with a Gradle/Java version error**
Confirm you're on Java 17. Android Gradle Plugin versions bundled with Expo SDK 51 expect it specifically; Java 21 or Java 11 can both cause obscure build failures.

**Metro bundler can't find a module after `npm install`**
Clear the cache: `npx expo start --clear`.

**Changes to `app.config.js` (new permission, new plugin) don't show up in a build**
You need to regenerate the native project: `npx expo prebuild --platform android --clean`, since `android/` is generated output, not something Expo re-reads live.

## 14. Project structure

```
mobile/
├── App.js                     # Root component: providers + global overlays (call UI, chatbot)
├── app.config.js              # Expo config (permissions, plugins, env-driven API URL)
├── eas.json                   # EAS build profiles (development/preview/production)
├── babel.config.js
├── package.json
├── .env.example                # Config template - no real secrets
├── assets/                    # App icon, adaptive icon, splash (placeholders - swap for real branding)
├── android/                   # Generated native project (regenerate via `expo prebuild` after config changes)
└── src/
    ├── components/            # Shared UI: PostCard, AuthInput/AuthScreen, CallOverlay, ChatbotWidget
    ├── config/                 # env.js - reads Expo config into API_BASE_URL/WS_BASE_URL
    ├── context/                # AuthContext, SocketContext, CallContext
    ├── navigation/             # RootNavigator, AuthNavigator, MainNavigator, MainTabs
    ├── screens/                # auth/, home/, posts/, profile/, messages/, chat/
    ├── services/               # api.js (REST), socket.js (STOMP)
    ├── theme/                  # Design tokens (colors, spacing, typography)
    └── utils/                  # timeAgo, messageTime, voiceRecording, secureStorage
```

## 15. What was verified vs. what needs a real device

Every phase of this build was verified with what's actually checkable without a device: `npm install` resolving cleanly, every file passing Babel syntax checks, every import resolving to a real file, every used package being declared, and an actual `expo prebuild` run confirming the generated `AndroidManifest.xml` contains the right permissions and package id.

What was **not** and **could not** be verified without a physical device or emulator: actually tapping through login/signup, confirming media uploads render correctly, placing a real call between two devices, or testing Wi-Fi/mobile-data switching. Run through the checklist in `TESTING.md` before considering this production-ready.
