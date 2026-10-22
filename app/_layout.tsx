import "../global.css";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Stack } from "expo-router";
import { AuthProvider } from "@/providers/AuthProvider";
import { useAuth } from "@/hooks/useAuth";

function RootLayoutNav() {
  const { session, loading, signingIn, error, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50">
        <ActivityIndicator size="large" color="#173F32" />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50 px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-3xl bg-clover-600">
          <Text className="text-4xl font-bold text-white">C</Text>
        </View>
        <Text className="text-center text-4xl font-bold text-stone-900">
          Welcome to Clover
        </Text>
        <Text className="mb-10 mt-3 text-center text-base text-stone-500">
          Sign in to save your closet and personalized recommendations.
        </Text>

        <TouchableOpacity
          className={`w-full max-w-sm flex-row items-center justify-center rounded-2xl border border-clover-200 bg-white px-5 py-4 ${
            signingIn ? "opacity-60" : ""
          }`}
          onPress={() => void signInWithGoogle()}
          disabled={signingIn}
        >
          {signingIn ? (
            <ActivityIndicator size="small" color="#173F32" />
          ) : (
            <Text className="mr-3 text-xl font-bold text-blue-500">G</Text>
          )}
          <Text className="font-semibold text-stone-800">
            {signingIn ? "Connecting to Google…" : "Continue with Google"}
          </Text>
        </TouchableOpacity>

        {error && (
          <Text className="mt-5 max-w-sm text-center text-sm text-red-500">
            {error}
          </Text>
        )}
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#F7F8F3" },
        headerStyle: { backgroundColor: "#FCFBF7" },
        headerShadowVisible: false,
        headerTintColor: "#12372A",
        headerTitleStyle: { color: "#202823", fontWeight: "700" },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="garment/[id]" options={{ title: "Garment" }} />
      <Stack.Screen
        name="outfit/create"
        options={{ title: "Create Your Outfit" }}
      />
      <Stack.Screen name="outfit/[id]" options={{ title: "Outfit" }} />
      <Stack.Screen
        name="style/[garmentId]"
        options={{ title: "Style This Item" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
