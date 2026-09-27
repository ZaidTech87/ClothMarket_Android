import React, { useState } from "react";
import { Alert } from "react-native";
import { AuthScreen, AuthButton, AuthLink } from "../../components/AuthScreen";
import AuthInput from "../../components/AuthInput";
import { authAPI } from "../../services/api";

// Direct port of web's ForgotPassword.jsx. Web passed the mobile number
// forward via react-router's `navigate(path, { state })`; React
// Navigation's equivalent is route params, so we pass it as
// `{ mobile }` to the ResetPassword screen instead.
export default function ForgotPasswordScreen({ navigation }) {
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!mobile.trim()) {
      setError("Mobile number is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authAPI.forgotPassword(mobile.trim());
      Alert.alert("OTP sent", "Check the backend console for the code.");
      navigation.navigate("ResetPassword", { mobile: mobile.trim() });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Forgot Password"
      subtitle="Enter your mobile number to receive an OTP"
      error={error}
      footer={<AuthLink label="Back to Login" onPress={() => navigation.navigate("Login")} />}
    >
      <AuthInput
        value={mobile}
        onChangeText={(t) => { setMobile(t); setError(""); }}
        placeholder="Mobile Number"
        keyboardType="phone-pad"
      />
      <AuthButton label="Send OTP" loadingLabel="Sending..." loading={loading} onPress={sendOtp} />
    </AuthScreen>
  );
}
