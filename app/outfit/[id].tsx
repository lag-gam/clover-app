import { useState, useEffect } from "react";
import {
  View,
  Text,
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
import { FlatLayCollage } from "@/components/FlatLayCollage";

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

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 py-6">
        <FlatLayCollage
          items={items}
          onGarmentPress={(garment) =>
            router.push(`/garment/${garment.id}`)
          }
          accessibilityLabel="Saved outfit flat lay"
        />
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
