import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { messageAPI, getMediaUrl } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatChatTime } from "../../utils/messageTime";
import { colors, spacing, radii, typography } from "../../theme/theme";

// Direct port of web's Messages.jsx: GET /messages/inbox/:userId, a
// 5-second poll for last-message/unread refresh ("WhatsApp jaisa feel",
// per the backend comment), same empty state, same "You: " prefix logic.
// The poll interval is intentionally kept for Phase 5 - Phase 6 adds a
// STOMP subscription on top without removing this, matching the web
// app's own belt-and-suspenders approach (STOMP push + slow poll safety
// net) once it exists here too.
export default function MessagesScreen({ navigation }) {
  const { user } = useAuth();
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const loadInbox = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const response = await messageAPI.getInbox(user.userId);
      setInbox(response.data);
    } catch (err) {
      console.warn("Failed to load inbox:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.userId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadInbox();
  };

  useFocusEffect(
    useCallback(() => {
      loadInbox();
      intervalRef.current = setInterval(loadInbox, 5000);
      return () => clearInterval(intervalRef.current);
    }, [loadInbox])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={inbox}
      keyExtractor={(item) => String(item.user.id)}
      contentContainerStyle={inbox.length === 0 ? styles.emptyContent : styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>Start chatting by tapping "Connect" on any post!</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.chatItem, item.unreadCount > 0 && styles.chatItemUnread]}
          onPress={() => navigation.navigate("Chat", { receiverId: item.user.id, userName: item.user.name })}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {item.user.profileImage ? (
              <Image source={{ uri: getMediaUrl(item.user.profileImage) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarPlaceholder}>{item.user.name?.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.chatInfo}>
            <View style={styles.chatInfoTop}>
              <Text style={styles.chatName} numberOfLines={1}>{item.user.name}</Text>
              <Text style={styles.chatTime}>{formatChatTime(item.lastMessageTime)}</Text>
            </View>
            <View style={styles.chatInfoBottom}>
              <Text style={styles.chatLastMessage} numberOfLines={1}>
                {item.lastMessageMine ? "You: " : ""}
                {item.lastMessageType === "voice" ? "🎤 Voice message" : item.lastMessage}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  listContent: { paddingVertical: spacing.sm },
  emptyContent: { flexGrow: 1, justifyContent: "center" },
  emptyState: { alignItems: "center", padding: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  chatItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chatItemUnread: { backgroundColor: colors.surface },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: spacing.sm,
  },
  avatarImage: { width: 52, height: 52 },
  avatarPlaceholder: { ...typography.h2, color: colors.textSecondary },
  chatInfo: { flex: 1 },
  chatInfoTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatName: { ...typography.body, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  chatTime: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.sm },
  chatInfoBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  chatLastMessage: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  unreadBadge: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  unreadBadgeText: { color: colors.white, fontSize: 12, fontWeight: "700" },
});
