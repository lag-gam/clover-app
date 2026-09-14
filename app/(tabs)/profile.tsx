import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <View className="flex-1 bg-white px-6 pt-8">
      <View className="items-center mb-8">
        <View className="w-20 h-20 rounded-full bg-clover-100 items-center justify-center mb-4">
          <Text className="text-2xl text-clover-600">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text className="text-lg font-semibold">{user?.email}</Text>
      </View>

      <View className="bg-gray-50 rounded-lg p-4 mb-6">
        <Text className="text-sm text-gray-500 mb-1">Style Stats</Text>
        <Text className="text-gray-400 text-sm">
          Start adding garments and rating outfits to build your style profile.
        </Text>
      </View>

      <TouchableOpacity
        className="border border-red-300 rounded-lg py-3 items-center"
        onPress={handleSignOut}
      >
        <Text className="text-red-500 font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
