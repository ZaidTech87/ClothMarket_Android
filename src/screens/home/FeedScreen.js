import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  BackHandler,
  ToastAndroid,
  Platform,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";

import { postAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PostCard from "../../components/PostCard";
import UserSearchBar from "../../components/UserSearchBar";

import {
  colors,
  spacing,
  typography,
} from "../../theme/theme";

const PAGE_SIZE = 10;

export default function FeedScreen({ navigation }) {
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Keeps pagination/loading state safe from stale closures.
  const stateRef = useRef({
    loading: false,
    hasMore: true,
    page: 0,
  });

  // Reference to the FlatList so we can move it to the top
  // whenever Feed is explicitly pressed.
  const listRef = useRef(null);

  // ===================================================
  // LOAD POSTS
  // ===================================================

  const loadPosts = useCallback(
    async (reset = false) => {
      // Prevent duplicate requests.
      if (stateRef.current.loading) {
        return;
      }

      // Don't request more pages once the end is reached.
      if (
        !reset &&
        !stateRef.current.hasMore
      ) {
        return;
      }

      const currentPage = reset
        ? 0
        : stateRef.current.page;

      stateRef.current.loading = true;

      setLoading(true);

      try {
        const response =
          await postAPI.getFeed(
            currentPage,
            PAGE_SIZE
          );

        const newPosts =
          Array.isArray(response.data?.content)
            ? response.data.content
            : [];

        // =============================================
        // RESET FEED
        // =============================================

        if (reset) {
          setPosts(newPosts);

          stateRef.current.page =
            1;

          stateRef.current.hasMore =
            newPosts.length >= PAGE_SIZE;

          setHasMore(
            newPosts.length >= PAGE_SIZE
          );

          return;
        }

        // =============================================
        // PAGINATION
        // =============================================

        if (newPosts.length === 0) {
          stateRef.current.hasMore =
            false;

          setHasMore(false);

          return;
        }

        setPosts((prev) => {
          const existingIds =
            new Set(
              prev.map(
                (post) => post.id
              )
            );

          const uniquePosts =
            newPosts.filter(
              (post) =>
                !existingIds.has(
                  post.id
                )
            );

          return [
            ...prev,
            ...uniquePosts,
          ];
        });

        stateRef.current.page =
          currentPage + 1;

        stateRef.current.hasMore =
          newPosts.length >= PAGE_SIZE;

        setHasMore(
          newPosts.length >= PAGE_SIZE
        );
      } catch (err) {
        console.warn(
          "Failed to load feed:",
          err?.message || err
        );
      } finally {
        stateRef.current.loading =
          false;

        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // ===================================================
  // REFRESH FEED
  // ===================================================

  const refreshFeed = useCallback(() => {
    console.log(
      "🔄 Refreshing feed..."
    );

    // Reset pagination.
    stateRef.current = {
      loading: false,
      hasMore: true,
      page: 0,
    };

    // Scroll to top.
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      });
    });

    setRefreshing(true);

    // Fetch page 0 again.
    loadPosts(true);
  }, [loadPosts]);

  // ===================================================
  // REFRESH WHEN FEED GETS FOCUS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      refreshFeed();

      return undefined;
    }, [refreshFeed])
  );

  // ===================================================
  // REFRESH WHEN FEED TAB IS PRESSED AGAIN
  // ===================================================

  useEffect(() => {
    const unsubscribe =
      navigation.addListener(
        "tabPress",
        () => {
          /*
           * When Feed is already the active tab,
           * tabPress does not cause another focus event.
           *
           * Therefore explicitly refresh here.
           *
           * When coming from another tab, the normal
           * useFocusEffect above handles the refresh.
           */
          if (navigation.isFocused()) {
            refreshFeed();
          }
        }
      );

    return unsubscribe;
  }, [
    navigation,
    refreshFeed,
  ]);

  // ===================================================
  // ANDROID BACK BUTTON
  // ===================================================

  const lastBackPressRef =
    useRef(0);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        const now =
          Date.now();

        if (
          now -
            lastBackPressRef.current <
          2000
        ) {
          BackHandler.exitApp();
          return true;
        }

        lastBackPressRef.current =
          now;

        if (
          Platform.OS ===
          "android"
        ) {
          ToastAndroid.show(
            "Press back again to exit",
            ToastAndroid.SHORT
          );
        }

        return true;
      };

      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

      return () =>
        subscription.remove();
    }, [])
  );

  // ===================================================
  // PULL TO REFRESH
  // ===================================================

  const handleRefresh =
    () => {
      refreshFeed();
    };

  // ===================================================
  // DELETE POST
  // ===================================================

  const handlePostDeleted =
    async (postId) => {
      try {
        await postAPI.deletePost(
          postId
        );

        setPosts((prev) =>
          prev.filter(
            (post) =>
              post.id !== postId
          )
        );
      } catch (error) {
        console.warn(
          "Failed to delete post:",
          error?.message || error
        );
      }
    };

  // ===================================================
  // SEARCH RESULT
  // ===================================================

  const handleSelectUser =
    (selectedUser) => {
      const selectedId =
        selectedUser.id ??
        selectedUser.userId;

      if (
        selectedId == null
      ) {
        return;
      }

      navigation.navigate(
        "UserProfile",
        {
          userId:
            selectedId,
        }
      );
    };

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <View
      style={
        styles.container
      }
    >
      <UserSearchBar
        onSelectUser={
          handleSelectUser
        }
      >
        <FlatList
          ref={listRef}

          data={posts}

          keyExtractor={(item) =>
            String(item.id)
          }

          renderItem={({
            item,
          }) => (
            <PostCard
              post={item}
              currentUser={
                user
              }
              showDelete
              onPostDeleted={
                handlePostDeleted
              }
              onOpenProfile={(
                userId
              ) =>
                navigation.navigate(
                  "UserProfile",
                  {
                    userId,
                  }
                )
              }
              onOpenChat={(
                userId,
                userName
              ) =>
                navigation.navigate(
                  "Chat",
                  {
                    receiverId:
                      userId,
                    userName,
                  }
                )
              }
            />
          )}

          // Infinite pagination
          onEndReached={() =>
            loadPosts(false)
          }

          onEndReachedThreshold={
            0.4
          }

          // Pull down to refresh
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                handleRefresh
              }
              tintColor={
                colors.accent
              }
            />
          }

          contentContainerStyle={
            posts.length === 0 &&
            !loading
              ? styles.emptyContent
              : styles.listContent
          }

          // Empty state
          ListEmptyComponent={
            !loading ? (
              <View
                style={
                  styles.emptyState
                }
              >
                <Text
                  style={
                    styles.emptyIcon
                  }
                >
                  📭
                </Text>

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No posts yet
                </Text>

                <Text
                  style={
                    styles.emptySubtitle
                  }
                >
                  Be the first to
                  share your cloth
                  product!
                </Text>
              </View>
            ) : null
          }

          // Bottom loading / end message
          ListFooterComponent={
            loading &&
            !refreshing ? (
              <View
                style={
                  styles.footer
                }
              >
                <ActivityIndicator
                  color={
                    colors.accent
                  }
                />
              </View>
            ) : !hasMore &&
              posts.length > 0 ? (
              <Text
                style={
                  styles.endMessage
                }
              >
                You've seen all
                posts! 🎉
              </Text>
            ) : null
          }
        />
      </UserSearchBar>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        colors.surface,
    },

    listContent: {
      paddingVertical:
        spacing.md,
    },

    emptyContent: {
      flexGrow: 1,
      justifyContent:
        "center",
    },

    emptyState: {
      alignItems: "center",
      padding:
        spacing.xl,
    },

    emptyIcon: {
      fontSize: 40,
      marginBottom:
        spacing.sm,
    },

    emptyTitle: {
      ...typography.h2,
      color:
        colors.textPrimary,
      marginBottom:
        spacing.xs,
    },

    emptySubtitle: {
      ...typography.body,
      color:
        colors.textSecondary,
      textAlign:
        "center",
    },

    footer: {
      paddingVertical:
        spacing.lg,
    },

    endMessage: {
      textAlign:
        "center",
      color:
        colors.textSecondary,
      paddingVertical:
        spacing.lg,
      ...typography.caption,
    },
  });