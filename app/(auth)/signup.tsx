import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      Alert.alert("Signup Error", error.message);
    } else {
      Alert.alert(
        "Success",
        "Check your email for a confirmation link, then sign in."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-4xl font-bold text-center text-clover-600 mb-2">
          Clover
        </Text>
        <Text className="text-center text-gray-500 mb-10">
          Create your account
        </Text>

        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#9ca3af"
        />

        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#9ca3af"
        />

        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholderTextColor="#9ca3af"
        />

        <TouchableOpacity
          className={`rounded-lg py-3 items-center ${
            loading ? "bg-clover-300" : "bg-clover-600"
          }`}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-base">
            {loading ? "Creating account..." : "Sign Up"}
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-clover-600 font-semibold">Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
