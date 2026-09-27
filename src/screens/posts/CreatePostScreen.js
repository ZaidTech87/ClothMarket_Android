import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, X } from "lucide-react-native";
import { postAPI } from "../../services/api";
import { colors, spacing, radii, typography } from "../../theme/theme";

// Direct port of web's CreatePost.jsx. Same three-field product form
// (clothType/price/quantity) plus description, same optional single
// media attachment, same POST /posts/create multipart contract
// (postData JSON blob + file) - only the media *source* changes, from
// a browser <input type="file"> to expo-image-picker's library/camera
// picker, since RN has neither of those DOM APIs.
export default function CreatePostScreen({ navigation }) {
  const [form, setForm] = useState({ description: "", clothType: "", price: "", quantity: "" });
  const [media, setMedia] = useState(null); // { uri, type: 'image'|'video', mimeType, fileName }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach media to your listing.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const isVideo = asset.type === "video";
    setMedia({
      uri: asset.uri,
      type: isVideo ? "video" : "image",
      mimeType: asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg"),
      fileName: asset.fileName || `upload.${isVideo ? "mp4" : "jpg"}`,
    });
  };

  const removeMedia = () => setMedia(null);

  const resetForm = () => {
    setForm({ description: "", clothType: "", price: "", quantity: "" });
    setMedia(null);
    setError("");
  };

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const postData = {
        description: form.description.trim(),
        price: form.price ? parseFloat(form.price) : null,
        quantity: form.quantity ? parseInt(form.quantity, 10) : null,
        clothType: form.clothType.trim() || null,
      };

      // RN's FormData needs { uri, name, type } for a file part - the
      // web equivalent just appends the raw browser File object.
      const fileAsset = media
        ? { uri: media.uri, name: media.fileName, type: media.mimeType }
        : null;

      await postAPI.createPost(postData, fileAsset);
      resetForm();
      navigation.navigate("Feed");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create New Post</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Tell buyers about your cloth product..."
        placeholderTextColor={colors.textSecondary}
        value={form.description}
        onChangeText={setField("description")}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Cloth Type</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Cotton, Silk, Linen"
        placeholderTextColor={colors.textSecondary}
        value={form.clothType}
        onChangeText={setField("clothType")}
      />

      <Text style={styles.label}>Price (₹) / unit</Text>
      <TextInput
        style={styles.input}
        placeholder="Price per unit"
        placeholderTextColor={colors.textSecondary}
        value={form.price}
        onChangeText={setField("price")}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Available Quantity (units)</Text>
      <TextInput
        style={styles.input}
        placeholder="Available quantity"
        placeholderTextColor={colors.textSecondary}
        value={form.quantity}
        onChangeText={setField("quantity")}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Add Photo or Video</Text>
      {!media ? (
        <TouchableOpacity style={styles.uploadArea} onPress={pickMedia} activeOpacity={0.8}>
          <ImagePlus size={32} color={colors.textSecondary} />
          <Text style={styles.uploadText}>Tap to select a photo or video</Text>
          <Text style={styles.uploadHint}>JPG, PNG, MP4 (max 50MB)</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.previewWrap}>
          <TouchableOpacity style={styles.removeMediaBtn} onPress={removeMedia}>
            <X size={16} color={colors.white} />
          </TouchableOpacity>
          {media.type === "video" ? (
            <Video source={{ uri: media.uri }} style={styles.previewMedia} useNativeControls resizeMode={ResizeMode.COVER} />
          ) : (
            <Image source={{ uri: media.uri }} style={styles.previewMedia} resizeMode="cover" />
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.navigate("Feed")} disabled={loading}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Post</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.md },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, ...typography.caption },
  label: { ...typography.caption, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  textarea: { height: 100, textAlignVertical: "top" },
  uploadArea: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  uploadText: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm },
  uploadHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  previewWrap: { borderRadius: radii.md, overflow: "hidden" },
  previewMedia: { width: "100%", height: 240, backgroundColor: colors.surface },
  removeMediaBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: radii.pill,
    padding: spacing.xs,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textSecondary, fontWeight: "600" },
  submitBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radii.md, backgroundColor: colors.accent, minWidth: 90, alignItems: "center" },
  submitText: { color: colors.white, fontWeight: "700" },
});
