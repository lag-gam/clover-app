import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useStyleProfile } from "@/hooks/useStyleProfile";
import { fetchGarments } from "@/services/garment.service";
import { Garment } from "@/types/database";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, interactionCount, loading, refresh, isColdStart } =
    useStyleProfile();
  const [topGarments, setTopGarments] = useState<Garment[]>([]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (user) {
        fetchGarments(user.id).then((g) => {
          // Show first 6 garments as "top" items for now
          setTopGarments(g.slice(0, 6));
        });
      }
    }, [user])
  );

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor="#16a34a"
        />
      }
    >
      <View className="items-center pt-8 pb-4">
        <View className="w-20 h-20 rounded-full bg-clover-100 items-center justify-center mb-4">
          <Text className="text-2xl text-clover-600">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <Text className="text-lg font-semibold">{user?.email}</Text>
      </View>

      {/* Style Stats */}
      <View className="px-4 mb-4">
        <Text className="text-base font-semibold text-gray-800 mb-3">
          Style Profile
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 bg-gray-50 rounded-lg p-3 items-center">
            <Text className="text-2xl font-bold text-clover-600">
              {interactionCount}
            </Text>
            <Text className="text-xs text-gray-500">Ratings</Text>
          </View>
          <View className="flex-1 bg-gray-50 rounded-lg p-3 items-center">
            <Text className="text-2xl font-bold text-clover-600">
              {profile ? "Active" : "---"}
            </Text>
            <Text className="text-xs text-gray-500">Style Model</Text>
          </View>
          <View className="flex-1 bg-gray-50 rounded-lg p-3 items-center">
            <Text className="text-2xl font-bold text-clover-600">
              {topGarments.length}
            </Text>
            <Text className="text-xs text-gray-500">Garments</Text>
          </View>
        </View>

        {isColdStart && (
          <View className="bg-clover-50 rounded-lg p-3 mt-3">
            <Text className="text-sm text-clover-700">
              Rate {5 - interactionCount} more outfit
              {5 - interactionCount !== 1 ? "s" : ""} to activate personalized
              recommendations.
            </Text>
          </View>
        )}

        {profile && (
          <Text className="text-xs text-gray-400 mt-2">
            Last updated:{" "}
            {new Date(profile.updated_at).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* Recent garments */}
      {topGarments.length > 0 && (
        <View className="px-4 mb-6">
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Recent Garments
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {topGarments.map((g) => (
              <View
                key={g.id}
                className="w-16 h-16 bg-gray-100 rounded-lg items-center justify-center"
              >
                <Image
                  source={{ uri: g.cutout_url ?? g.image_url }}
                  className="w-14 h-14"
                  resizeMode="contain"
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Sign out */}
      <View className="px-4 pb-8">
        <TouchableOpacity
          className="border border-red-300 rounded-lg py-3 items-center"
          onPress={handleSignOut}
        >
          <Text className="text-red-500 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
