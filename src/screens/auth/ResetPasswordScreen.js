import React, { useState } from "react";
import { Alert } from "react-native";
import { AuthScreen, AuthButton, AuthLink } from "../../components/AuthScreen";
import AuthInput from "../../components/AuthInput";
import { authAPI } from "../../services/api";

// Direct port of web's ResetPassword.jsx. `route.params?.mobile` replaces
// web's `location.state?.mobile` as the prefill source when arriving
// from ForgotPasswordScreen; the field stays editable either way, same
// as the web version.
export default function ResetPasswordScreen({ navigation, route }) {
  const mobileFromParams = route.params?.mobile || "";

  const [mobile, setMobile] = useState(mobileFromParams);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetPassword = async () => {
    if (!mobile.trim() || !otp.trim() || !password) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authAPI.resetPassword({ mobile: mobile.trim(), otp: otp.trim(), newPassword: password });
      Alert.alert("Success", "Password updated successfully.");
      navigation.navigate("Login");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Reset Password"
      subtitle="Enter the OTP and your new password"
      error={error}
      footer={<AuthLink label="Back to Login" onPress={() => navigation.navigate("Login")} />}
    >
      <AuthInput
        value={mobile}
        onChangeText={(t) => { setMobile(t); setError(""); }}
        placeholder="Mobile Number"
        keyboardType="phone-pad"
      />
      <AuthInput
        value={otp}
        onChangeText={(t) => { setOtp(t); setError(""); }}
        placeholder="OTP"
        keyboardType="number-pad"
      />
      <AuthInput
        value={password}
        onChangeText={(t) => { setPassword(t); setError(""); }}
        placeholder="New Password"
        secureTextEntry
      />
      <AuthButton label="Reset Password" loadingLabel="Updating..." loading={loading} onPress={resetPassword} />
    </AuthScreen>
  );
}
