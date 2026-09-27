import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { RTCView } from "react-native-webrtc";
import {
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
} from "lucide-react-native";

import { useCall } from "../context/CallContext";
import { getMediaUrl } from "../services/api";
import { colors, spacing, radii, typography } from "../theme/theme";

export default function CallOverlay() {
  const {
    callStatus,
    callType,
    peerInfo,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();

  const [remoteReady, setRemoteReady] = useState(false);

  const isVideo = callType === "video";

  useEffect(() => {
    setRemoteReady(!!remoteStream);

    return () => {
      setRemoteReady(false);
    };
  }, [remoteStream]);

  if (callStatus === "idle") {
    return null;
  }

  const avatarLetter =
    peerInfo?.name?.trim()?.charAt(0)?.toUpperCase() || "?";

  const profileImage = peerInfo?.profileImage
    ? getMediaUrl(peerInfo.profileImage)
    : null;

  // --------------------------------------------------
  // INCOMING CALL
  // --------------------------------------------------

  if (callStatus === "incoming") {
    return (
      <SafeAreaView style={styles.overlay}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={colors.callBackground}
        />

        <View style={styles.incomingContainer}>
          <View style={styles.incomingTop}>
            <Text style={styles.incomingLabel}>INCOMING CALL</Text>

            <Text style={styles.callTypeText}>
              {isVideo ? "Video Call" : "Voice Call"}
            </Text>
          </View>

          <Avatar
            image={profileImage}
            letter={avatarLetter}
            size={120}
          />

          <Text style={styles.name}>
            {peerInfo?.name || "Unknown User"}
          </Text>

          <Text style={styles.subtitle}>
            {isVideo
              ? "Incoming video call..."
              : "Incoming voice call..."}
          </Text>

          <View style={styles.incomingActions}>
            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.largeCallButton, styles.rejectButton]}
                onPress={rejectCall}
                activeOpacity={0.8}
              >
                <PhoneOff size={28} color={colors.white} />
              </TouchableOpacity>

              <Text style={styles.actionLabel}>Decline</Text>
            </View>

            <View style={styles.actionWrapper}>
              <TouchableOpacity
                style={[styles.largeCallButton, styles.acceptButton]}
                onPress={acceptCall}
                activeOpacity={0.8}
              >
                {isVideo ? (
                  <Video size={28} color={colors.white} />
                ) : (
                  <Phone size={28} color={colors.white} />
                )}
              </TouchableOpacity>

              <Text style={styles.actionLabel}>Accept</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------
  // OUTGOING CALL
  // --------------------------------------------------

  if (callStatus === "outgoing") {
    return (
      <SafeAreaView style={styles.overlay}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={colors.callBackground}
        />

        <View style={styles.outgoingContainer}>
          <Text style={styles.outgoingLabel}>
            {isVideo ? "VIDEO CALL" : "VOICE CALL"}
          </Text>

          <View style={styles.outgoingAvatarWrapper}>
            <Avatar
              image={profileImage}
              letter={avatarLetter}
              size={120}
            />
          </View>

          <Text style={styles.name}>
            {peerInfo?.name || "Unknown User"}
          </Text>

          <Text style={styles.subtitle}>Calling...</Text>

          <View style={styles.callingDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <TouchableOpacity
            style={[styles.largeCallButton, styles.rejectButton]}
            onPress={endCall}
            activeOpacity={0.8}
          >
            <PhoneOff size={28} color={colors.white} />
          </TouchableOpacity>

          <Text style={styles.actionLabel}>Cancel</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------
  // CONNECTED CALL
  // --------------------------------------------------

  return (
    <View style={styles.connectedContainer}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.callBackground}
      />

      {isVideo ? (
        <>
          {/* REMOTE VIDEO */}

          {remoteReady ? (
            <RTCView
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="cover"
              mirror={false}
              zOrder={0}
            />
          ) : (
            <View style={styles.remotePlaceholder}>
              <Avatar
                image={profileImage}
                letter={avatarLetter}
                size={110}
              />

              <Text style={styles.remoteName}>
                {peerInfo?.name || "User"}
              </Text>

              <Text style={styles.connectingText}>
                Connecting video...
              </Text>
            </View>
          )}

          {/* LOCAL VIDEO */}

          {localStream && !cameraOff && (
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
              zOrder={1}
            />
          )}

          {/* CAMERA OFF */}

          {cameraOff && (
            <View style={styles.cameraOffPreview}>
              <View style={styles.smallAvatar}>
                <Text style={styles.smallAvatarText}>
                  {avatarLetter}
                </Text>
              </View>

              <Text style={styles.cameraOffText}>
                Camera Off
              </Text>
            </View>
          )}
        </>
      ) : (
        // --------------------------------------------------
        // AUDIO CALL
        // --------------------------------------------------

        <View style={styles.audioCallContainer}>
          <View style={styles.audioTop}>
            <Text style={styles.audioCallLabel}>VOICE CALL</Text>

            <View style={styles.audioStatus}>
              <View style={styles.statusDot} />

              <Text style={styles.audioStatusText}>
                Connected
              </Text>
            </View>
          </View>

          <View style={styles.audioCenter}>
            <View style={styles.audioAvatarRing}>
              <Avatar
                image={profileImage}
                letter={avatarLetter}
                size={130}
              />
            </View>

            <Text style={styles.audioName}>
              {peerInfo?.name || "Unknown User"}
            </Text>

            <Text style={styles.audioSubtitle}>
              Voice call in progress
            </Text>

            <View style={styles.audioIndicator}>
              <Volume2 size={20} color={colors.white} />

              <Text style={styles.audioIndicatorText}>
                Connected
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* --------------------------------------------------
          CALL CONTROLS
      -------------------------------------------------- */}

      <View style={styles.controlsContainer}>
        <View style={styles.controlGroup}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              muted && styles.controlButtonActive,
            ]}
            onPress={toggleMute}
            activeOpacity={0.8}
          >
            {muted ? (
              <MicOff size={23} color={colors.white} />
            ) : (
              <Mic size={23} color={colors.white} />
            )}
          </TouchableOpacity>

          <Text style={styles.controlLabel}>
            {muted ? "Unmute" : "Mute"}
          </Text>
        </View>

        {isVideo && (
          <View style={styles.controlGroup}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                cameraOff && styles.controlButtonActive,
              ]}
              onPress={toggleCamera}
              activeOpacity={0.8}
            >
              {cameraOff ? (
                <VideoOff size={23} color={colors.white} />
              ) : (
                <Video size={23} color={colors.white} />
              )}
            </TouchableOpacity>

            <Text style={styles.controlLabel}>
              {cameraOff ? "Camera On" : "Camera Off"}
            </Text>
          </View>
        )}

        <View style={styles.controlGroup}>
          <TouchableOpacity
            style={[styles.controlButton, styles.endButton]}
            onPress={endCall}
            activeOpacity={0.8}
          >
            <PhoneOff size={23} color={colors.white} />
          </TouchableOpacity>

          <Text style={styles.controlLabel}>End</Text>
        </View>
      </View>
    </View>
  );
}

// ======================================================
// AVATAR
// ======================================================

function Avatar({ image, letter, size = 96 }) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      ) : (
        <Text
          style={[
            styles.avatarLetter,
            {
              fontSize: size * 0.36,
            },
          ]}
        >
          {letter}
        </Text>
      )}
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.callBackground || "#0F172A",
    zIndex: 9999,
    elevation: 9999,
  },

  // ---------------- INCOMING ----------------

  incomingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  incomingTop: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },

  incomingLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2,
  },

  callTypeText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    marginTop: 6,
  },

  // ---------------- OUTGOING ----------------

  outgoingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },

  outgoingLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },

  outgoingAvatarWrapper: {
    marginBottom: spacing.lg,
  },

  callingDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 40,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  // ---------------- AVATAR ----------------

  avatar: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: colors.accent,
  },

  avatarLetter: {
    color: colors.white,
    fontWeight: "800",
  },

  // ---------------- TEXT ----------------

  name: {
    ...typography.h1,
    color: colors.white,
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    ...typography.body,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  // ---------------- ACTIONS ----------------

  incomingActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 60,
    marginTop: spacing.xl,
  },

  actionWrapper: {
    alignItems: "center",
  },

  largeCallButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
  },

  acceptButton: {
    backgroundColor: colors.success || "#22C55E",
  },

  rejectButton: {
    backgroundColor: colors.danger || "#EF4444",
  },

  actionLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },

  // ---------------- CONNECTED ----------------

  connectedContainer: {
    flex: 1,
    backgroundColor: "#000",
  },

  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

  remotePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#101010",
    alignItems: "center",
    justifyContent: "center",
  },

  remoteName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.md,
  },

  connectingText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginTop: 6,
  },

  // ---------------- LOCAL VIDEO ----------------

  localVideo: {
    position: "absolute",
    top: 55,
    right: 16,
    width: 105,
    height: 145,
    borderRadius: 14,
    backgroundColor: "#111",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
    overflow: "hidden",
  },

  cameraOffPreview: {
    position: "absolute",
    top: 55,
    right: 16,
    width: 105,
    height: 145,
    borderRadius: 14,
    backgroundColor: "#202020",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  smallAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  smallAvatarText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "800",
  },

  cameraOffText: {
    color: colors.white,
    fontSize: 11,
    marginTop: 7,
  },

  // ---------------- AUDIO CALL ----------------

  audioCallContainer: {
    flex: 1,
    backgroundColor: colors.callBackground || "#0F172A",
  },

  audioTop: {
    paddingTop: 25,
    paddingHorizontal: 20,
    alignItems: "center",
  },

  audioCallLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },

  audioStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success || "#22C55E",
    marginRight: 6,
  },

  audioStatusText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
  },

  audioCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  audioAvatarRing: {
    padding: 7,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 20,
  },

  audioName: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },

  audioSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginTop: 8,
  },

  audioIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  audioIndicatorText: {
    color: colors.white,
    fontSize: 13,
    marginLeft: 7,
  },

  // ---------------- CONTROLS ----------------

  controlsContainer: {
    position: "absolute",
    bottom: 35,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 25,
  },

  controlGroup: {
    alignItems: "center",
  },

  controlButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  controlButtonActive: {
    backgroundColor: "rgba(255,255,255,0.30)",
  },

  endButton: {
    backgroundColor: colors.danger || "#EF4444",
  },

  controlLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 6,
  },
});