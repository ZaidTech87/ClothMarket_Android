import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  BackHandler,
} from "react-native";

import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Search as SearchIcon,
  X,
  MapPin,
} from "lucide-react-native";

import { userAPI, getMediaUrl } from "../services/api";
import {
  colors,
  spacing,
  radii,
  typography,
} from "../theme/theme";

const DEBOUNCE_MS = 400;

export default function UserSearchBar({
  onSelectUser,
  children,
}) {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lastSearched, setLastSearched] = useState(null);

  const requestIdRef = useRef(0);

  const trimmed = query.trim();
  const active = trimmed.length > 0;

  // --------------------------------------------------
  // DEBOUNCED USER SEARCH
  // --------------------------------------------------

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(false);
      setLastSearched(null);
      return;
    }

    setLoading(true);
    setError(false);

    const timer = setTimeout(async () => {
      try {
        const response = await userAPI.searchUsers(trimmed);

        // Ignore old/stale responses
        if (requestId !== requestIdRef.current) {
          return;
        }

        setResults(
          Array.isArray(response.data)
            ? response.data
            : []
        );

        setError(false);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.warn(
          "User search failed:",
          err?.message || err
        );

        setResults([]);
        setError(true);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLastSearched(trimmed);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // --------------------------------------------------
  // INVALIDATE REQUESTS ON UNMOUNT
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  // --------------------------------------------------
  // CLEAR SEARCH
  // --------------------------------------------------

  const clearSearch = () => {
    setQuery("");
    Keyboard.dismiss();
  };

  // --------------------------------------------------
  // ANDROID BACK BUTTON
  // --------------------------------------------------

  useEffect(() => {
    if (!active || !isFocused) {
      return;
    }

    const subscription =
      BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setQuery("");
          Keyboard.dismiss();
          return true;
        }
      );

    return () => {
      subscription.remove();
    };
  }, [active, isFocused]);

  // --------------------------------------------------
  // SELECT USER
  // --------------------------------------------------

  const handleSelect = (selectedUser) => {
    Keyboard.dismiss();
    setQuery("");

    if (onSelectUser) {
      onSelectUser(selectedUser);
    }
  };

  // --------------------------------------------------
  // SEARCH STATE
  // --------------------------------------------------

  const isPending =
    loading || lastSearched !== trimmed;

  // --------------------------------------------------
  // SEARCH RESULTS
  // --------------------------------------------------

  const renderResultsBody = () => {
    // Searching
    if (isPending && results.length === 0) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator
            size="small"
            color={colors.accent}
          />

          <Text style={styles.stateText}>
            Searching...
          </Text>
        </View>
      );
    }

    // Error
    if (!isPending && error) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>
            Couldn't search
          </Text>

          <Text style={styles.stateText}>
            Please check your connection and try again.
          </Text>
        </View>
      );
    }

    // No users
    if (!isPending && results.length === 0) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateEmoji}>
            🔍
          </Text>

          <Text style={styles.stateTitle}>
            No users found
          </Text>

          <Text style={styles.stateText}>
            Try a different name.
          </Text>
        </View>
      );
    }

    // Results
    return (
      <FlatList
        data={results}
        keyExtractor={(item, index) =>
          String(
            item.id ??
              item.userId ??
              index
          )
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          styles.resultsContent
        }
        ListHeaderComponent={
          isPending ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator
                size="small"
                color={colors.accent}
              />

              <Text style={styles.inlineLoadingText}>
                Searching...
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const displayName =
            item.name || "Unknown";

          return (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              {/* Avatar */}
              <View style={styles.avatar}>
                {item.profileImage ? (
                  <Image
                    source={{
                      uri: getMediaUrl(
                        item.profileImage
                      ),
                    }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text
                    style={
                      styles.avatarPlaceholder
                    }
                  >
                    {displayName
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                )}
              </View>

              {/* User information */}
              <View style={styles.resultInfo}>
                <Text
                  style={styles.resultName}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>

                {item.location ? (
                  <View
                    style={styles.locationRow}
                  >
                    <MapPin
                      size={12}
                      color={
                        colors.textSecondary
                      }
                    />

                    <Text
                      style={
                        styles.resultLocation
                      }
                      numberOfLines={1}
                    >
                      {item.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <View style={styles.container}>
      {/* SEARCH BAR */}
      <View
        style={[
          styles.searchWrap,
          {
            // IMPORTANT:
            // Reserve Android status-bar / safe-area space.
            //
            // This fixes the search bar appearing too high
            // in your screenshot.
            paddingTop:
              Math.max(
                insets.top,
                spacing.sm
              ) + 4,
          },
        ]}
      >
        <View style={styles.searchBox}>
          <SearchIcon
            size={18}
            color={colors.textSecondary}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name..."
            placeholderTextColor={
              colors.textSecondary
            }
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessible
            accessibilityLabel="Search users"
          />

          {query.length > 0 ? (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10,
              }}
              accessibilityLabel="Clear search"
              activeOpacity={0.7}
            >
              <X
                size={18}
                color={
                  colors.textSecondary
                }
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* NORMAL FEED
          Feed stays mounted while searching. */}
      <View
        style={[
          styles.content,
          active && styles.hidden,
        ]}
      >
        {children}
      </View>

      {/* SEARCH RESULTS */}
      {active ? (
        <View style={styles.resultsWrap}>
          {renderResultsBody()}
        </View>
      ) : null}
    </View>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  // Search bar wrapper
  searchWrap: {
    backgroundColor: colors.background,

    paddingHorizontal: spacing.md,

    // paddingTop is added dynamically using
    // the device safe-area inset.
    paddingBottom: spacing.sm,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Search input box
  searchBox: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: colors.surface,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: radii.md,

    paddingHorizontal: spacing.md,

    minHeight: 46,

    gap: spacing.sm,
  },

  searchInput: {
    flex: 1,

    paddingVertical: spacing.sm,

    ...typography.body,

    color: colors.textPrimary,
  },

  // Feed area
  content: {
    flex: 1,
  },

  // Hide feed while searching,
  // but don't unmount it.
  hidden: {
    display: "none",
  },

  // Search results area
  resultsWrap: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  resultsContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },

  // Small loading row
  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: spacing.sm,

    paddingBottom: spacing.sm,
  },

  inlineLoadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // User result
  resultRow: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: colors.background,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: radii.lg,

    padding: spacing.md,

    marginBottom: spacing.sm,
  },

  // Avatar
  avatar: {
    width: 46,
    height: 46,

    borderRadius: 23,

    backgroundColor: colors.surface,

    alignItems: "center",
    justifyContent: "center",

    overflow: "hidden",

    marginRight: spacing.md,
  },

  avatarImage: {
    width: 46,
    height: 46,
  },

  avatarPlaceholder: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  // User information
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },

  resultName: {
    ...typography.body,

    fontWeight: "700",

    color: colors.textPrimary,
  },

  // Location row
  locationRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 4,

    marginTop: 2,
  },

  resultLocation: {
    ...typography.caption,

    color: colors.textSecondary,

    flexShrink: 1,
  },

  // Searching / empty / error state
  stateBox: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    padding: spacing.xl,

    gap: spacing.xs,
  },

  stateEmoji: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },

  stateTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },

  stateText: {
    ...typography.body,

    color: colors.textSecondary,

    textAlign: "center",
  },
});