import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Platform, PermissionsAndroid } from "react-native";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from "react-native-webrtc";

import { useAuth } from "./AuthContext";
import {
  subscribeTopic,
  publishMessage,
} from "../services/socket";

const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);

  if (!context) {
    throw new Error(
      "useCall must be used within CallProvider"
    );
  }

  return context;
};

/*
 * STUN servers help peers discover their public network address.
 *
 * IMPORTANT:
 * STUN-only WebRTC can fail when both devices are behind
 * restrictive/symmetric NATs.
 *
 * For a production Play Store app, add a TURN server later.
 */
const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "stun:stun1.l.google.com:19302",
    },
  ],
};

/*
 * Request Android's runtime CAMERA/RECORD_AUDIO permissions before
 * touching getUserMedia.
 *
 * Declaring these permissions in app.config.js / AndroidManifest.xml is
 * necessary but not sufficient - react-native-webrtc does not itself
 * trigger the system permission dialog the way a browser does.
 * Without this explicit request, getUserMedia can fail (silently or
 * with a native error) on a real device where the user hasn't already
 * granted these permissions some other way.
 *
 * No-ops (returns true) on non-Android platforms, since this project
 * targets Android and other platforms handle permission prompting
 * differently.
 */
async function ensureCallPermissions(isVideo) {
  if (Platform.OS !== "android") {
    return true;
  }

  const permissionsToRequest = [
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];

  if (isVideo) {
    permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

  try {
    const results = await PermissionsAndroid.requestMultiple(
      permissionsToRequest
    );

    const allGranted = permissionsToRequest.every(
      (permission) =>
        results[permission] === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      console.warn(
        "⚠️ Call permission(s) denied:",
        permissionsToRequest.filter(
          (p) => results[p] !== PermissionsAndroid.RESULTS.GRANTED
        )
      );
    }

    return allGranted;
  } catch (error) {
    console.error("❌ Permission request failed:", error?.message);
    return false;
  }
}

export const CallProvider = ({ children }) => {
  const { user } = useAuth();

  const [callStatus, setCallStatus] = useState("idle");
  // idle | outgoing | incoming | connected

  const [callType, setCallType] = useState(null);
  // audio | video

  const [peerInfo, setPeerInfo] = useState(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const peerConnectionRef = useRef(null);

  const pendingCandidatesRef = useRef([]);

  const incomingOfferRef = useRef(null);

  const callStatusRef = useRef("idle");

  /*
   * Keep latest call status available inside
   * asynchronous STOMP callbacks.
   */
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  /*
   * Send WebRTC signaling message through STOMP.
   */
  const sendSignal = async (signal) => {
    try {
      await publishMessage(
        "/app/call/signal",
        signal
      );

      console.log(
        "📤 Call signal sent:",
        signal.type
      );
    } catch (error) {
      console.error(
        "❌ Failed to send call signal:",
        error
      );
    }
  };

  /*
   * Clean everything after call ends/rejects/fails.
   */
  const cleanupCall = () => {
    console.log("🧹 Cleaning call");

    try {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;

        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    } catch (error) {
      console.warn(
        "Peer connection cleanup error:",
        error
      );
    }

    setLocalStream((previousStream) => {
      if (previousStream) {
        previousStream
          .getTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch (error) {
              console.warn(
                "Track stop error:",
                error
              );
            }
          });
      }

      return null;
    });

    setRemoteStream(null);
    setPeerInfo(null);
    setCallType(null);

    setCallStatus("idle");
    callStatusRef.current = "idle";

    setMuted(false);
    setCameraOff(false);

    pendingCandidatesRef.current = [];
    incomingOfferRef.current = null;
  };

  /*
   * Create RTCPeerConnection.
   */
  const createPeerConnection = (targetUserId) => {
    console.log(
      "🔗 Creating peer connection for:",
      targetUserId
    );

    const pc = new RTCPeerConnection(
      ICE_SERVERS
    );

    /*
     * Local ICE candidates.
     */
    pc.addEventListener(
      "icecandidate",
      (event) => {
        if (!event.candidate) {
          return;
        }

        console.log(
          "🧊 Sending ICE candidate"
        );

        sendSignal({
          type: "ice-candidate",

          fromUserId: user.userId,

          toUserId: targetUserId,

          payload: event.candidate,
        });
      }
    );

    /*
     * Remote audio/video stream.
     */
    pc.addEventListener(
      "track",
      (event) => {
        console.log(
          "🎥 Remote track received"
        );

        if (event.streams && event.streams[0]) {
          setRemoteStream(
            event.streams[0]
          );
        }
      }
    );

    /*
     * Connection state debugging.
     */
    pc.addEventListener(
      "connectionstatechange",
      () => {
        console.log(
          "📡 WebRTC connection state:",
          pc.connectionState
        );

        if (
          pc.connectionState ===
            "failed" ||
          pc.connectionState ===
            "closed"
        ) {
          console.warn(
            "❌ WebRTC connection failed/closed"
          );
        }
      }
    );

    /*
     * ICE connection debugging.
     */
    pc.addEventListener(
      "iceconnectionstatechange",
      () => {
        console.log(
          "🧊 ICE state:",
          pc.iceConnectionState
        );
      }
    );

    peerConnectionRef.current = pc;

    return pc;
  };

  /*
   * Get microphone/camera.
   *
   * Now requests Android's runtime CAMERA/RECORD_AUDIO permissions
   * first - both startCall and acceptCall route through here, so this
   * one change covers both call paths. If permission is denied, this
   * throws, which is already caught by startCall's/acceptCall's
   * existing try/catch blocks (same "Camera/microphone access is
   * required" alert as before) - no other changes needed there.
   */
  const getMedia = async (isVideo) => {
    const permissionsGranted = await ensureCallPermissions(isVideo);

    if (!permissionsGranted) {
      throw new Error(
        "Microphone/camera permission was not granted."
      );
    }

    console.log(
      "🎙️ Requesting media:",
      isVideo ? "audio + video" : "audio"
    );

    const stream =
      await mediaDevices.getUserMedia({
        audio: true,

        video: isVideo
          ? {
              width: 480,
              height: 360,
              frameRate: 30,
              facingMode: "user",
            }
          : false,
      });

    console.log(
      "✅ Media stream obtained"
    );

    setLocalStream(stream);

    return stream;
  };

  /*
   * Add pending ICE candidates after
   * remote description becomes available.
   */
  const flushPendingCandidates = async (
    pc
  ) => {
    if (
      !pc.remoteDescription ||
      !pendingCandidatesRef.current.length
    ) {
      return;
    }

    console.log(
      "🧊 Adding pending ICE candidates:",
      pendingCandidatesRef.current.length
    );

    const candidates =
      pendingCandidatesRef.current;

    pendingCandidatesRef.current = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (error) {
        console.warn(
          "ICE candidate error:",
          error?.message
        );
      }
    }
  };

  /*
   * Handle incoming signaling messages.
   */
  const handleSignal = async (signal) => {
    if (!signal || !signal.type) {
      return;
    }

    console.log(
      "📩 Call signal received:",
      signal.type
    );

    try {
      switch (signal.type) {
        /*
         * Incoming call.
         */
        case "call-invite": {
          if (
            callStatusRef.current !==
            "idle"
          ) {
            console.log(
              "Already in another call"
            );

            await sendSignal({
              type: "call-reject",

              fromUserId:
                user.userId,

              toUserId:
                signal.fromUserId,
            });

            return;
          }

          incomingOfferRef.current =
            signal.payload;

          setCallType(
            signal.callType
          );

          setPeerInfo({
            id: signal.fromUserId,

            name:
              signal.fromUserName ||
              "Unknown",

            profileImage:
              signal.profileImage ||
              null,
          });

          setCallStatus("incoming");

          callStatusRef.current =
            "incoming";

          break;
        }

        /*
         * Caller receives answer.
         */
        case "call-answer": {
          const pc =
            peerConnectionRef.current;

          if (!pc) {
            console.warn(
              "No peer connection for answer"
            );

            return;
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              signal.payload
            )
          );

          await flushPendingCandidates(
            pc
          );

          setCallStatus("connected");

          callStatusRef.current =
            "connected";

          break;
        }

        /*
         * ICE candidate.
         */
        case "ice-candidate": {
          const pc =
            peerConnectionRef.current;

          if (!pc) {
            pendingCandidatesRef.current.push(
              signal.payload
            );

            return;
          }

          if (
            pc.remoteDescription
          ) {
            try {
              await pc.addIceCandidate(
                new RTCIceCandidate(
                  signal.payload
                )
              );

              console.log(
                "🧊 ICE candidate added"
              );
            } catch (error) {
              console.warn(
                "ICE candidate error:",
                error?.message
              );
            }
          } else {
            pendingCandidatesRef.current.push(
              signal.payload
            );
          }

          break;
        }

        /*
         * Call rejected.
         */
        case "call-reject": {
          console.log(
            "📵 Call rejected"
          );

          cleanupCall();

          break;
        }

        /*
         * Call ended.
         */
        case "call-end": {
          console.log(
            "📴 Call ended"
          );

          cleanupCall();

          break;
        }

        default:
          console.warn(
            "Unknown call signal:",
            signal.type
          );
      }
    } catch (error) {
      console.error(
        "❌ Error handling call signal:",
        error
      );
    }
  };

  /*
   * Keep latest signal handler.
   */
  const handleSignalRef =
    useRef(handleSignal);

  useEffect(() => {
    handleSignalRef.current =
      handleSignal;
  });

  /*
   * Subscribe to user's call topic.
   *
   * Unchanged from before - this already correctly guards against the
   * unmount-before-subscribe-resolves race via the `cancelled` flag.
   * It also no longer needs to know about reconnects: services/socket.js
   * now automatically restores this subscription after any reconnect
   * (network drop, or SocketContext's background/foreground cycle), so
   * incoming calls keep working without this effect re-running.
   */
  useEffect(() => {
    if (!user?.userId) {
      return;
    }

    let unsubscribe = null;
    let cancelled = false;

    const setupCallSubscription =
      async () => {
        try {
          console.log(
            "📡 Subscribing to call topic:",
            `/topic/call/${user.userId}`
          );

          const unsubscribeFn =
            await subscribeTopic(
              `/topic/call/${user.userId}`,
              (signal) => {
                handleSignalRef.current(
                  signal
                );
              }
            );

          if (cancelled) {
            unsubscribeFn?.();
          } else {
            unsubscribe =
              unsubscribeFn;
          }
        } catch (error) {
          console.error(
            "❌ Call topic subscription failed:",
            error
          );
        }
      };

    setupCallSubscription();

    return () => {
      cancelled = true;

      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.userId]);

  /*
   * Start outgoing call.
   */
  const startCall = async (
    peer,
    type
  ) => {
    if (!peer?.id) {
      console.warn(
        "Invalid peer for call"
      );

      return;
    }

    if (
      callStatusRef.current !==
      "idle"
    ) {
      Alert.alert(
        "Call in progress",
        "Please end the current call first."
      );

      return;
    }

    try {
      console.log(
        "📞 Starting call:",
        type,
        "to:",
        peer.id
      );

      setCallType(type);
      setPeerInfo(peer);
      setCallStatus("outgoing");

      callStatusRef.current =
        "outgoing";

      const stream =
        await getMedia(
          type === "video"
        );

      const pc =
        createPeerConnection(
          peer.id
        );

      stream
        .getTracks()
        .forEach((track) => {
          pc.addTrack(
            track,
            stream
          );
        });

      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer
      );

      console.log(
        "📤 Sending call invite"
      );

      await sendSignal({
        type: "call-invite",

        fromUserId:
          user.userId,

        toUserId:
          peer.id,

        fromUserName:
          user.name,

        callType: type,

        payload: offer,
      });
    } catch (error) {
      console.error(
        "❌ Error starting call:",
        error
      );

      Alert.alert(
        "Call failed",
        "Camera/microphone access is required. Please check app permissions."
      );

      cleanupCall();
    }
  };

  /*
   * Accept incoming call.
   */
  const acceptCall = async () => {
    if (
      !peerInfo?.id ||
      !incomingOfferRef.current
    ) {
      console.warn(
        "Missing incoming call data"
      );

      return;
    }

    try {
      console.log(
        "📞 Accepting call"
      );

      const isVideo =
        callType === "video";

      const stream =
        await getMedia(
          isVideo
        );

      const pc =
        createPeerConnection(
          peerInfo.id
        );

      stream
        .getTracks()
        .forEach((track) => {
          pc.addTrack(
            track,
            stream
          );
        });

      /*
       * Set caller's offer.
       */
      await pc.setRemoteDescription(
        new RTCSessionDescription(
          incomingOfferRef.current
        )
      );

      /*
       * Add ICE candidates that
       * arrived before remote description.
       */
      await flushPendingCandidates(
        pc
      );

      /*
       * Create answer.
       */
      const answer =
        await pc.createAnswer();

      await pc.setLocalDescription(
        answer
      );

      /*
       * Send answer back.
       */
      await sendSignal({
        type: "call-answer",

        fromUserId:
          user.userId,

        toUserId:
          peerInfo.id,

        payload: answer,
      });

      setCallStatus("connected");

      callStatusRef.current =
        "connected";

      console.log(
        "✅ Call accepted"
      );
    } catch (error) {
      console.error(
        "❌ Error accepting call:",
        error
      );

      Alert.alert(
        "Call failed",
        "Camera/microphone access is required. Please check app permissions."
      );

      rejectCall();
    }
  };

  /*
   * Reject incoming call.
   */
  const rejectCall = async () => {
    if (peerInfo?.id) {
      await sendSignal({
        type: "call-reject",

        fromUserId:
          user.userId,

        toUserId:
          peerInfo.id,
      });
    }

    cleanupCall();
  };

  /*
   * End current call.
   */
  const endCall = async () => {
    if (peerInfo?.id) {
      await sendSignal({
        type: "call-end",

        fromUserId:
          user.userId,

        toUserId:
          peerInfo.id,
      });
    }

    cleanupCall();
  };

  /*
   * Mute/unmute microphone.
   */
  const toggleMute = () => {
    if (!localStream) {
      return;
    }

    const newMuted =
      !muted;

    localStream
      .getAudioTracks()
      .forEach((track) => {
        track.enabled =
          !newMuted;
      });

    setMuted(newMuted);
  };

  /*
   * Turn camera on/off.
   */
  const toggleCamera = () => {
    if (!localStream) {
      return;
    }

    const newCameraOff =
      !cameraOff;

    localStream
      .getVideoTracks()
      .forEach((track) => {
        track.enabled =
          !newCameraOff;
      });

    setCameraOff(
      newCameraOff
    );
  };

  /*
   * Cleanup if provider unmounts.
   */
  useEffect(() => {
    return () => {
      try {
        if (
          peerConnectionRef.current
        ) {
          peerConnectionRef.current.close();
          peerConnectionRef.current =
            null;
        }
      } catch (error) {
        console.warn(
          "Call provider cleanup error:",
          error
        );
      }

      if (localStream) {
        localStream
          .getTracks()
          .forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
      }
    };
  }, []);

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callType,
        peerInfo,

        localStream,
        remoteStream,

        muted,
        cameraOff,

        startCall,
        acceptCall,
        rejectCall,
        endCall,

        toggleMute,
        toggleCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};