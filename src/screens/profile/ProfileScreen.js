import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { MapPin, Phone, Camera, Search as SearchIcon, X, LogOut } from "lucide-react-native";
import { userAPI, postAPI, getMediaUrl } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PostCard from "../../components/PostCard";
import { colors, spacing, radii, typography } from "../../theme/theme";

// Ports two web pieces into one screen: Profile.jsx (avatar, user info,
// posts grid, own-profile detection) and the user-search portion of
// Header.jsx (debounced GET /users/search with a suggestion dropdown).
// Web put search in the persistent top header since it's reachable from
// every page; there's no equivalent persistent chrome on a bottom-tab
// layout, so it lives here, on the Profile tab, alongside the other
// "about me / find people" actions.
export default function ProfileScreen({ route, navigation }) {
  const { user: currentUser, updateUser, logout } = useAuth();
  const targetUserId = route.params?.userId ?? currentUser?.userId;
  const isOwnProfile = Number(currentUser?.userId) === Number(targetUserId);

  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, postsRes] = await Promise.all([
        userAPI.getUser(targetUserId),
        postAPI.getUserPosts(targetUserId),
      ]);
      setProfileUser(userRes.data);
      setPosts(postsRes.data);
    } catch (err) {
      console.warn("Failed to load profile:", err.message);
      setProfileUser(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // Same 350ms debounce as web's Header.jsx search effect.
  useEffect(() => {
    if (!isOwnProfile) return;
    const query = searchQuery.trim();
    if (query.length === 0) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await userAPI.searchUsers(query);
        setSuggestions(res.data || []);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, isOwnProfile]);

  const handlePostDeleted = async (postId) => {
    await postAPI.deletePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleAvatarPress = async () => {
    if (!isOwnProfile || uploadingImage) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploadingImage(true);
    try {
      const fileAsset = {
        uri: asset.uri,
        name: asset.fileName || "profile.jpg",
        type: asset.mimeType || "image/jpeg",
      };
      const response = await userAPI.updateProfileImage(targetUserId, fileAsset);
      setProfileUser(response.data);
      await updateUser({ profileImage: response.data.profileImage });
    } catch (err) {
      Alert.alert("Upload failed", "Failed to upload profile picture. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSelectUser = (selectedUser) => {
    setSearchQuery("");
    setSuggestions([]);
    navigation.push("UserProfile", { userId: selectedUser.id });
  };

  const confirmLogout = () => {
    setLogoutConfirmVisible(false);
    logout();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  const avatarSrc = profileUser.profileImage ? getMediaUrl(profileUser.profileImage) : null;

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          currentUser={currentUser}
          showDelete={isOwnProfile}
          onPostDeleted={handlePostDeleted}
          onOpenProfile={(userId) => navigation.push("UserProfile", { userId })}
          onOpenChat={(userId, userName) => navigation.navigate("Chat", { receiverId: userId, userName })}
        />
      )}
      ListHeaderComponent={
        <View>
          {isOwnProfile && (
            <View style={styles.searchBox}>
              <SearchIcon size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by name..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {isOwnProfile && searchQuery.trim().length > 0 && (
            <View style={styles.suggestionsBox}>
              {searching && <Text style={styles.suggestionEmpty}>Searching...</Text>}
              {!searching && suggestions.length === 0 && (
                <Text style={styles.suggestionEmpty}>No users found</Text>
              )}
              {!searching &&
                suggestions.map((s) => (
                  <TouchableOpacity key={s.id} style={styles.suggestionItem} onPress={() => handleSelectUser(s)}>
                    <View style={styles.suggestionAvatar}>
                      {s.profileImage ? (
                        <Image source={{ uri: getMediaUrl(s.profileImage) }} style={styles.suggestionAvatarImg} />
                      ) : (
                        <Text style={styles.suggestionAvatarPlaceholder}>{s.name?.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.suggestionName}>{s.name}</Text>
                      <Text style={styles.suggestionLocation}>{s.location}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          <View style={styles.profileHeader}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleAvatarPress}
              activeOpacity={isOwnProfile ? 0.7 : 1}
            >
              {avatarSrc ? (
                <Image source={{ uri: avatarSrc }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarPlaceholder}>{profileUser.name?.charAt(0).toUpperCase()}</Text>
              )}
              {isOwnProfile && (
                <View style={styles.avatarOverlay}>
                  {uploadingImage ? <ActivityIndicator size="small" color={colors.white} /> : <Camera size={16} color={colors.white} />}
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.profileName}>{profileUser.name}</Text>
            <View style={styles.metaRow}>
              {profileUser.location ? (
                <View style={styles.metaItem}>
                  <MapPin size={13} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{profileUser.location}</Text>
                </View>
              ) : null}
              {isOwnProfile && profileUser.mobile ? (
                <View style={styles.metaItem}>
                  <Phone size={13} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{profileUser.mobile}</Text>
                </View>
              ) : null}
            </View>

            {isOwnProfile && (
              <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutConfirmVisible(true)}>
                <LogOut size={16} color={colors.danger} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>
            {isOwnProfile ? "My Posts" : "Posts"} ({posts.length})
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyPosts}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptySubtitle}>
            {isOwnProfile ? "Start sharing your cloth products!" : "This user hasn't posted anything yet."}
          </Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
    >
      <Modal visible={logoutConfirmVisible} transparent animationType="fade" onRequestClose={() => setLogoutConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log out?</Text>
            <Text style={styles.modalBody}>Are you sure you want to log out of your account?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogoutConfirmVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmLogout}>
                <Text style={styles.confirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </FlatList>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  listContent: { paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  errorText: { ...typography.body, color: colors.textSecondary },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: spacing.sm, marginLeft: spacing.xs, ...typography.body, color: colors.textPrimary },
  suggestionsBox: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  suggestionEmpty: { padding: spacing.md, color: colors.textSecondary, ...typography.caption },
  suggestionItem: { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.sm },
  suggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  suggestionAvatarImg: { width: 32, height: 32 },
  suggestionAvatarPlaceholder: { fontWeight: "700", color: colors.textSecondary },
  suggestionName: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  suggestionLocation: { ...typography.caption, color: colors.textSecondary },
  profileHeader: { alignItems: "center", padding: spacing.lg },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  avatarImage: { width: 96, height: 96 },
  avatarPlaceholder: { fontSize: 36, fontWeight: "700", color: colors.textSecondary },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    paddingVertical: 4,
  },
  profileName: { ...typography.h2, color: colors.textPrimary },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { ...typography.caption, color: colors.textSecondary },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.md, padding: spacing.sm },
  logoutText: { color: colors.danger, fontWeight: "700" },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  emptyPosts: { alignItems: "center", padding: spacing.xl },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  emptyTitle: { ...typography.h2, color: colors.textPrimary },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  modalCard: { backgroundColor: colors.background, borderRadius: radii.md, padding: spacing.lg, width: "80%" },
  modalTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  modalBody: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelText: { color: colors.textSecondary, fontWeight: "600" },
  confirmBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.danger, borderRadius: radii.sm },
  confirmText: { color: colors.white, fontWeight: "700" },
});
