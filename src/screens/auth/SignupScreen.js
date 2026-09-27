import React, { useState } from "react";
import { AuthScreen, AuthButton, AuthLink } from "../../components/AuthScreen";
import AuthInput from "../../components/AuthInput";
import { authAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

// Direct port of web's SignUp.jsx. Field names and validation intent
// (password min 6 chars) mirror the backend's SignUpRequest exactly -
// the backend additionally requires at least one letter + one digit,
// which we surface via the server's own error message rather than
// re-implementing the regex client-side and risking it drifting out of
// sync with the backend rule.
export default function SignupScreen({ navigation }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: "", location: "", mobile: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.mobile.trim() || !form.password) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await authAPI.signup(form);
      const { token, userId, name, mobile, location, profileImage } = response.data;
      await login({ userId, name, mobile, location, profileImage }, token);
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Create Account"
      subtitle="Join the ClothMarket community"
      error={error}
      footer={<AuthLink label="Already have an account? Login" onPress={() => navigation.navigate("Login")} />}
    >
      <AuthInput value={form.name} onChangeText={setField("name")} placeholder="Full Name" autoCapitalize="words" />
      <AuthInput value={form.location} onChangeText={setField("location")} placeholder="Location (City, State)" autoCapitalize="words" />
      <AuthInput value={form.mobile} onChangeText={setField("mobile")} placeholder="Mobile Number" keyboardType="phone-pad" />
      <AuthInput
        value={form.password}
        onChangeText={setField("password")}
        placeholder="Password (min 6 characters, letters + numbers)"
        secureTextEntry
        secureToggle
        visible={showPassword}
        onToggleVisible={() => setShowPassword((v) => !v)}
      />
      <AuthButton label="Sign Up" loadingLabel="Creating Account..." loading={loading} onPress={handleSubmit} />
    </AuthScreen>
  );
}
