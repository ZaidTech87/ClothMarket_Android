import React from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { colors, spacing, radii, typography } from "../theme/theme";

// Reusable text field used by every auth screen. `secureToggle` renders
// the show/hide eye icon web's Login/SignUp use, without duplicating the
// wrapper markup in every screen.
export default function AuthInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  secureToggle,
  visible,
  onToggleVisible,
  keyboardType = "default",
  autoCapitalize = "none",
  ...rest
}) {
  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry={secureTextEntry && !visible}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        {...rest}
      />
      {secureToggle && (
        <TouchableOpacity
          style={styles.toggle}
          onPress={onToggleVisible}
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff size={20} color={colors.textSecondary} />
          ) : (
            <Eye size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  toggle: {
    padding: spacing.xs,
  },
});
