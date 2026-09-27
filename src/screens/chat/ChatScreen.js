import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { Audio } from "expo-av";

import {
  ArrowLeft,
  Send,
  Mic,
  Square,
  Phone,
  Video,
} from "lucide-react-native";

import {
  messageAPI,
  userAPI,
  getMediaUrl,
} from "../../services/api";

import { useAuth } from "../../context/AuthContext";
import { useCall } from "../../context/CallContext";
import { useSocket } from "../../context/SocketContext";

import { formatMessageTime } from "../../utils/messageTime";

import {
  requestMicPermission,
  startVoiceRecording,
  stopVoiceRecording,
  cancelVoiceRecording,
} from "../../utils/voiceRecording";

import {
  colors,
  spacing,
  radii,
  typography,
} from "../../theme/theme";


export default function ChatScreen({ route, navigation }) {
  const { receiverId, userName } = route.params || {};

  // -----------------------------
  // CONTEXTS
  // -----------------------------

  const { user } = useAuth();

  const { subscribeTopic } = useSocket();

  const {
    startCall,
    callStatus,
  } = useCall();


  // -----------------------------
  // STATE
  // -----------------------------

  const [messages, setMessages] = useState([]);

  const [receiverUser, setReceiverUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [newMessage, setNewMessage] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [recording, setRecording] =
    useState(false);

  const [playingId, setPlayingId] =
    useState(null);


  // -----------------------------
  // REFS
  // -----------------------------

  const listRef = useRef(null);

  const soundRef = useRef(null);

  const mountedRef = useRef(true);


  // ==================================================
  // LOAD MESSAGES
  // ==================================================

  const loadMessages = useCallback(
    async () => {
      if (!receiverId) {
        return;
      }

      try {
        const response =
          await messageAPI.getChatMessages(
            receiverId
          );

        if (!mountedRef.current) {
          return;
        }

        const incomingMessages =
          Array.isArray(response.data)
            ? response.data
            : [];

        setMessages((previous) => {
          const sameLength =
            previous.length ===
            incomingMessages.length;

          if (
            sameLength &&
            previous.length > 0
          ) {
            const lastOld =
              previous[
                previous.length - 1
              ];

            const lastNew =
              incomingMessages[
                incomingMessages.length - 1
              ];

            if (
              String(lastOld?.id) ===
              String(lastNew?.id)
            ) {
              return previous;
            }
          }

          return incomingMessages;
        });
      } catch (error) {
        console.warn(
          "Failed to load messages:",
          error?.response?.data ||
            error?.message
        );
      }
    },
    [receiverId]
  );


  // ==================================================
  // LOAD CHAT
  // ==================================================

  const loadChat = useCallback(
    async () => {
      if (!receiverId) {
        return;
      }

      setLoading(true);

      try {
        const userResponse =
          await userAPI.getUser(
            receiverId
          );

        if (!mountedRef.current) {
          return;
        }

        setReceiverUser(
          userResponse.data
        );

        await loadMessages();

        await messageAPI.markAsRead(
          receiverId
        );
      } catch (error) {
        console.warn(
          "Failed to load chat:",
          error?.response?.data ||
            error?.message
        );

        if (mountedRef.current) {
          Alert.alert(
            "Chat Error",
            "Unable to load this conversation."
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [receiverId, loadMessages]
  );


  // ==================================================
  // SCREEN LIFECYCLE
  // ==================================================

  useEffect(() => {
    mountedRef.current = true;

    loadChat();

    return () => {
      mountedRef.current = false;

      if (soundRef.current) {
        soundRef.current
          .unloadAsync()
          .catch(() => {});

        soundRef.current = null;
      }

      try {
        cancelVoiceRecording();
      } catch (_) {}
    };
  }, [loadChat]);


  // ==================================================
  // REALTIME MESSAGE SUBSCRIPTION
  // ==================================================

  useEffect(() => {
    if (
      !user?.userId ||
      !receiverId ||
      !subscribeTopic
    ) {
      return;
    }

    let unsubscribe = null;

    let cancelled = false;

    const topic =
      `/topic/messages/${user.userId}`;


    const setupSubscription =
      async () => {
        try {
          const removeSubscription =
            await subscribeTopic(
              topic,
              async (incoming) => {
                if (
                  cancelled ||
                  !incoming
                ) {
                  return;
                }

                const senderId =
                  incoming.senderId;

                const incomingReceiverId =
                  incoming.receiverId;


                const belongsToConversation =
                  String(senderId) ===
                    String(receiverId) ||
                  String(
                    incomingReceiverId
                  ) ===
                    String(receiverId);


                if (
                  !belongsToConversation
                ) {
                  return;
                }


                setMessages(
                  (previous) => {
                    const incomingId =
                      incoming.id;

                    if (
                      incomingId !=
                        null &&
                      previous.some(
                        (message) =>
                          String(
                            message.id
                          ) ===
                          String(
                            incomingId
                          )
                      )
                    ) {
                      return previous;
                    }

                    return [
                      ...previous,
                      incoming,
                    ];
                  }
                );


                if (
                  String(senderId) ===
                  String(receiverId)
                ) {
                  try {
                    await messageAPI.markAsRead(
                      receiverId
                    );
                  } catch (error) {
                    console.warn(
                      "markAsRead failed:",
                      error?.message
                    );
                  }
                }


                requestAnimationFrame(
                  () => {
                    listRef.current?.scrollToEnd(
                      {
                        animated: true,
                      }
                    );
                  }
                );
              }
            );


          if (!cancelled) {
            unsubscribe =
              removeSubscription;
          } else {
            removeSubscription?.();
          }
        } catch (error) {
          console.warn(
            "STOMP message subscription failed:",
            error?.message
          );
        }
      };


    setupSubscription();


    return () => {
      cancelled = true;

      try {
        unsubscribe?.();
      } catch (error) {
        console.warn(
          "Subscription cleanup failed:",
          error?.message
        );
      }
    };
  }, [
    user?.userId,
    receiverId,
    subscribeTopic,
  ]);


  // ==================================================
  // SEND TEXT MESSAGE
  // ==================================================

  const handleSend = async () => {
    const text =
      newMessage.trim();

    if (
      !text ||
      sending ||
      !receiverId
    ) {
      return;
    }

    setSending(true);

    try {
      await messageAPI.sendTextMessage(
        receiverId,
        text
      );

      setNewMessage("");

      await loadMessages();

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({
          animated: true,
        });
      });
    } catch (error) {
      console.error(
        "Send message error:",
        error?.response?.data ||
          error?.message
      );

      Alert.alert(
        "Message failed",
        "Message send nahi hua. Please check your connection and try again."
      );
    } finally {
      if (mountedRef.current) {
        setSending(false);
      }
    }
  };


  // ==================================================
  // START VOICE RECORDING
  // ==================================================

  const handleStartRecording =
    async () => {
      if (
        sending ||
        recording
      ) {
        return;
      }

      const granted =
        await requestMicPermission();

      if (!granted) {
        Alert.alert(
          "Permission required",
          "Microphone permission is required to record a voice message."
        );

        return;
      }

      try {
        await startVoiceRecording();

        if (mountedRef.current) {
          setRecording(true);
        }
      } catch (error) {
        console.error(
          "Start recording error:",
          error?.message
        );

        Alert.alert(
          "Recording failed",
          "Could not start voice recording."
        );
      }
    };


  // ==================================================
  // STOP + SEND VOICE
  // ==================================================

  const handleStopRecording =
    async () => {
      if (!recording) {
        return;
      }

      try {
        const asset =
          await stopVoiceRecording();

        if (mountedRef.current) {
          setRecording(false);
        }

        if (!asset) {
          return;
        }

        setSending(true);

        await messageAPI.sendVoiceMessage(
          receiverId,
          asset
        );

        await loadMessages();

        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({
            animated: true,
          });
        });
      } catch (error) {
        console.error(
          "Voice message error:",
          error?.response?.data ||
            error?.message
        );

        Alert.alert(
          "Voice message failed",
          "Voice message send nahi hua."
        );
      } finally {
        if (mountedRef.current) {
          setSending(false);
          setRecording(false);
        }
      }
    };


  // ==================================================
  // CANCEL RECORDING
  // ==================================================

  const cancelRecording = () => {
    try {
      cancelVoiceRecording();
    } catch (error) {
      console.warn(
        "Cancel recording error:",
        error?.message
      );
    }

    setRecording(false);
  };


  // ==================================================
  // PLAY VOICE MESSAGE
  // ==================================================

  const playVoice = async (
    message
  ) => {
    try {
      if (!message?.voiceUrl) {
        Alert.alert(
          "Audio unavailable",
          "Voice message file nahi mili."
        );

        return;
      }

      if (soundRef.current) {
        await soundRef.current
          .unloadAsync();

        soundRef.current = null;
      }

      if (
        playingId === message.id
      ) {
        setPlayingId(null);
        return;
      }

      const mediaUrl =
        getMediaUrl(
          message.voiceUrl
        );

      const { sound } =
        await Audio.Sound.createAsync(
          {
            uri: mediaUrl,
          },
          {
            shouldPlay: true,
          }
        );

      soundRef.current = sound;

      setPlayingId(message.id);

      sound.setOnPlaybackStatusUpdate(
        (status) => {
          if (
            status?.didJustFinish
          ) {
            setPlayingId(null);

            sound
              .unloadAsync()
              .catch(() => {});

            soundRef.current = null;
          }
        }
      );
    } catch (error) {
      console.error(
        "Play voice error:",
        error?.message
      );

      setPlayingId(null);

      Alert.alert(
        "Audio error",
        "Voice message play nahi ho paya."
      );
    }
  };


  // ==================================================
  // CALL
  // ==================================================

  const receiverName =
    receiverUser?.name ||
    userName ||
    "User";


  const handleCall = async (
    type
  ) => {
    if (!receiverId) {
      return;
    }

    if (callStatus !== "idle") {
      Alert.alert(
        "Call in progress",
        "A call is already active."
      );

      return;
    }

    try {
      await startCall(
        {
          id: receiverId,
          name: receiverName,
          profileImage:
            receiverUser?.profileImage,
        },
        type
      );
    } catch (error) {
      console.error(
        "Call start error:",
        error?.message
      );

      Alert.alert(
        "Call failed",
        "Unable to start the call."
      );
    }
  };


  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />

        <Text
          style={styles.loadingText}
        >
          Loading chat...
        </Text>
      </View>
    );
  }


  // ==================================================
  // UI
  // ==================================================

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : "height"
      }
      keyboardVerticalOffset={
        Platform.OS === "ios"
          ? 90
          : 0
      }
    >

      {/* =========================================
          HEADER
          ========================================= */}

      <SafeAreaView
        style={styles.safeHeader}
        edges={["top"]}
      >
        <View
          style={styles.chatHeader}
        >

          {/* BACK */}

          <TouchableOpacity
            onPress={() =>
              navigation.goBack()
            }
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <ArrowLeft
              size={23}
              color={
                colors.textPrimary
              }
            />
          </TouchableOpacity>


          {/* USER */}

          <TouchableOpacity
            style={styles.headerUser}
            onPress={() =>
              navigation.push(
                "UserProfile",
                {
                  userId: receiverId,
                }
              )
            }
            activeOpacity={0.7}
          >

            <View
              style={
                styles.headerAvatar
              }
            >
              {receiverUser?.profileImage ? (
                <Image
                  source={{
                    uri: getMediaUrl(
                      receiverUser.profileImage
                    ),
                  }}
                  style={
                    styles.headerAvatarImage
                  }
                />
              ) : (
                <Text
                  style={
                    styles.headerAvatarPlaceholder
                  }
                >
                  {receiverName
                    ?.charAt(0)
                    ?.toUpperCase() ||
                    "U"}
                </Text>
              )}
            </View>


            <View
              style={styles.headerInfo}
            >
              <Text
                numberOfLines={1}
                style={styles.headerName}
              >
                {receiverName}
              </Text>

              {receiverUser?.location ? (
                <Text
                  numberOfLines={1}
                  style={
                    styles.headerLocation
                  }
                >
                  {
                    receiverUser.location
                  }
                </Text>
              ) : (
                <Text
                  style={
                    styles.onlineText
                  }
                >
                  Chat
                </Text>
              )}
            </View>

          </TouchableOpacity>


          {/* CALL BUTTONS */}

          <View
            style={
              styles.headerActions
            }
          >

            {/* AUDIO */}

            <TouchableOpacity
              style={
                styles.callIconBtn
              }
              onPress={() =>
                handleCall("audio")
              }
              activeOpacity={0.7}
            >
              <Phone
                size={20}
                color={colors.accent}
              />
            </TouchableOpacity>


            {/* VIDEO */}

            <TouchableOpacity
              style={
                styles.callIconBtn
              }
              onPress={() =>
                handleCall("video")
              }
              activeOpacity={0.7}
            >
              <Video
                size={20}
                color={colors.accent}
              />
            </TouchableOpacity>

          </View>

        </View>
      </SafeAreaView>


      {/* =========================================
          MESSAGES
          ========================================= */}

      <FlatList
        ref={listRef}
        style={styles.messagesArea}

        contentContainerStyle={[
          styles.messagesContent,

          messages.length === 0 &&
            styles.emptyMessagesContent,
        ]}

        data={messages}

        keyExtractor={(
          item,
          index
        ) =>
          item?.id != null
            ? String(item.id)
            : `message-${index}`
        }

        keyboardShouldPersistTaps="handled"

        showsVerticalScrollIndicator={
          false
        }

        onContentSizeChange={() => {
          listRef.current?.scrollToEnd(
            {
              animated: false,
            }
          );
        }}

        ListEmptyComponent={
          <View
            style={
              styles.emptyContainer
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No messages yet
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Start the conversation
              {" "}
              with {receiverName}.
            </Text>
          </View>
        }

        renderItem={({ item }) => {

          const isMine =
            Number(item.senderId) ===
            Number(user?.userId);

          const isVoice =
            item.messageType !==
            "text";


          return (
            <View
              style={[
                styles.messageRow,

                isMine
                  ? styles.rowSent
                  : styles.rowReceived,
              ]}
            >

              <View
                style={[
                  styles.bubble,

                  isMine
                    ? styles.bubbleSent
                    : styles.bubbleReceived,
                ]}
              >

                {isVoice ? (

                  <TouchableOpacity
                    onPress={() =>
                      playVoice(item)
                    }
                    style={
                      styles.voiceRow
                    }
                    activeOpacity={0.7}
                  >

                    <View
                      style={[
                        styles.voiceIcon,

                        isMine &&
                          styles.voiceIconSent,
                      ]}
                    >
                      <Text
                        style={
                          styles.voiceIconText
                        }
                      >
                        {playingId ===
                        item.id
                          ? "Ⅱ"
                          : "▶"}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.voiceText,

                        isMine
                          ? styles.textSent
                          : styles.textReceived,
                      ]}
                    >
                      {playingId ===
                      item.id
                        ? "Playing..."
                        : "Voice message"}
                    </Text>

                  </TouchableOpacity>

                ) : (

                  <Text
                    style={
                      isMine
                        ? styles.textSent
                        : styles.textReceived
                    }
                  >
                    {item.message}
                  </Text>

                )}


                <Text
                  style={[
                    styles.messageTime,

                    isMine
                      ? styles.messageTimeSent
                      : styles.messageTimeReceived,
                  ]}
                >
                  {formatMessageTime(
                    item.createdAt
                  )}
                </Text>

              </View>

            </View>
          );
        }}
      />


      {/* =========================================
          MESSAGE INPUT
          ========================================= */}

      <View
        style={styles.inputArea}
      >

        <TextInput
          style={styles.textInput}

          placeholder={
            recording
              ? "Recording voice..."
              : "Type a message..."
          }

          placeholderTextColor={
            colors.textSecondary
          }

          value={newMessage}

          onChangeText={
            setNewMessage
          }

          editable={
            !sending &&
            !recording
          }

          multiline

          maxLength={2000}
        />


        {!recording ? (

          <>

            {/* MIC */}

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={
                handleStartRecording
              }
              disabled={sending}
              activeOpacity={0.7}
            >
              <Mic
                size={21}
                color={
                  sending
                    ? colors.textSecondary
                    : colors.accent
                }
              />
            </TouchableOpacity>


            {/* SEND */}

            <TouchableOpacity
              style={[
                styles.sendBtn,

                (!newMessage.trim() ||
                  sending) &&
                  styles.sendBtnDisabled,
              ]}
              onPress={
                handleSend
              }
              disabled={
                !newMessage.trim() ||
                sending
              }
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator
                  size="small"
                  color={colors.white}
                />
              ) : (
                <Send
                  size={18}
                  color={colors.white}
                />
              )}
            </TouchableOpacity>

          </>

        ) : (

          <>

            {/* CANCEL RECORDING */}

            <TouchableOpacity
              style={
                styles.cancelRecordBtn
              }
              onPress={
                cancelRecording
              }
              activeOpacity={0.7}
            >
              <Text
                style={
                  styles.cancelRecordText
                }
              >
                Cancel
              </Text>
            </TouchableOpacity>


            {/* STOP RECORDING */}

            <TouchableOpacity
              style={styles.stopBtn}
              onPress={
                handleStopRecording
              }
              disabled={sending}
              activeOpacity={0.8}
            >

              {sending ? (
                <ActivityIndicator
                  size="small"
                  color={colors.white}
                />
              ) : (
                <Square
                  size={15}
                  color={colors.white}
                />
              )}

              <Text
                style={styles.stopText}
              >
                {sending
                  ? "Sending"
                  : "Stop"}
              </Text>

            </TouchableOpacity>

          </>

        )}

      </View>

    </KeyboardAvoidingView>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({

  flex: {
    flex: 1,
    backgroundColor:
      colors.background,
  },


  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      colors.background,
  },


  loadingText: {
    marginTop: spacing.sm,
    color:
      colors.textSecondary,
    ...typography.caption,
  },


  // ==================================================
  // HEADER
  // ==================================================

  safeHeader: {
    backgroundColor:
      colors.background,

    // IMPORTANT:
    // Extra breathing room below
    // Android status bar.
    paddingTop: 8,
  },


  chatHeader: {
    minHeight: 68,

    width: "100%",

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 8,

    paddingVertical: 4,

    backgroundColor:
      colors.background,

    borderBottomWidth: 1,

    borderBottomColor:
      colors.border,
  },


  backBtn: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",
  },


  headerUser: {
    flex: 1,

    minWidth: 0,

    height: 56,

    flexDirection: "row",

    alignItems: "center",

    marginLeft: 4,
  },


  headerAvatar: {
    width: 40,
    height: 40,

    borderRadius: 20,

    overflow: "hidden",

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      colors.surface,
  },


  headerAvatarImage: {
    width: "100%",
    height: "100%",
  },


  headerAvatarPlaceholder: {
    fontSize: 16,

    fontWeight: "600",

    color:
      colors.textPrimary,
  },


  headerInfo: {
    flex: 1,

    minWidth: 0,

    marginLeft: 10,

    justifyContent:
      "center",
  },


  headerName: {
    fontSize: 15,

    fontWeight: "600",

    color:
      colors.textPrimary,
  },


  headerLocation: {
    marginTop: 2,

    fontSize: 11,

    color:
      colors.textSecondary,
  },


  onlineText: {
    marginTop: 2,

    fontSize: 11,

    color:
      colors.textSecondary,
  },


  headerActions: {
    flexDirection: "row",

    width: 88,

    alignItems: "center",

    justifyContent:
      "center",
  },


  callIconBtn: {
    width: 42,
    height: 42,

    alignItems: "center",

    justifyContent:
      "center",
  },


  // ==================================================
  // MESSAGES
  // ==================================================

  messagesArea: {
    flex: 1,

    backgroundColor:
      colors.background,
  },


  messagesContent: {
    paddingHorizontal:
      spacing.md,

    paddingTop:
      spacing.md,

    paddingBottom:
      spacing.lg,
  },


  emptyMessagesContent: {
    flexGrow: 1,

    justifyContent:
      "center",
  },


  emptyContainer: {
    alignItems: "center",

    paddingHorizontal:
      spacing.xl,
  },


  emptyTitle: {
    ...typography.h2,

    color:
      colors.textPrimary,

    marginBottom:
      spacing.xs,
  },


  emptyText: {
    ...typography.caption,

    color:
      colors.textSecondary,

    textAlign: "center",
  },


  messageRow: {
    width: "100%",

    marginBottom:
      spacing.sm,

    flexDirection:
      "row",
  },


  rowSent: {
    justifyContent:
      "flex-end",
  },


  rowReceived: {
    justifyContent:
      "flex-start",
  },


  bubble: {
    maxWidth: "82%",

    borderRadius:
      radii.lg,

    paddingHorizontal:
      spacing.md,

    paddingTop:
      spacing.sm,

    paddingBottom:
      spacing.xs,
  },


  bubbleSent: {
    backgroundColor:
      colors.accent,

    borderBottomRightRadius: 5,
  },


  bubbleReceived: {
    backgroundColor:
      colors.surface,

    borderBottomLeftRadius: 5,

    borderWidth: 1,

    borderColor:
      colors.border,
  },


  textSent: {
    color: colors.white,

    ...typography.body,
  },


  textReceived: {
    color:
      colors.textPrimary,

    ...typography.body,
  },


  messageTime: {
    fontSize: 10,

    marginTop: 4,

    alignSelf:
      "flex-end",
  },


  messageTimeSent: {
    color:
      "rgba(255,255,255,0.72)",
  },


  messageTimeReceived: {
    color:
      colors.textSecondary,
  },


  // ==================================================
  // VOICE MESSAGE
  // ==================================================

  voiceRow: {
    flexDirection: "row",

    alignItems: "center",

    minWidth: 145,
  },


  voiceIcon: {
    width: 32,
    height: 32,

    borderRadius: 16,

    backgroundColor:
      colors.border,

    alignItems: "center",

    justifyContent:
      "center",

    marginRight:
      spacing.sm,
  },


  voiceIconSent: {
    backgroundColor:
      "rgba(255,255,255,0.2)",
  },


  voiceIconText: {
    color: colors.white,

    fontSize: 14,

    fontWeight: "700",
  },


  voiceText: {
    flex: 1,

    fontWeight: "600",
  },


  // ==================================================
  // INPUT
  // ==================================================

  inputArea: {
    flexDirection: "row",

    alignItems: "flex-end",

    paddingHorizontal:
      spacing.sm,

    paddingVertical:
      spacing.sm,

    backgroundColor:
      colors.background,

    borderTopWidth: 1,

    borderTopColor:
      colors.border,

    gap: spacing.xs,
  },


  textInput: {
    flex: 1,

    maxHeight: 110,

    minHeight: 44,

    borderWidth: 1,

    borderColor:
      colors.border,

    borderRadius: 22,

    paddingHorizontal:
      spacing.md,

    paddingVertical: 10,

    ...typography.body,

    color:
      colors.textPrimary,

    backgroundColor:
      colors.surface,
  },


  iconBtn: {
    width: 44,
    height: 44,

    borderRadius: 22,

    alignItems: "center",

    justifyContent:
      "center",

    backgroundColor:
      colors.surface,
  },


  sendBtn: {
    width: 44,
    height: 44,

    borderRadius: 22,

    alignItems: "center",

    justifyContent:
      "center",

    backgroundColor:
      colors.accent,
  },


  sendBtnDisabled: {
    opacity: 0.45,
  },


  cancelRecordBtn: {
    height: 44,

    paddingHorizontal:
      spacing.md,

    alignItems: "center",

    justifyContent:
      "center",
  },


  cancelRecordText: {
    color:
      colors.textSecondary,

    fontWeight: "600",
  },


  stopBtn: {
    height: 44,

    flexDirection: "row",

    alignItems: "center",

    justifyContent:
      "center",

    gap: 6,

    backgroundColor:
      colors.danger,

    borderRadius: 22,

    paddingHorizontal:
      spacing.md,
  },


  stopText: {
    color: colors.white,

    fontWeight: "700",
  },

});