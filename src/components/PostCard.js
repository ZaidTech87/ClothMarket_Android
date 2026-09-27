import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { MapPin, Trash2, X } from "lucide-react-native";
import { getMediaUrl } from "../services/api";
import { getTimeAgo, getFullDate } from "../utils/timeAgo";
import { colors, spacing, radii, typography } from "../theme/theme";

const MAX_LENGTH = 120;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Direct port of web's PostCard.jsx. Same props contract
// (post, onPostDeleted, showDelete) and same ownership check
// (currentUser.userId === post.userId) gating the delete button and
// swapping out the "Connect" button on your own posts.
export default function PostCard({ post, onPostDeleted, showDelete = false, currentUser, onOpenProfile, onOpenChat }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const userName = post.userName || "Unknown";
  const userLocation = post.userLocation || "";
  const userProfileImage = post.userProfileImage || null;
  const userId = post.userId;

  const description = post.description || "";
  const isLong = description.length > MAX_LENGTH;
  const displayText = expanded ? description : description.slice(0, MAX_LENGTH);

  const isOwnPost = Number(currentUser?.userId) === Number(userId);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Actual DELETE /posts/:id call lives in the caller (FeedScreen/
      // ProfileScreen) via onPostDeleted, mirroring how web's PostCard
      // calls postAPI.deletePost itself then notifies the parent - kept
      // here instead so this component stays reusable without importing
      // postAPI just for this. (See FeedScreen's onPostDeleted handler.)
      await onPostDeleted?.(post.id);
      setConfirmVisible(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={() => onOpenProfile?.(userId)} activeOpacity={0.7}>
          <View style={styles.avatar}>
            {userProfileImage ? (
              <Image source={{ uri: getMediaUrl(userProfileImage) }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarPlaceholder}>{userName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View>
            <Text style={styles.username}>{userName}</Text>
            <View style={styles.metaRow}>
              {userLocation ? (
                <>
                  <MapPin size={10} color={colors.textSecondary} />
                  <Text style={styles.metaText}> {userLocation} • </Text>
                </>
              ) : null}
              <Text style={styles.metaText}>{getTimeAgo(post.createdAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {showDelete && isOwnPost && (
          <TouchableOpacity onPress={() => setConfirmVisible(true)} disabled={deleting} style={styles.deleteBtn}>
            <Trash2 size={18} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {description ? (
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>
            {displayText}
            {isLong && !expanded ? "... " : ""}
            {isLong && (
              <Text style={styles.seeMore} onPress={() => setExpanded((v) => !v)}>
                {expanded ? "See less" : "See more"}
              </Text>
            )}
          </Text>
        </View>
      ) : null}

      {post.mediaUrl ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewVisible(true)}>
          {post.mediaType === "video" ? (
            <Video
              source={{ uri: getMediaUrl(post.mediaUrl) }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              useNativeControls
            />
          ) : (
            <Image source={{ uri: getMediaUrl(post.mediaUrl) }} style={styles.media} resizeMode="cover" />
          )}
        </TouchableOpacity>
      ) : null}

      <View style={styles.productInfo}>
        {post.clothType ? <Text style={styles.productText}>Type: <Text style={styles.bold}>{post.clothType}</Text></Text> : null}
        {post.price != null ? <Text style={styles.productText}>Price: <Text style={styles.bold}>₹{post.price}</Text></Text> : null}
        {post.quantity != null ? <Text style={styles.productText}>Qty: <Text style={styles.bold}>{post.quantity} units</Text></Text> : null}
      </View>

      {(!showDelete || !isOwnPost) && (
        <TouchableOpacity style={styles.connectBtn} onPress={() => onOpenChat?.(userId, userName)} activeOpacity={0.85}>
          <Text style={styles.connectText}>Connect</Text>
        </TouchableOpacity>
      )}

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Post</Text>
            <Text style={styles.modalBody}>Are you sure you want to delete this post?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleDelete} disabled={deleting}>
                <Text style={styles.confirmText}>{deleting ? "Deleting..." : "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewVisible(false)}>
            <X size={26} color={colors.white} />
          </TouchableOpacity>
          {post.mediaType === "video" ? (
            <Video
              source={{ uri: getMediaUrl(post.mediaUrl) }}
              style={styles.previewMedia}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
            />
          ) : (
            <Image source={{ uri: getMediaUrl(post.mediaUrl) }} style={styles.previewMedia} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  userInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    overflow: "hidden",
  },
  avatarImage: { width: 42, height: 42 },
  avatarPlaceholder: { ...typography.body, fontWeight: "700", color: colors.textSecondary },
  username: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  metaText: { ...typography.caption, color: colors.textSecondary },
  deleteBtn: { padding: spacing.xs },
  descriptionBox: { marginTop: spacing.sm },
  descriptionText: { ...typography.body, color: colors.textPrimary },
  seeMore: { color: colors.accent, fontWeight: "600" },
  media: {
    width: "100%",
    height: SCREEN_WIDTH * 0.85,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  productInfo: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  productText: { ...typography.caption, color: colors.textSecondary },
  bold: { fontWeight: "700", color: colors.textPrimary },
  connectBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  connectText: { color: colors.white, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  modalCard: { backgroundColor: colors.background, borderRadius: radii.md, padding: spacing.lg, width: "80%" },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  modalBody: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelText: { color: colors.textSecondary, fontWeight: "600" },
  confirmBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.danger, borderRadius: radii.sm },
  confirmText: { color: colors.white, fontWeight: "700" },
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  previewMedia: { width: "100%", height: "80%" },
  closePreview: { position: "absolute", top: 48, right: 20, zIndex: 1 },
});
