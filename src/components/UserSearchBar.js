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
import { Search as SearchIcon, X, MapPin } from "lucide-react-native";
import { userAPI, getMediaUrl } from "../services/api";
import { colors, spacing, radii, typography } from "../theme/theme";

const DEBOUNCE_MS = 400;

// Search bar for the main feed. Renders the input on top and, below it,
// EITHER the normal content (children - the feed list) OR the search
// results. The children stay mounted while searching (just hidden), so
// the feed's scroll position, pagination state and pull-to-refresh are
// preserved when the search is cleared.
//
// Uses the existing userAPI.searchUsers(name) -> GET /users/search?name=
// Results are User entities, so the identifier field is `id`.
export default function UserSearchBar({ onSelectUser, children }) {
  const isFocused = useIsFocused();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lastSearched, setLastSearched] = useState(null);

  const requestIdRef = useRef(0);

  const trimmed = query.trim();
  const active = trimmed.length > 0;

  // Debounced search. Each run gets a request id; a response is only
  // applied if it belongs to the latest run, so a slow earlier request
  // can never overwrite the results of a newer query.
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

        if (requestId !== requestIdRef.current) return;

        setResults(Array.isArray(response.data) ? response.data : []);
        setError(false);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

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

  // Invalidate any in-flight request when this component unmounts.
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  const clearSearch = () => {
    setQuery("");
    Keyboard.dismiss();
  };

  // While a search is active, the Android back button clears the search
  // first. This handler registers after the Feed's own "press back again
  // to exit" handler, so it runs first and consumes the press.
  useEffect(() => {
    if (!active || !isFocused) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setQuery("");
        Keyboard.dismiss();
        return true;
      }
    );

    return () => subscription.remove();
  }, [active, isFocused]);

  const handleSelect = (selectedUser) => {
    Keyboard.dismiss();
    setQuery("");
    onSelectUser?.(selectedUser);
  };

  // "Pending" = a request is in flight, or the results on screen don't
  // belong to the current query yet (debounce window). Prevents a
  // premature "No users found" flash while the user is still typing.
  const isPending = loading || lastSearched !== trimmed;

  const renderResultsBody = () => {
    if (isPending && results.length === 0) {
      return (
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.stateText}>Searching...</Text>
        </View>
      );
    }

    if (!isPending && error) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Couldn't search</Text>
          <Text style={styles.stateText}>
            Please check your connection and try again.
          </Text>
        </View>
      );
    }

    if (!isPending && results.length === 0) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateEmoji}>🔍</Text>
          <Text style={styles.stateTitle}>No users found</Text>
          <Text style={styles.stateText}>
            Try a different name.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={results}
        keyExtractor={(item, index) =>
          String(item.id ?? item.userId ?? index)
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.resultsContent}
        ListHeaderComponent={
          isPending ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.inlineLoadingText}>Searching...</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const displayName = item.name || "Unknown";

          return (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                {item.profileImage ? (
                  <Image
                    source={{ uri: getMediaUrl(item.profileImage) }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarPlaceholder}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {displayName}
                </Text>

                {item.location ? (
                  <View style={styles.locationRow}>
                    <MapPin size={12} color={colors.textSecondary} />
                    <Text style={styles.resultLocation} numberOfLines={1}>
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

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <SearchIcon size={18} color={colors.textSecondary} />

          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />

          {query.length > 0 ? (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Clear search"
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Normal content (the feed). Hidden, not unmounted, while searching. */}
      <View style={[styles.content, active && styles.hidden]}>
        {children}
      </View>

      {active ? (
        <View style={styles.resultsWrap}>{renderResultsBody()}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  searchWrap: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

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

  content: {
    flex: 1,
  },

  hidden: {
    display: "none",
  },

  resultsWrap: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  resultsContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },

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

  resultInfo: {
    flex: 1,
    minWidth: 0,
  },

  resultName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },

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