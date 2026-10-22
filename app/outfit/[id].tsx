import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  deleteOutfit,
  fetchOutfitWithItems,
  updateOutfitItemSide,
} from "@/services/outfit.service";
import { logInteraction } from "@/services/interaction.service";
import { useAuth } from "@/hooks/useAuth";
import { Garment, Outfit, OutfitItem } from "@/types/database";
import { FlatLayCollage, FlatLayItem } from "@/components/FlatLayCollage";
import { OutfitItemActionSheet } from "@/components/OutfitItemActionSheet";
import { Ionicons } from "@expo/vector-icons";

export default function OutfitDetailScreen() {
  const { id, justSaved } = useLocalSearchParams<{
    id: string;
    justSaved?: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [items, setItems] = useState<(OutfitItem & { garment: Garment })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionItem, setActionItem] = useState<FlatLayItem | null>(null);

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

  const handleDelete = () => {
    if (!outfit) return;
    Alert.alert(
      "Delete outfit?",
      "This removes it from Closet and Calendar. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteOutfit(outfit.id);
              router.back();
            } catch (error) {
              Alert.alert(
                "Could not delete outfit",
                error instanceof Error ? error.message : "Please try again."
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50">
        <ActivityIndicator size="large" color="#173F32" />
      </View>
    );
  }

  if (!outfit) return null;

  return (
    <ScrollView className="flex-1 bg-clover-50">
      <Stack.Screen options={{ title: outfit.name?.trim() || "Outfit" }} />
      <View className="px-4 pt-4">
        <FlatLayCollage
          items={items}
          showLabels={false}
          onGarmentPress={() => {}}
          onItemPress={setActionItem}
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
        {justSaved === "1" && (
          <View className="mb-4 flex-row items-center rounded-xl border border-clover-200 bg-clover-100 px-3 py-3">
            <Ionicons name="checkmark-circle" size={20} color="#12372A" />
            <Text className="ml-2 flex-1 text-sm font-medium text-clover-800">
              Saved as {outfit.name?.trim() || "Outfit"}. Find it in Closet → Outfits.
            </Text>
          </View>
        )}
        <TouchableOpacity
          className="mb-3 flex-row items-center justify-center rounded-lg border border-clover-600 py-3"
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/(tabs)/calendar",
              params: { outfitId: outfit.id },
            })
          }
        >
          <Ionicons name="calendar-outline" size={19} color="#12372A" />
          <Text className="ml-2 font-semibold text-clover-700">
            Schedule outfit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-clover-600 rounded-lg py-3 items-center"
          onPress={handleWear}
        >
          <Text className="text-white font-semibold">Mark as Worn</Text>
        </TouchableOpacity>
        <Text className="mt-2 text-center text-xs text-stone-400">
          Scheduled looks move to Laundry the day after you wear them.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Delete outfit"
          className="mt-3 flex-row items-center justify-center rounded-lg border border-red-300 py-3"
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={18} color="#dc2626" />
          <Text className="ml-2 font-semibold text-red-500">Delete outfit</Text>
        </TouchableOpacity>
      </View>
      <OutfitItemActionSheet
        item={actionItem}
        visible={Boolean(actionItem)}
        onClose={() => setActionItem(null)}
        onTurn={
          actionItem?.garment.back_image_url
            ? () => {
                const item = items.find(
                  (candidate) => candidate.garment_id === actionItem.garment.id
                );
                if (!item) return;
                const next =
                  item.display_side === "back" ? "front" : "back";
                void updateOutfitItemSide(item.id, next)
                  .then(() =>
                    setItems((current) =>
                      current.map((candidate) =>
                        candidate.id === item.id
                          ? { ...candidate, display_side: next }
                          : candidate
                      )
                    )
                  )
                  .catch((error: unknown) =>
                    Alert.alert(
                      "Could not turn item",
                      error instanceof Error ? error.message : "Please try again."
                    )
                  );
                setActionItem(null);
              }
            : undefined
        }
        onView={() => {
          if (!actionItem) return;
          const garmentId = actionItem.garment.id;
          setActionItem(null);
          router.push(`/garment/${garmentId}`);
        }}
      />
    </ScrollView>
  );
}
