import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlatLayCollage } from "@/components/FlatLayCollage";
import { OutfitWithItems } from "@/types/database";
import { displayOutfitName } from "@/utils/outfit-state";

interface SavedOutfitsListProps {
  outfits: OutfitWithItems[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (outfit: OutfitWithItems) => void;
  onSchedule: (outfit: OutfitWithItems) => void;
  onDelete: (outfit: OutfitWithItems) => void;
  onCreate: () => void;
}

export function SavedOutfitsList({
  outfits,
  loading,
  onRefresh,
  onOpen,
  onSchedule,
  onDelete,
  onCreate,
}: SavedOutfitsListProps) {
  return (
    <FlatList
      className="flex-1 bg-clover-50"
      data={outfits}
      keyExtractor={(item) => item.id}
      contentContainerClassName="px-4 pb-8 pt-3"
      initialNumToRender={4}
      windowSize={5}
      removeClippedSubviews
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor="#173F32"
        />
      }
      renderItem={({ item }) => {
        const name = displayOutfitName(item, outfits);
        return (
          <View className="mb-4 overflow-hidden rounded-2xl border border-stone-200 bg-white p-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Open ${name}`}
              onPress={() => onOpen(item)}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-stone-900">
                    {name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-stone-400">
                    {item.items.length} piece{item.items.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
              </View>
              <FlatLayCollage
                items={item.items}
                showLabels={false}
                onGarmentPress={() => onOpen(item)}
                accessibilityLabel={`${name} collage`}
              />
            </TouchableOpacity>
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Schedule ${name}`}
                onPress={() => onSchedule(item)}
                className="min-h-11 flex-1 flex-row items-center justify-center rounded-xl bg-clover-100 py-3"
              >
                <Ionicons name="calendar-outline" size={16} color="#12372A" />
                <Text className="ml-1.5 text-xs font-bold text-clover-700">
                  Schedule
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Delete ${name}`}
                onPress={() =>
                  Alert.alert(
                    "Delete outfit?",
                    "This removes it from Closet and Calendar. This cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => onDelete(item),
                      },
                    ]
                  )
                }
                className="min-h-11 flex-1 flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50 py-3"
              >
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
                <Text className="ml-1.5 text-xs font-bold text-red-600">
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <View className="items-center px-8 py-16">
          <Ionicons name="layers-outline" size={42} color="#d6d3d1" />
          <Text className="mt-3 text-center font-semibold text-stone-500">
            No saved outfits yet
          </Text>
          <Text className="mt-1 text-center text-xs text-stone-400">
            Build a look from your closet, then it will show up here.
          </Text>
          <TouchableOpacity
            onPress={onCreate}
            className="mt-5 min-h-11 rounded-xl bg-clover-600 px-5 py-3"
          >
            <Text className="font-bold text-white">Create an outfit</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}
