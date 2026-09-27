import React, { useCallback, useRef, useState } from "react";
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet, BackHandler, ToastAndroid, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { postAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PostCard from "../../components/PostCard";
import { colors, spacing, typography } from "../../theme/theme";

const PAGE_SIZE = 10;

// Direct port of web's Feed.jsx pagination logic (GET /posts/feed,
// dedupe-append pattern, hasMore/loading refs to avoid stale closures)
// replacing window scroll-position infinite scroll with FlatList's
// onEndReached, and browser reload-on-tab-click with useFocusEffect
// (fires every time the Feed tab regains focus, same trigger as web's
// `location.key` changing).
export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const stateRef = useRef({ loading: false, hasMore: true, page: 0 });

  const loadPosts = useCallback(async (reset = false) => {
    if (stateRef.current.loading) return;
    if (!reset && !stateRef.current.hasMore) return;

    const currentPage = reset ? 0 : stateRef.current.page;
    stateRef.current.loading = true;
    setLoading(true);

    try {
      const response = await postAPI.getFeed(currentPage, PAGE_SIZE);
      const newPosts = response.data.content || [];

      if (newPosts.length === 0) {
        stateRef.current.hasMore = false;
        setHasMore(false);
      } else {
        setPosts((prev) => {
          if (reset) return newPosts;
          const existingIds = new Set(prev.map((p) => p.id));
          return [...prev, ...newPosts.filter((p) => !existingIds.has(p.id))];
        });
        stateRef.current.page = currentPage + 1;
        stateRef.current.hasMore = true;
        setHasMore(true);
      }
    } catch (err) {
      console.warn("Failed to load feed:", err.message);
    } finally {
      stateRef.current.loading = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      stateRef.current = { loading: false, hasMore: true, page: 0 };
      loadPosts(true);
    }, [loadPosts])
  );

  // Feed is the tab-bar "home base" - a bare hardware back press here
  // would otherwise exit the app immediately with no confirmation. This
  // is the standard Android "press back again to exit" pattern, one of
  // the explicit back-button behaviors called for in this phase.
  const lastBackPressRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPressRef.current = now;
        if (Platform.OS === "android") {
          ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        }
        return true;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    stateRef.current = { loading: false, hasMore: true, page: 0 };
    loadPosts(true);
  };

  const handlePostDeleted = async (postId) => {
    await postAPI.deletePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUser={user}
            showDelete
            onPostDeleted={handlePostDeleted}
            onOpenProfile={(userId) => navigation.navigate("UserProfile", { userId })}
            onOpenChat={(userId, userName) => navigation.navigate("Chat", { receiverId: userId, userName })}
          />
        )}
        onEndReached={() => loadPosts(false)}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        contentContainerStyle={posts.length === 0 && !loading ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to share your cloth product!</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading && !refreshing ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.endMessage}>You've seen all posts! 🎉</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  listContent: { paddingVertical: spacing.md },
  emptyContent: { flexGrow: 1, justifyContent: "center" },
  emptyState: { alignItems: "center", padding: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  footer: { paddingVertical: spacing.lg },
  endMessage: { textAlign: "center", color: colors.textSecondary, paddingVertical: spacing.lg, ...typography.caption },
});
