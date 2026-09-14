import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchOutfitWithItems } from "@/services/outfit.service";
import { logInteraction } from "@/services/interaction.service";
import { useAuth } from "@/hooks/useAuth";
import { Garment, Outfit, OutfitItem } from "@/types/database";

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [items, setItems] = useState<(OutfitItem & { garment: Garment })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOutfit();
  }, [id]);

  const loadOutfit = async () => {
    try {
      const data = await fetchOutfitWithItems(id!);
      setOutfit(data.outfit);
      setItems(data.items);
    } catch (e) {
      Alert.alert("Error", "Outfit not found");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleWear = async () => {
    if (!outfit || !user) return;
    await logInteraction(user.id, outfit.id, "worn");
    Alert.alert("Logged", "Outfit marked as worn!");
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!outfit) return null;

  const slotOrder = ["outerwear", "top", "dress", "bottom", "shoes", "accessory"];
  const sorted = [...items].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
  );

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="items-center py-6 gap-2">
        {sorted.map((item) => (
          <TouchableOpacity
            key={item.id}
            className="items-center"
            onPress={() => router.push(`/garment/${item.garment_id}`)}
          >
            <Image
              source={{
                uri: item.garment.cutout_url ?? item.garment.image_url,
              }}
              className="w-36 h-36"
              resizeMode="contain"
            />
            <Text className="text-xs text-gray-500 capitalize mt-1">
              {item.slot}: {item.garment.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {outfit.score !== null && outfit.score > 0 && (
        <View className="items-center mb-4">
          <Text className="text-sm text-gray-400">
            Style match: {Math.round(outfit.score * 100)}%
          </Text>
        </View>
      )}

      <View className="px-4 pb-8">
        <TouchableOpacity
          className="bg-clover-600 rounded-lg py-3 items-center"
          onPress={handleWear}
        >
          <Text className="text-white font-semibold">Mark as Worn</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
