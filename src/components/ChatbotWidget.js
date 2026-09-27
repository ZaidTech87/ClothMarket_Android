import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native";
import { MessageCircle, X, Send } from "lucide-react-native";
import { chatbotAPI } from "../services/api";
import { colors, spacing, radii, typography } from "../theme/theme";

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Namaste! Main aapki website use karne ya textile se related kisi bhi sawal me madad kar sakta hoon. Kya poochna chahenge?",
};

const BUTTON_SIZE = 56;
const RIGHT_OFFSET = 20;
const BOTTOM_OFFSET = 24;

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);

  // --------------------------------------------------
  // DRAGGABLE CHATBOT BUTTON
  // --------------------------------------------------

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const panResponder = useRef(
    PanResponder.create({
      // Touch ko chatbot button handle karega
      onStartShouldSetPanResponder: () => true,

      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 5 ||
          Math.abs(gestureState.dy) > 5
        );
      },

      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x.__getValue(),
          y: pan.y.__getValue(),
        });

        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: (_, gestureState) => {
        const { width, height } = Dimensions.get("window");

        const initialX = width - RIGHT_OFFSET - BUTTON_SIZE;
        const initialY = height - BOTTOM_OFFSET - BUTTON_SIZE;

        // Screen ke bahar jaane se rokna
        const minX = -initialX;
        const maxX = RIGHT_OFFSET;

        const minY = -initialY;
        const maxY = BOTTOM_OFFSET;

        const currentX = gestureState.dx;
        const currentY = gestureState.dy;

        const clampedX = Math.max(
          minX,
          Math.min(currentX, maxX)
        );

        const clampedY = Math.max(
          minY,
          Math.min(currentY, maxY)
        );

        pan.setValue({
          x: clampedX,
          y: clampedY,
        });
      },

      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        // Agar sirf tap kiya hai, chatbot open hoga.
        // Agar drag kiya hai, sirf position change hogi.
        const moved =
          Math.abs(gestureState.dx) > 8 ||
          Math.abs(gestureState.dy) > 8;

        if (!moved) {
          setIsOpen(true);
        }
      },

      onPanResponderTerminate: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  // --------------------------------------------------
  // SEND CHAT MESSAGE
  // --------------------------------------------------

  const handleSend = async () => {
    const trimmed = input.trim();

    if (!trimmed || loading) return;

    const userMessage = {
      role: "user",
      content: trimmed,
    };

    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const history = updatedMessages
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await chatbotAPI.ask(
        trimmed,
        history.slice(0, -1)
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.reply,
        },
      ]);
    } catch (err) {
      console.log("Chatbot error:", err);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, abhi jawab nahi de pa raha. Thodi der baad try karein.",
        },
      ]);
    } finally {
      setLoading(false);

      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({
          animated: true,
        })
      );
    }
  };

  // --------------------------------------------------
  // FLOATING BUTTON
  // --------------------------------------------------

  if (!isOpen) {
    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.floatingBtn,
          {
            transform: pan.getTranslateTransform(),
          },
        ]}
      >
        <MessageCircle
          size={24}
          color={colors.white}
        />
      </Animated.View>
    );
  }

  // --------------------------------------------------
  // CHAT WINDOW
  // --------------------------------------------------

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setIsOpen(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalWrap}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View style={styles.panel}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Assistant
            </Text>

            <TouchableOpacity
              onPress={() => setIsOpen(false)}
            >
              <X
                size={20}
                color={colors.white}
              />
            </TouchableOpacity>
          </View>

          {/* MESSAGES */}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({
                animated: true,
              })
            }
          >
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.bubble,
                  msg.role === "user"
                    ? styles.bubbleUser
                    : styles.bubbleBot,
                ]}
              >
                <Text
                  style={
                    msg.role === "user"
                      ? styles.textUser
                      : styles.textBot
                  }
                >
                  {msg.content}
                </Text>
              </View>
            ))}

            {loading ? (
              <View
                style={[
                  styles.bubble,
                  styles.bubbleBot,
                ]}
              >
                <Text style={styles.textBot}>
                  Typing...
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* INPUT */}
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Apna sawal likhein..."
              placeholderTextColor={
                colors.textSecondary
              }
              editable={!loading}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || loading) &&
                  styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={
                !input.trim() || loading
              }
            >
              <Send
                size={18}
                color={colors.white}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  floatingBtn: {
    position: "absolute",

    bottom: BOTTOM_OFFSET,
    right: RIGHT_OFFSET,

    width: BUTTON_SIZE,
    height: BUTTON_SIZE,

    borderRadius: BUTTON_SIZE / 2,

    backgroundColor: colors.accent,

    alignItems: "center",
    justifyContent: "center",

    elevation: 6,

    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    zIndex: 9999,
  },

  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },

  panel: {
    height: "70%",
    backgroundColor: colors.background,

    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,

    overflow: "hidden",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    backgroundColor: colors.accent,

    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  headerTitle: {
    color: colors.white,
    fontWeight: "700",
    ...typography.body,
  },

  messages: {
    flex: 1,
    padding: spacing.md,
  },

  bubble: {
    maxWidth: "80%",

    borderRadius: radii.md,

    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,

    marginBottom: spacing.sm,
  },

  bubbleUser: {
    backgroundColor: colors.accent,
    alignSelf: "flex-end",
  },

  bubbleBot: {
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
  },

  textUser: {
    color: colors.white,
    ...typography.body,
  },

  textBot: {
    color: colors.textPrimary,
    ...typography.body,
  },

  inputArea: {
    flexDirection: "row",
    alignItems: "center",

    padding: spacing.sm,

    borderTopWidth: 1,
    borderTopColor: colors.border,

    gap: spacing.xs,
  },

  input: {
    flex: 1,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: radii.pill,

    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,

    ...typography.body,

    color: colors.textPrimary,

    backgroundColor: colors.surface,
  },

  sendBtn: {
    backgroundColor: colors.accent,

    borderRadius: radii.pill,

    padding: spacing.sm,
  },

  sendBtnDisabled: {
    opacity: 0.5,
  },
});