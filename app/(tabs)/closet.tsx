import { View, Text, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useGarments } from "@/hooks/useGarments";
import { GarmentCard } from "@/components/GarmentCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Ionicons } from "@expo/vector-icons";

export default function ClosetScreen() {
  const { garments, loading, category, setCategory, refresh } = useGarments();
  const router = useRouter();

  if (!loading && garments.length === 0 && category === null) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Ionicons name="shirt-outline" size={48} color="#d1d5db" />
        <Text className="text-lg text-gray-400 mt-4">Your closet is empty</Text>
        <Text className="text-sm text-gray-300 mt-1 text-center">
          Go to the Add tab to photograph your first garment
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <CategoryFilter selected={category} onSelect={setCategory} />
      <FlatList
        data={garments}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GarmentCard
            garment={item}
            onPress={() => router.push(`/garment/${item.id}`)}
          />
        )}
        contentContainerClassName="px-2 pb-4"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor="#16a34a"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-gray-400">
              No garments in this category
            </Text>
          </View>
        }
      />
    </View>
  );
}
