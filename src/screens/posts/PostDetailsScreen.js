import React, { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { postAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PostCard from "../../components/PostCard";
import { colors, spacing, typography } from "../../theme/theme";

// The web app doesn't have a dedicated single-post page (PostCard only
// ever renders inline in Feed/Profile), but the brief calls for a "Post
// Details" screen and MainNavigator already routes to it - this fetches
// GET /posts/:postId and renders the same PostCard used everywhere else,
// so behavior (delete, connect, media preview) stays identical.
export default function PostDetailsScreen({ route, navigation }) {
  const { postId } = route.params || {};
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await postAPI.getPost(postId);
      setPost(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "This post could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id) => {
    await postAPI.deletePost(id);
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || "Post not found."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PostCard
        post={post}
        currentUser={user}
        showDelete
        onPostDeleted={handleDelete}
        onOpenProfile={(userId) => navigation.navigate("UserProfile", { userId })}
        onOpenChat={(userId, userName) => navigation.navigate("Chat", { receiverId: userId, userName })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.lg },
  errorText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
});
