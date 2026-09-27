import React, { useState } from "react";
import { View } from "react-native";
import { AuthScreen, AuthButton, AuthLink } from "../../components/AuthScreen";
import AuthInput from "../../components/AuthInput";
import { authAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

// Direct port of web's Login.jsx. Same request shape ({ mobile, password }
// -> POST /auth/login) and same response destructuring
// (token, userId, name, mobile, location, profileImage) - no backend
// change needed.
export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!mobile.trim() || !password) {
      setError("Mobile number and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await authAPI.login({ mobile: mobile.trim(), password });
      const { token, userId, name, mobile: respMobile, location, profileImage } = response.data;
      await login({ userId, name, mobile: respMobile, location, profileImage }, token);
      // No explicit navigation call needed: RootNavigator swaps to
      // MainNavigator automatically once AuthContext's `user` is set,
      // same reactive behavior as web's ProtectedRoute/PublicRoute pair.
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="ClothMarket"
      subtitle="Connect with cloth producers and buyers"
      error={error}
      footer={
        <AuthLink label="Don't have an account? Sign Up" onPress={() => navigation.navigate("Signup")} />
      }
    >
      <AuthInput
        value={mobile}
        onChangeText={(t) => { setMobile(t); setError(""); }}
        placeholder="Mobile Number"
        keyboardType="phone-pad"
      />
      <AuthInput
        value={password}
        onChangeText={(t) => { setPassword(t); setError(""); }}
        placeholder="Password"
        secureTextEntry
        secureToggle
        visible={showPassword}
        onToggleVisible={() => setShowPassword((v) => !v)}
      />
      <View style={{ alignItems: "flex-end", marginBottom: 20 }}>
        <AuthLink label="Forgot Password?" onPress={() => navigation.navigate("ForgotPassword")} />
      </View>
      <AuthButton
        label="Login"
        loading={loading}
        onPress={handleSubmit}
      />
    </AuthScreen>
  );
}
